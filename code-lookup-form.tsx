"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type TestLookup = {
  id: string;
  title: string;
  course_title: string;
  duration_minutes: number;
  question_count: number;
  correct_marks: number;
  negative_marks: number;
  instructions: string;
};

export default function CodeLookupForm({ initialCode = "" }: { initialCode?: string }) {
  const [test, setTest] = useState<TestLookup | null>(null);
  const [enteredCode, setEnteredCode] = useState(initialCode);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function lookup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setTest(null);
    setBusy(true);
    const code = new FormData(event.currentTarget).get("code");
    setEnteredCode(String(code ?? ""));
    try {
      const response = await fetch(`/api/test-code?code=${encodeURIComponent(String(code ?? ""))}`);
      const data = await response.json();
      if (!response.ok) setError(data.error ?? "Test could not be found.");
      else setTest(data.test as TestLookup);
    } catch {
      setError("Test lookup failed because the network request could not be completed.");
    } finally {
      setBusy(false);
    }
  }

  async function start() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/attempts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: enteredCode }),
      });
      const data = await response.json();
      if (response.status === 401) router.push(`/login?next=${encodeURIComponent(`/enter-test?code=${enteredCode}`)}`);
      else if (!response.ok) setError(data.error ?? "Unable to start this test.");
      else router.push(`/test/${data.attempt_id}`);
    } catch {
      setError("The test could not be started because the network request failed.");
    } finally {
      setBusy(false);
    }
  }

  return <>
    <form id="test-code-form" className="form" onSubmit={lookup}>
      <label>Test code <input name="code" defaultValue={initialCode} required autoCapitalize="characters" autoComplete="off" /></label>
      <button className="button" type="submit" disabled={busy}>Find test</button>
    </form>
    {error && <p role="alert" className="error">{error}</p>}
    {test && <article className="card" style={{ marginTop: 24 }}>
      <p className="eyebrow">{test.course_title}</p>
      <h2>{test.title}</h2>
      <p>{test.duration_minutes} minutes · {test.question_count} questions</p>
      <p>Scoring: +{test.correct_marks} for correct and −{test.negative_marks} for incorrect answers.</p>
      {test.instructions && <p>{test.instructions}</p>}
      <p className="form-hint">You must sign in to start. Your attempt and score are recorded against your student account.</p>
      <button className="button" type="button" onClick={start} disabled={busy}>Start test</button>
    </article>}
    {initialCode && !test && <p className="form-hint">Code lookup only returns tests that are published and currently available.</p>}
    <p className="form-hint"><Link href="/courses">Or browse published courses</Link></p>
  </>;
}
