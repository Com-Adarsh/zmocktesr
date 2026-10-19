"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { requestJson } from "@/lib/client-request";
import TestSettingsEditor, { type EditableTestSettings } from "@/components/test-settings-editor";

type Course = { id: string; title: string; slug: string };
type Test = EditableTestSettings & { test_code: string; is_published: boolean; is_archived: boolean };

export default function MediatorConsole({ courses, initialTests }: { courses: Course[]; initialTests: Test[] }) {
  const [tests, setTests] = useState(initialTests);
  const [selectedTest, setSelectedTest] = useState("");
  const [uploadText, setUploadText] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function requestReview(testId: string) {
    setBusy(true); setStatus(""); setError("");
    const { ok, data } = await requestJson(`/api/mediator/tests/${testId}/review`, { method: "POST" });
    if (!ok) setError(typeof data.error === "string" ? data.error : "Review request could not be submitted.");
    else {
      setTests(tests.map((test) => test.id === testId ? { ...test, review_requested_at: String(data.review_requested_at) } : test));
      setStatus("Test submitted for administrator review.");
    }
    setBusy(false);
  }

  async function createTest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setBusy(true); setStatus(""); setError("");
    const body: Record<string, unknown> = Object.fromEntries(new FormData(event.currentTarget).entries());
    body.duration_minutes = Number(body.duration_minutes);
    body.correct_marks = Number(body.correct_marks);
    body.negative_marks = Number(body.negative_marks);
    body.release_answers = body.release_answers === "true";
    for (const field of ["starts_at", "ends_at"]) {
      if (typeof body[field] === "string" && body[field]) body[field] = new Date(body[field]).toISOString();
    }
    const { ok, data } = await requestJson("/api/mediator/tests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!ok) setError(typeof data.error === "string" ? data.error : "Test draft could not be created.");
    else {
      const item = { ...(data.test as Test), is_published: false, is_archived: false, review_requested_at: null };
      setTests([item, ...tests]); setSelectedTest(item.id); setStatus("Test draft created.");
      formElement.reset();
    }
    setBusy(false);
  }

  async function importQuestions(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setBusy(true); setStatus(""); setError("");
    const replace = formData.get("replace_existing") === "true";
    if (replace && !window.confirm("This replaces every question currently in the selected draft. Continue?")) {
      setBusy(false);
      return;
    }
    let questions: unknown;
    try { questions = JSON.parse(uploadText); } catch { setError("Upload content must be a valid JSON array."); setBusy(false); return; }
    const { ok, data } = await requestJson(`/api/tests/${selectedTest}/questions`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename: "question-import.json", questions, replace_existing: replace }),
    });
    if (!ok) setError([data.error, ...(Array.isArray(data.details) ? data.details : [])].filter(Boolean).join("\n"));
    else {
      setTests(tests.map((test) => test.id === selectedTest ? { ...test, review_requested_at: null } : test));
      setStatus(`${data.question_count} questions imported into the selected draft.`);
    }
    setBusy(false);
  }

  return <>
    {status && <p role="status" className="success">{status}</p>}
    {error && <pre className="error" role="alert">{error}</pre>}
    <section className="section">
      <h2>Create a test draft</h2>
      {!courses.length && <div className="notice">No courses have been assigned to this mediator account. Ask an administrator to grant course access.</div>}
      <form className="form" onSubmit={createTest}>
        <label>Assigned course <select name="course_id" required defaultValue=""><option value="" disabled>Select a course</option>{courses.map((course) => <option value={course.id} key={course.id}>{course.title}</option>)}</select></label>
        <label>Test title <input name="title" required maxLength={160} /></label>
        <label>Instructions <textarea name="instructions" maxLength={5000} /></label>
        <label>Duration in minutes <input name="duration_minutes" type="number" min="1" max="1440" defaultValue="60" required /></label>
        <label>Marks per correct answer <input name="correct_marks" type="number" min="0" step="0.25" defaultValue="4" /></label>
        <label>Negative marks per incorrect answer <input name="negative_marks" type="number" min="0" step="0.25" defaultValue="0" /></label>
        <label>Availability starts <input name="starts_at" type="datetime-local" /></label>
        <label>Availability ends <input name="ends_at" type="datetime-local" /></label>
        <label><span><input name="release_answers" type="checkbox" value="true" /> Release answer review after submission</span></label>
        <button className="button" disabled={busy || !courses.length}>Create private draft</button>
      </form>
    </section>
    <section className="section">
      <h2>Upload question JSON</h2>
      <p className="form-hint">Question uploads are drafts. Import is validated and transactional; nothing is published automatically.</p>
      <p><a className="text-link" href="/question-template.json" download>Download JSON template</a></p>
      <form className="form" onSubmit={importQuestions}>
        <label>Select your test draft <select value={selectedTest} onChange={(event) => setSelectedTest(event.target.value)} required>
          <option value="">Select a test</option>{tests.filter((test) => !test.is_published).map((test) => <option key={test.id} value={test.id}>{test.title} ({test.test_code})</option>)}
        </select></label>
        <label>Paste JSON question array <textarea value={uploadText} onChange={(event) => setUploadText(event.target.value)} required spellCheck={false} /></label>
        <label><span><input name="replace_existing" type="checkbox" value="true" /> Replace all existing questions in this draft</span></label>
        <button className="button" disabled={busy || !selectedTest}>Validate and import</button>
      </form>
    </section>
    <section className="section">
      <h2>Your tests</h2>
      {!tests.length ? <div className="empty-state"><strong>No test drafts yet.</strong></div> : <div className="test-list">{tests.map((test) =>
        <article className="test-row" key={test.id}><div><h2>{test.title}</h2><p>Code: <code>{test.test_code}</code> · {test.is_published ? "Published" : "Draft"}</p>{!test.is_published && !test.is_archived && <TestSettingsEditor test={test} canManageAccess={false} onSaved={(updated) => setTests(tests.map((item) => item.id === test.id ? { ...item, ...updated } : item))} />}</div>
          {test.is_published ? <span className="status-badge">Published by admin</span> : test.review_requested_at ? <span className="status-badge">Review requested</span> : <button className="button secondary" type="button" disabled={busy} onClick={() => void requestReview(test.id)}>Submit for review</button>}
        </article>)}</div>}
    </section>
    <Link className="text-link" href="/dashboard">Back to student dashboard</Link>
  </>;
}
