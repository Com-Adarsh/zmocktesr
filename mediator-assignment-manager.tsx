"use client";

import { useEffect, useState } from "react";
import { requestJson } from "@/lib/client-request";

type Course = { id: string; title: string };

export default function MediatorAssignmentManager({ mediatorId, courses }: { mediatorId: string; courses: Course[] }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    requestJson(`/api/admin/mediators/${mediatorId}/assignments`).then(({ ok, data }) => {
      if (!ok) throw new Error(typeof data.error === "string" ? data.error : "Unable to load mediator assignments.");
      setSelected(data.course_ids as string[]);
    }).catch((cause: Error) => setError(cause.message));
  }, [mediatorId]);

  async function save() {
    setBusy(true); setError(""); setMessage("");
    const { ok, data } = await requestJson(`/api/admin/mediators/${mediatorId}/assignments`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ course_ids: selected }),
    });
    if (!ok) setError(typeof data.error === "string" ? data.error : "Course assignments could not be saved.");
    else setMessage(`${data.assigned_count} course(s) assigned.`);
    setBusy(false);
  }

  return <details><summary>Change course assignments</summary>
    <div className="card">
      <label>Assigned courses <select multiple size={Math.min(Math.max(courses.length, 3), 8)} value={selected}
        onChange={(event) => setSelected(Array.from(event.currentTarget.selectedOptions, (option) => option.value))}>
        {courses.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}
      </select></label>
      <button className="button" type="button" onClick={() => void save()} disabled={busy}>{busy ? "Saving…" : "Save assignments"}</button>
      {error && <p className="error" role="alert">{error}</p>}
      {message && <p className="success" role="status">{message}</p>}
    </div>
  </details>;
}
