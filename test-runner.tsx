"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Question = { id: string; position: number; question_text: string; question_type: string; options: string[]; section: string | null };
type SavedResponse = { question_id: string; answer: string | string[] | null; marked_for_review: boolean };
type AttemptPayload = { attempt: { id: string; status: string; expires_at: string; tests: { title: string; instructions: string } | null }; questions: Question[]; responses: SavedResponse[] };

export default function TestRunner({ attemptId }: { attemptId: string }) {
  const [payload, setPayload] = useState<AttemptPayload | null>(null);
  const [index, setIndex] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string | string[] | null>>({});
  const [review, setReview] = useState<Set<string>>(new Set());
  const pendingSaves = useRef(new Map<string, Promise<boolean>>());
  const submitting = useRef(false);
  const router = useRouter();

  const submit = useCallback(async () => {
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    try {
      const savesCompleted = await Promise.all(pendingSaves.current.values());
      if (savesCompleted.some((saved) => !saved)) {
        setError("Some answers could not be saved. Check your connection and submit again.");
        return;
      }
      const response = await fetch(`/api/attempts/${attemptId}/submit`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) setError(data.error ?? "Submission failed.");
      else router.push(`/result/${attemptId}`);
    } catch {
      setError("The attempt could not be submitted because a network request failed. Try submitting again.");
    } finally {
      setBusy(false);
      submitting.current = false;
    }
  }, [attemptId, router]);

  useEffect(() => {
    let active = true;
    fetch(`/api/attempts/${attemptId}`).then(async (response) => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to load this attempt.");
      if (!active) return;
      if (data.attempt.status === "submitted") {
        router.push(`/result/${attemptId}`);
        return;
      }
      const initial: Record<string, string | string[] | null> = {};
      const marked = new Set<string>();
      for (const response of data.responses as SavedResponse[]) {
        initial[response.question_id] = response.answer;
        if (response.marked_for_review) marked.add(response.question_id);
      }
      setAnswers(initial);
      setReview(marked);
      setPayload(data as AttemptPayload);
    }).catch((cause: Error) => { if (active) setError(cause.message); });
    return () => { active = false; };
  }, [attemptId, router]);

  useEffect(() => {
    if (!payload) return;
    const tick = () => {
      const seconds = Math.max(0, Math.ceil((new Date(payload.attempt.expires_at).getTime() - Date.now()) / 1000));
      setRemaining(seconds);
      if (seconds === 0 && payload.attempt.status === "in_progress") void submit();
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [payload, submit]);

  async function save(questionId: string, answer: string | string[] | null, marked: boolean) {
    const previous = pendingSaves.current.get(questionId) ?? Promise.resolve();
    const send = async () => {
      try {
        const response = await fetch(`/api/attempts/${attemptId}/response`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question_id: questionId, answer, marked_for_review: marked }),
        });
        const data = await response.json();
        if (!response.ok) {
          setError(data.error ?? "Your answer could not be saved.");
          return false;
        }
        setError("");
        return true;
      } catch {
        setError("Your answer could not be saved because a network request failed.");
        return false;
      }
    };
    const current = previous.then(send, send);
    pendingSaves.current.set(questionId, current);
    const saved = await current;
    if (pendingSaves.current.get(questionId) === current) pendingSaves.current.delete(questionId);
    return saved;
  }

  function setAnswer(question: Question, value: string | string[] | null) {
    setAnswers((current) => ({ ...current, [question.id]: value }));
    void save(question.id, value, review.has(question.id));
  }

  function toggleReview(question: Question) {
    const next = new Set(review);
    if (next.has(question.id)) next.delete(question.id);
    else next.add(question.id);
    setReview(next);
    void save(question.id, answers[question.id] ?? null, next.has(question.id));
  }

  if (error && !payload) return <section className="page-heading"><h1>Unable to open test</h1><p role="alert" className="error">{error}</p></section>;
  if (!payload) return <p className="page-heading">Loading test…</p>;
  const question = payload.questions[index];
  if (!question) return <section className="empty-state"><strong>This test has no questions.</strong><p>Contact an administrator before continuing.</p></section>;
  const answer = answers[question.id] ?? null;
  const time = `${Math.floor(remaining / 60).toString().padStart(2, "0")}:${(remaining % 60).toString().padStart(2, "0")}`;

  function chooseOption(option: string) {
    if (question.question_type === "multiple_select") {
      const selected = Array.isArray(answer) ? answer : [];
      const updated = selected.includes(option) ? selected.filter((value) => value !== option) : [...selected, option];
      setAnswer(question, updated.length ? updated : null);
    } else setAnswer(question, option);
  }

  return <>
    <section className="page-heading"><p className="eyebrow">Examination</p><h1>{payload.attempt.tests?.title ?? "Mock test"}</h1><p>{payload.attempt.tests?.instructions}</p></section>
    <div className="exam-layout">
      <section className="question-box">
        <p className="eyebrow">Question {index + 1} of {payload.questions.length}{question.section ? ` · ${question.section}` : ""}</p>
        <h2>{question.question_text}</h2>
        {(question.question_type === "single_choice" || question.question_type === "multiple_select" || question.question_type === "true_false") &&
          (question.question_type === "true_false" ? ["true", "false"] : question.options).map((option) => {
            const checked = Array.isArray(answer) ? answer.includes(option) : answer === option;
            return <label className="option" key={option}><input type={question.question_type === "multiple_select" ? "checkbox" : "radio"} checked={checked} disabled={busy} onChange={() => chooseOption(option)} />{option}</label>;
          })}
        {question.question_type === "short_answer" && <label className="form"><span className="sr-only">Your answer</span><input aria-label="Your answer" disabled={busy} value={typeof answer === "string" ? answer : ""} onChange={(event) => setAnswer(question, event.target.value || null)} /></label>}
        <div className="role-actions">
          <button className="button secondary" type="button" onClick={() => setIndex(Math.max(0, index - 1))} disabled={busy || index === 0}>Previous</button>
          <button className="button secondary" type="button" onClick={() => toggleReview(question)} disabled={busy}>{review.has(question.id) ? "Remove review mark" : "Mark for review"}</button>
          <button className="button" type="button" onClick={() => setIndex(Math.min(payload.questions.length - 1, index + 1))} disabled={busy || index === payload.questions.length - 1}>Next</button>
        </div>
        {error && <p role="alert" className="error">{error}</p>}
        <button className="button" type="button" onClick={() => { if (window.confirm("Submit this test now? You cannot change answers afterward.")) void submit(); }} disabled={busy}>{busy ? "Submitting…" : "Submit test"}</button>
      </section>
      <aside className="card">
        <div className="timer" aria-live="polite" aria-label="Time remaining">{time}</div>
        <h2 style={{ fontSize: 18, marginTop: 20 }}>Question palette</h2>
        <div className="palette">{payload.questions.map((item, questionIndex) => {
          const classes = [answers[item.id] !== undefined && answers[item.id] !== null ? "answered" : "", review.has(item.id) ? "review" : ""].filter(Boolean).join(" ");
          return <button key={item.id} className={classes} type="button" aria-label={`Question ${questionIndex + 1}${classes ? `, ${classes}` : ""}`} onClick={() => setIndex(questionIndex)}>{questionIndex + 1}</button>;
        })}</div>
        <p className="form-hint">Green: answered · Yellow: marked for review</p>
      </aside>
    </div>
  </>;
}
