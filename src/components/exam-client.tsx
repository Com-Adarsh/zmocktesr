"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type Candidate, loadCandidate } from "@/lib/candidate";
import { SiteFooter, SiteHeader } from "./site-chrome";

type OptionKey = "A" | "B" | "C" | "D";
type Question = {
  questionNumber: number;
  questionText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  diagramUrl: string | null;
};
type Exam = {
  test: { testCode: string; title: string; description: string | null; durationMinutes: number; totalQuestions: number; markingScheme: { positive: number; negative: number } };
  questions: Question[];
};
type Result = {
  performanceId: number;
  score: number;
  maxScore: number;
  percentage: number;
  correctCount: number;
  wrongCount: number;
  unansweredCount: number;
  accuracy: number;
  timeTakenSeconds: number;
  rank: number | null;
  totalCandidates: number;
};
type Attempt = {
  startedAt: number;
  responses: Record<string, OptionKey>;
  marked: number[];
  visited: number[];
  current: number;
  result?: Result;
};

const OPTIONS: OptionKey[] = ["A", "B", "C", "D"];

function fmt(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h > 0 ? `${h}:` : ""}${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export function ExamClient({ testCode }: { testCode: string }) {
  const [candidate, setCandidate] = useState<Candidate | null | undefined>(undefined);
  const [exam, setExam] = useState<Exam | null>(null);
  const [loadError, setLoadError] = useState("");
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const storageKey = candidate ? `sfi_exam:${testCode}:${candidate.id}` : "";

  useEffect(() => {
    const c = loadCandidate();
    setCandidate(c);
    if (!c) return;
    const stored = localStorage.getItem(`sfi_exam:${testCode}:${c.id}`);
    if (stored) {
      try {
        setAttempt(JSON.parse(stored));
      } catch {
        /* ignore corrupt state */
      }
    }
    fetch(`/api/exam/${encodeURIComponent(testCode)}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? "Could not load the exam.");
        setExam(d);
      })
      .catch((e) => setLoadError(e.message));
  }, [testCode]);

  useEffect(() => {
    if (storageKey && attempt) localStorage.setItem(storageKey, JSON.stringify(attempt));
  }, [storageKey, attempt]);

  if (candidate === undefined) return null;

  if (!candidate || (candidate.testCode && candidate.testCode !== testCode)) {
    return (
      <Shell>
        <div className="card panel">
          <span className="eyebrow">Registration required</span>
          <h1>Register for {testCode} first</h1>
          <p className="muted">
            {candidate
              ? `You are registered as ${candidate.fullName} for ${candidate.testCode}. Register again with the same email and this test code to switch.`
              : "Enter your details and this test code on the registration page to receive your registration ID."}
          </p>
          <Link className="btn btn-red" href="/#register">Go to registration</Link>
        </div>
      </Shell>
    );
  }

  if (loadError) {
    return (
      <Shell>
        <div className="card panel">
          <span className="eyebrow">Unavailable</span>
          <h1>{loadError}</h1>
          <Link className="btn" href="/">Back home</Link>
        </div>
      </Shell>
    );
  }

  if (!exam) {
    return (
      <Shell>
        <p className="muted">Loading question paper…</p>
      </Shell>
    );
  }

  if (attempt?.result) {
    return <ResultView exam={exam} candidate={candidate} result={attempt.result} />;
  }

  if (!attempt) {
    return (
      <Shell>
        <Instructions
          exam={exam}
          candidate={candidate}
          onStart={() =>
            setAttempt({ startedAt: Date.now(), responses: {}, marked: [], visited: [exam.questions[0]?.questionNumber ?? 1], current: 0 })
          }
        />
      </Shell>
    );
  }

  return <ExamRunner exam={exam} candidate={candidate} attempt={attempt} setAttempt={setAttempt} />;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main className="center-stage">{children}</main>
      <SiteFooter />
    </>
  );
}

function Instructions({ exam, candidate, onStart }: { exam: Exam; candidate: Candidate; onStart: () => void }) {
  const { test } = exam;
  const [agreed, setAgreed] = useState(false);
  return (
    <div className="card panel">
      <span className="eyebrow">{test.testCode}</span>
      <h1>{test.title}</h1>
      {test.description && <p className="muted" style={{ margin: 0 }}>{test.description}</p>}
      <div className="stats">
        <div><b>{exam.questions.length}</b><span>Questions</span></div>
        <div><b>{test.durationMinutes}</b><span>Minutes</span></div>
        <div><b>+{test.markingScheme.positive}</b><span>Correct</span></div>
        <div><b>−{test.markingScheme.negative}</b><span>Wrong</span></div>
      </div>
      <ol>
        <li>The timer starts when you press <b>Start exam</b> and keeps running if you refresh or close the page.</li>
        <li>Choose an option and press <b>Save &amp; Next</b>. Use <b>Mark for Review</b> to flag a question to revisit.</li>
        <li>Unanswered questions score zero. Each wrong answer deducts {test.markingScheme.negative} mark(s).</li>
        <li>The paper is submitted automatically when time runs out. You can submit only once.</li>
      </ol>
      <p style={{ margin: 0 }}>
        Candidate: <b>{candidate.fullName}</b> · <span className="mono">{candidate.registrationId}</span>
      </p>
      <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
        I have read the instructions and am ready to begin.
      </label>
      <button className="btn btn-red" disabled={!agreed || exam.questions.length === 0} onClick={onStart}>
        {exam.questions.length === 0 ? "No questions uploaded yet" : "Start exam"}
      </button>
    </div>
  );
}

function ExamRunner({
  exam,
  candidate,
  attempt,
  setAttempt,
}: {
  exam: Exam;
  candidate: Candidate;
  attempt: Attempt;
  setAttempt: React.Dispatch<React.SetStateAction<Attempt | null>>;
}) {
  const { test, questions } = exam;
  const totalSeconds = test.durationMinutes * 60;
  const [now, setNow] = useState(() => Date.now());
  const [draft, setDraft] = useState<OptionKey | undefined>(undefined);
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const submittedRef = useRef(false);

  const index = Math.min(attempt.current, questions.length - 1);
  const q = questions[index];
  const key = String(q.questionNumber);
  const elapsed = Math.floor((now - attempt.startedAt) / 1000);
  const remaining = totalSeconds - elapsed;

  useEffect(() => setDraft(attempt.responses[key]), [key, attempt.responses]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const submit = useCallback(async () => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setSubmitting(true);
    setSubmitError("");
    try {
      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: candidate.id,
          testCode: test.testCode,
          responses: attempt.responses,
          timeTakenSeconds: Math.min(Math.floor((Date.now() - attempt.startedAt) / 1000), totalSeconds),
        }),
      });
      const data = await res.json();
      if (!res.ok && !data.alreadySubmitted) throw new Error(data.error ?? "Submission failed.");
      setAttempt((a) => (a ? { ...a, result: data.result } : a));
    } catch (e) {
      submittedRef.current = false;
      setSubmitError(e instanceof Error ? e.message : "Submission failed. Check your connection and retry.");
    } finally {
      setSubmitting(false);
    }
  }, [attempt.responses, attempt.startedAt, candidate.id, setAttempt, test.testCode, totalSeconds]);

  useEffect(() => {
    if (remaining <= 0 && !submittedRef.current) void submit();
  }, [remaining, submit]);

  const update = (fn: (a: Attempt) => Attempt) => setAttempt((a) => (a ? fn(a) : a));

  function goTo(i: number) {
    const target = questions[i];
    if (!target) return;
    update((a) => ({ ...a, current: i, visited: a.visited.includes(target.questionNumber) ? a.visited : [...a.visited, target.questionNumber] }));
  }

  function saveAnd(markForReview: boolean) {
    const n = q.questionNumber;
    update((a) => {
      const responses = { ...a.responses };
      if (draft) responses[key] = draft;
      const marked = markForReview ? Array.from(new Set([...a.marked, n])) : a.marked.filter((m) => m !== n);
      return { ...a, responses, marked };
    });
    if (index < questions.length - 1) goTo(index + 1);
  }

  function clearResponse() {
    setDraft(undefined);
    update((a) => {
      const responses = { ...a.responses };
      delete responses[key];
      return { ...a, responses };
    });
  }

  const statusOf = (n: number) => {
    const answered = Boolean(attempt.responses[String(n)]);
    const marked = attempt.marked.includes(n);
    if (answered && marked) return "answered-marked";
    if (marked) return "marked";
    if (answered) return "answered";
    if (attempt.visited.includes(n)) return "skipped";
    return "";
  };

  const counts = useMemo(() => {
    const c = { answered: 0, marked: 0, skipped: 0, notVisited: 0 };
    for (const { questionNumber: n } of questions) {
      const s = statusOf(n);
      if (s === "answered" || s === "answered-marked") c.answered++;
      if (s === "marked" || s === "answered-marked") c.marked++;
      if (s === "skipped") c.skipped++;
      if (s === "") c.notVisited++;
    }
    return c;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt, questions]);

  const optionText = (o: OptionKey) => ({ A: q.optionA, B: q.optionB, C: q.optionC, D: q.optionD })[o];

  return (
    <div className="exam-shell">
      <div className="exam-bar">
        <div className="title">
          {test.title}
          <small className="mono">{test.testCode}</small>
        </div>
        <div className={`timer mono ${remaining <= 300 ? "low" : ""}`} aria-live="off" title="Time remaining">
          {fmt(remaining)}
        </div>
      </div>
      <div className="exam-body">
        <section className="question-pane">
          <div className="q-head">
            <h2>Question {q.questionNumber}</h2>
            <span className="muted" style={{ fontSize: 13 }}>
              +{test.markingScheme.positive} / −{test.markingScheme.negative}
            </span>
          </div>
          <div className="q-text">{q.questionText}</div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {q.diagramUrl && <img className="q-diagram" src={q.diagramUrl} alt={`Diagram for question ${q.questionNumber}`} />}
          <div className="options" role="radiogroup" aria-label="Options">
            {OPTIONS.map((o) => (
              <button
                type="button"
                role="radio"
                aria-checked={draft === o}
                key={o}
                className={`option ${draft === o ? "selected" : ""}`}
                onClick={() => setDraft(o)}
              >
                <span className="key">{o}</span>
                <span>{optionText(o)}</span>
              </button>
            ))}
          </div>
          <div className="q-actions">
            <button className="btn btn-amber" onClick={() => saveAnd(true)}>Mark for Review &amp; Next</button>
            <button className="btn btn-ghost" onClick={clearResponse}>Clear Response</button>
            <span className="spacer" />
            <button className="btn btn-ghost" disabled={index === 0} onClick={() => goTo(index - 1)}>← Back</button>
            <button className="btn" onClick={() => saveAnd(false)}>Save &amp; Next</button>
          </div>
        </section>
        <aside className="palette-pane">
          <div className="candidate">
            {candidate.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={candidate.photoUrl} alt="" />
            ) : (
              <span className="avatar">{candidate.fullName.slice(0, 1).toUpperCase()}</span>
            )}
            <div>
              <b>{candidate.fullName}</b>
              <div className="mono muted" style={{ fontSize: 12 }}>{candidate.registrationId}</div>
            </div>
          </div>
          <div className="legend">
            <span><i className="dot answered" /> Answered ({counts.answered})</span>
            <span><i className="dot skipped" /> Not answered ({counts.skipped})</span>
            <span><i className="dot" /> Not visited ({counts.notVisited})</span>
            <span><i className="dot marked" /> Marked ({counts.marked})</span>
          </div>
          <div className="palette">
            {questions.map((item, i) => (
              <button
                key={item.questionNumber}
                className={`pal ${statusOf(item.questionNumber)} ${i === index ? "current" : ""}`}
                onClick={() => goTo(i)}
                aria-label={`Question ${item.questionNumber}`}
              >
                {item.questionNumber}
              </button>
            ))}
          </div>
          <button className="btn btn-red" style={{ marginTop: "auto" }} onClick={() => setConfirming(true)}>
            Submit exam
          </button>
        </aside>
      </div>

      {(confirming || submitting || submitError) && (
        <div className="modal-back" role="dialog" aria-modal="true">
          <div className="card panel" style={{ width: "min(480px, 100%)" }}>
            <h1 style={{ fontSize: 32 }}>{remaining <= 0 ? "Time is up" : "Submit your exam?"}</h1>
            <div className="stats" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
              <div><b>{counts.answered}</b><span>Answered</span></div>
              <div><b>{questions.length - counts.answered}</b><span>Unanswered</span></div>
              <div><b>{counts.marked}</b><span>Marked</span></div>
            </div>
            {submitError && <div className="alert alert-error">{submitError}</div>}
            <div className="row">
              {remaining > 0 && !submitting && (
                <button className="btn btn-ghost" onClick={() => { setConfirming(false); setSubmitError(""); }}>
                  Keep working
                </button>
              )}
              <button className="btn btn-red" disabled={submitting} onClick={() => void submit()}>
                {submitting ? "Grading…" : submitError ? "Retry submission" : "Submit final answers"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

type LeaderRow = { rank: number; fullName: string; score: number; percentage: number; timeTakenSeconds: number };

function ResultView({ exam, candidate, result }: { exam: Exam; candidate: Candidate; result: Result }) {
  const [board, setBoard] = useState<LeaderRow[] | null>(null);
  const [liveRank, setLiveRank] = useState(result.rank);

  useEffect(() => {
    fetch(`/api/leaderboard/${encodeURIComponent(exam.test.testCode)}`)
      .then((r) => r.json())
      .then((d) => setBoard(d.leaderboard ?? []))
      .catch(() => setBoard([]));
    setLiveRank(result.rank);
  }, [exam.test.testCode, result.rank]);

  return (
    <Shell>
      <div className="card panel" style={{ width: "min(860px, 100%)" }}>
        <span className="eyebrow">Result · {exam.test.testCode}</span>
        <h1>{exam.test.title}</h1>
        <div className="rank-banner">
          <div>
            <div style={{ opacity: 0.7, fontSize: 13, textTransform: "uppercase", letterSpacing: ".1em" }}>All-India Rank</div>
            <b>{liveRank ?? "—"}</b>
            <div style={{ opacity: 0.7, fontSize: 13 }}>of {result.totalCandidates} candidates at submission</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ opacity: 0.7, fontSize: 13 }}>{candidate.fullName}</div>
            <div className="mono">{candidate.registrationId}</div>
          </div>
        </div>
        <div className="stats">
          <div><b>{result.score}</b><span>Score / {result.maxScore}</span></div>
          <div><b>{result.percentage}%</b><span>Percentage</span></div>
          <div><b>{result.accuracy}%</b><span>Accuracy</span></div>
          <div><b>{fmt(result.timeTakenSeconds)}</b><span>Time taken</span></div>
        </div>
        <div className="stats" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
          <div><b style={{ color: "var(--green)" }}>{result.correctCount}</b><span>Correct</span></div>
          <div><b style={{ color: "var(--red)" }}>{result.wrongCount}</b><span>Wrong</span></div>
          <div><b>{result.unansweredCount}</b><span>Unanswered</span></div>
        </div>
        <h2 style={{ fontSize: 26 }}>Leaderboard</h2>
        {board === null ? (
          <p className="muted">Loading…</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Rank</th><th>Candidate</th><th>Score</th><th>%</th><th>Time</th></tr>
              </thead>
              <tbody>
                {board.map((row) => (
                  <tr key={row.rank} className={row.rank === liveRank ? "me" : ""}>
                    <td>{row.rank}</td>
                    <td>{row.fullName}</td>
                    <td>{row.score}</td>
                    <td>{row.percentage}</td>
                    <td className="mono">{fmt(row.timeTakenSeconds)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>Ranks update as more candidates submit. Ties are broken by faster completion time.</p>
      </div>
    </Shell>
  );
}
