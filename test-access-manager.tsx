"use client";

import { useEffect, useState } from "react";
import { requestJson } from "@/lib/client-request";

type Student = { id: string; display_name: string | null };

export default function TestAccessManager({ testId, students }: { testId: string; students: Student[] }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    requestJson(`/api/admin/tests/${testId}/access`).then(({ ok, data }) => {
      if (!ok) throw new Error(typeof data.error === "string" ? data.error : "Unable to load assigned students.");
      setSelected(data.student_ids as string[]);
    }).catch((cause: Error) => setError(cause.message));
  }, [testId]);

  async function save() {
    setBusy(true); setError(""); setMessage("");
    const { ok, data } = await requestJson(`/api/admin/tests/${testId}/access`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ student_ids: selected }),
    });
    if (!ok) setError(typeof data.error === "string" ? data.error : "Assignments could not be saved.");
    else setMessage(`${data.assigned_count} student account(s) assigned.`);
    setBusy(false);
  }

  return <div className="card">
    <p className="form-hint">Only selected student accounts can view or start this assigned-access test.</p>
    <label>Assigned students
      <select multiple size={Math.min(Math.max(students.length, 3), 8)} value={selected} onChange={(event) =>
        setSelected(Array.from(event.currentTarget.selectedOptions, (option) => option.value))}>
        {students.map((student) => <option key={student.id} value={student.id}>{student.display_name || student.id}</option>)}
      </select>
    </label>
    <button className="button" type="button" onClick={() => void save()} disabled={busy}>{busy ? "Saving…" : "Save student access"}</button>
    {error && <p className="error" role="alert">{error}</p>}
    {message && <p className="success" role="status">{message}</p>}
  </div>;
}
