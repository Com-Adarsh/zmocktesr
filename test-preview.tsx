"use client";

import { useState } from "react";
import { requestJson } from "@/lib/client-request";

type Question = {
  id: string;
  position: number;
  question_text: string;
  question_type: string;
  options: string[];
  marks: number | null;
  negative_marks: number | null;
  explanation: string | null;
  section: string | null;
  answer: unknown;
};

export default function TestPreview({ testId }: { testId: string }) {
  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function load() {
    setBusy(true); setError("");
    const { ok, data } = await requestJson(`/api/admin/tests/${testId}/questions`);
    if (!ok) setError(typeof data.error === "string" ? data.error : "Unable to preview questions.");
    else setQuestions(data.questions as Question[]);
    setBusy(false);
  }
  return <div>
    <button className="button secondary" type="button" onClick={() => void load()} disabled={busy}>{busy ? "Loading…" : questions ? "Refresh preview" : "Preview paper"}</button>
    {error && <p className="error" role="alert">{error}</p>}
    {questions && <div className="test-list" style={{ marginTop: 14 }}>{questions.map((question) =>
      <article className="card" key={question.id}>
        <p className="eyebrow">Question {question.position}{question.section ? ` · ${question.section}` : ""} · {question.question_type}</p>
        <h3>{question.question_text}</h3>
        {question.options.map((option) => <p key={option}>{option}{JSON.stringify(question.answer) === JSON.stringify(option) ? " ✓" : ""}</p>)}
        <p>Answer key: <strong>{JSON.stringify(question.answer)}</strong></p>
        <p className="form-hint">Marks: {question.marks ?? "test default"} · Negative marks: {question.negative_marks ?? "test default"}</p>
        {question.explanation && <p>{question.explanation}</p>}
      </article>)}</div>}
  </div>;
}
