"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { type Candidate, loadCandidate, saveCandidate } from "@/lib/candidate";

type Course = { id: number; courseName: string; level: string };

export function RegisterForm() {
  const router = useRouter();
  const [courses, setCourses] = useState<Course[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [registered, setRegistered] = useState<{ student: Candidate; returning: boolean; testTitle: string } | null>(null);
  const [saved, setSaved] = useState<Candidate | null>(null);

  useEffect(() => {
    setSaved(loadCandidate());
    fetch("/api/courses")
      .then((r) => (r.ok ? r.json() : { courses: [] }))
      .then((d) => setCourses(d.courses ?? []))
      .catch(() => setCourses([]));
  }, []);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(form)),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Registration failed.");
      saveCandidate(data.student);
      setRegistered({ student: data.student, returning: data.returning, testTitle: data.test.title });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Registration failed.");
    } finally {
      setBusy(false);
    }
  }

  if (registered) {
    const { student } = registered;
    return (
      <div className="card register-card" id="register">
        <span className="eyebrow">{registered.returning ? "Welcome back" : "Registration complete"}</span>
        <h2>{student.fullName}</h2>
        <div className="slip">
          <span className="muted">Registration ID — keep this safe</span>
          <span className="reg mono">{student.registrationId}</span>
          <span className="muted">
            Test: <b>{registered.testTitle}</b> ({student.testCode})
          </span>
        </div>
        <button className="btn btn-red" onClick={() => router.push(`/exam/${encodeURIComponent(student.testCode ?? "")}`)}>
          Continue to exam instructions →
        </button>
        <button className="btn btn-ghost" onClick={() => setRegistered(null)}>
          Register a different candidate
        </button>
      </div>
    );
  }

  const ug = courses.filter((c) => c.level !== "PG");
  const pg = courses.filter((c) => c.level === "PG");

  return (
    <form className="card register-card" id="register" onSubmit={onSubmit}>
      <h2>Candidate registration</h2>
      <p className="muted" style={{ margin: 0, fontSize: 14 }}>
        Already registered? Enter the same email — your details are reused and your test assignment is updated.
      </p>
      {saved?.testCode && (
        <a className="btn btn-ghost btn-sm" href={`/exam/${encodeURIComponent(saved.testCode)}`}>
          Resume as {saved.fullName} ({saved.registrationId})
        </a>
      )}
      <label className="field">
        Full name
        <input className="input" name="fullName" autoComplete="name" maxLength={120} />
      </label>
      <div className="grid-2">
        <label className="field">
          Email
          <input className="input" name="email" type="email" autoComplete="email" required maxLength={254} />
        </label>
        <label className="field">
          Phone
          <input className="input" name="phone" type="tel" autoComplete="tel" maxLength={20} />
        </label>
      </div>
      <label className="field">
        Course preference
        <select className="input" name="coursePreference" defaultValue="">
          <option value="">— Select a course —</option>
          {ug.length > 0 && (
            <optgroup label="Undergraduate">
              {ug.map((c) => (
                <option key={c.id}>{c.courseName}</option>
              ))}
            </optgroup>
          )}
          {pg.length > 0 && (
            <optgroup label="Postgraduate">
              {pg.map((c) => (
                <option key={c.id}>{c.courseName}</option>
              ))}
            </optgroup>
          )}
        </select>
      </label>
      <label className="field">
        Photo URL <span className="hint">Optional — shown on your exam screen</span>
        <input className="input" name="photoUrl" type="url" placeholder="https://…" maxLength={1000} />
      </label>
      <label className="field">
        Test code
        <input className="input mono" name="testCode" required maxLength={64} placeholder="e.g. CUSAT-CAT-01" style={{ textTransform: "uppercase" }} />
      </label>
      {error && <div className="alert alert-error" role="alert">{error}</div>}
      <button className="btn btn-red" disabled={busy}>
        {busy ? "Checking…" : "Register & continue"}
      </button>
    </form>
  );
}
