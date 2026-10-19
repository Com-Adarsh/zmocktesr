"use client";

import { FormEvent, useState } from "react";
import { requestJson } from "@/lib/client-request";

export type EditableTestSettings = {
  id: string;
  title: string;
  instructions: string;
  duration_minutes: number;
  correct_marks: number;
  negative_marks: number;
  attempt_limit: number;
  access_mode: string;
  starts_at: string | null;
  ends_at: string | null;
  release_answers: boolean;
  review_requested_at: string | null;
};

function localDate(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

export default function TestSettingsEditor({
  test,
  canManageAccess,
  onSaved,
}: {
  test: EditableTestSettings;
  canManageAccess: boolean;
  onSaved: (test: EditableTestSettings) => void;
}) {
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const body: Record<string, unknown> = {
      title: form.get("title"),
      instructions: form.get("instructions"),
      duration_minutes: Number(form.get("duration_minutes")),
      correct_marks: Number(form.get("correct_marks")),
      negative_marks: Number(form.get("negative_marks")),
      starts_at: form.get("starts_at"),
      ends_at: form.get("ends_at"),
      release_answers: form.get("release_answers") === "true",
    };
    if (canManageAccess) {
      body.attempt_limit = Number(form.get("attempt_limit"));
      body.access_mode = form.get("access_mode");
    }
    setBusy(true); setError(""); setMessage("");
    const { ok, data } = await requestJson(`/api/tests/${test.id}/settings`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    if (!ok) setError(typeof data.error === "string" ? data.error : "Test settings could not be saved.");
    else {
      onSaved(data.test as EditableTestSettings);
      setMessage("Draft settings saved.");
    }
    setBusy(false);
  }

  return <details><summary>Edit test settings</summary>
    <form className="form card" onSubmit={save}>
      <label>Test title <input name="title" defaultValue={test.title} required maxLength={160} /></label>
      <label>Instructions <textarea name="instructions" defaultValue={test.instructions} maxLength={5000} /></label>
      <label>Duration in minutes <input name="duration_minutes" type="number" min="1" max="1440" defaultValue={test.duration_minutes} required /></label>
      <label>Marks per correct answer <input name="correct_marks" type="number" min="0" step="0.25" defaultValue={test.correct_marks} required /></label>
      <label>Negative marks per incorrect answer <input name="negative_marks" type="number" min="0" step="0.25" defaultValue={test.negative_marks} required /></label>
      {canManageAccess && <>
        <label>Attempt limit <input name="attempt_limit" type="number" min="1" max="100" defaultValue={test.attempt_limit} required /></label>
        <label>Access mode <select name="access_mode" defaultValue={test.access_mode}><option value="code">Test code</option><option value="public">Public</option><option value="assigned">Assigned students</option></select></label>
      </>}
      <label>Availability starts <input name="starts_at" type="datetime-local" defaultValue={localDate(test.starts_at)} /></label>
      <label>Availability ends <input name="ends_at" type="datetime-local" defaultValue={localDate(test.ends_at)} /></label>
      <label><span><input name="release_answers" type="checkbox" value="true" defaultChecked={test.release_answers} /> Release answer review after submission</span></label>
      <button className="button" disabled={busy}>{busy ? "Saving…" : "Save draft settings"}</button>
      {error && <p className="error" role="alert">{error}</p>}
      {message && <p className="success" role="status">{message}</p>}
    </form>
  </details>;
}
