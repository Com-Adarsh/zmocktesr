"use client";

import { FormEvent, useState } from "react";
import TestPreview from "@/components/test-preview";
import TestAccessManager from "@/components/test-access-manager";
import MediatorAssignmentManager from "@/components/mediator-assignment-manager";
import { requestJson } from "@/lib/client-request";
import TestSettingsEditor, { type EditableTestSettings } from "@/components/test-settings-editor";

type Course = { id: string; title: string; slug: string; is_published: boolean; is_archived: boolean };
type Test = EditableTestSettings & { test_code: string; is_published: boolean; is_archived: boolean; courses: { title: string } | { title: string }[] | null };
type Mediator = { id: string; display_name: string | null; courses: { id: string; title: string }[] };
type Student = { id: string; display_name: string | null };

export default function AdminConsole({ initialCourses, initialTests, initialMediators, students }: { initialCourses: Course[]; initialTests: Test[]; initialMediators: Mediator[]; students: Student[] }) {
  const [courses, setCourses] = useState(initialCourses);
  const [tests, setTests] = useState(initialTests);
  const [mediators, setMediators] = useState(initialMediators);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function send(event: FormEvent<HTMLFormElement>, endpoint: string, onSuccess: (data: Record<string, unknown>) => void) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setMessage("");
    setError("");
    setBusy(true);
    const form = new FormData(event.currentTarget);
    const body: Record<string, unknown> = Object.fromEntries(form.entries());
    if (endpoint === "/api/admin/invitations") body.course_ids = form.getAll("course_ids");
    if (endpoint === "/api/admin/tests") {
      for (const field of ["duration_minutes", "correct_marks", "negative_marks", "attempt_limit"]) body[field] = Number(body[field]);
      body.release_answers = form.get("release_answers") === "true";
      for (const field of ["starts_at", "ends_at"]) {
        if (typeof body[field] === "string" && body[field]) body[field] = new Date(body[field]).toISOString();
      }
    }
    const { ok, data } = await requestJson(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!ok) setError(typeof data.error === "string" ? data.error : "Request failed.");
    else { onSuccess(data); setMessage("Saved successfully."); formElement.reset(); }
    setBusy(false);
  }

  async function publish(testId: string) {
    setError("");
    const { ok, data } = await requestJson(`/api/admin/tests/${testId}/publish`, { method: "POST" });
    if (!ok) setError(typeof data.error === "string" ? data.error : "Test could not be published.");
    else {
      setTests(tests.map((item) => item.id === testId ? { ...item, is_published: true } : item));
      setMessage("Test published.");
    }
  }

  async function updateStatus(kind: "courses" | "tests", id: string, action: "publish" | "unpublish" | "archive" | "restore") {
    const endpoint = kind === "courses" ? `/api/admin/courses/${id}/status` : `/api/admin/tests/${id}/status`;
    const { ok, data } = await requestJson(endpoint, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }),
    });
    if (!ok) setError(typeof data.error === "string" ? data.error : "Status could not be updated.");
    else {
      if (kind === "courses") {
        const updated = data.course as Pick<Course, "is_published" | "is_archived">;
        setCourses(courses.map((course) => course.id === id ? { ...course, ...updated } : course));
      } else {
        const updated = data.test as Pick<Test, "is_published" | "is_archived">;
        setTests(tests.map((test) => test.id === id ? { ...test, ...updated } : test));
      }
      const label = action === "publish" ? "published" : action === "unpublish" ? "unpublished" : action === "archive" ? "archived" : "restored as a draft";
      setMessage(`${kind === "courses" ? "Course" : "Test"} ${label}.`);
    }
  }

  async function rotateCode(testId: string) {
    if (!window.confirm("The old test code will stop working. Continue?")) return;
    const { ok, data } = await requestJson(`/api/admin/tests/${testId}/code`, { method: "POST" });
    if (!ok) setError(typeof data.error === "string" ? data.error : "Test code could not be changed.");
    else {
      const updated = data.test as { test_code: string };
      setTests(tests.map((test) => test.id === testId ? { ...test, test_code: updated.test_code } : test));
      setMessage("Test code regenerated. Share the new code only with authorised students.");
    }
  }

  async function revokeMediator(mediatorId: string) {
    if (!window.confirm("Remove this mediator's course assignments and restore student-level access?")) return;
    const { ok, data } = await requestJson(`/api/admin/mediators/${mediatorId}`, { method: "DELETE" });
    if (!ok) setError(typeof data.error === "string" ? data.error : "Mediator access could not be revoked.");
    else {
      setMediators(mediators.filter((mediator) => mediator.id !== mediatorId));
      setMessage("Mediator access revoked.");
    }
  }

  return <>
    <div className="role-actions">{message && <p className="success" role="status">{message}</p>}{error && <p className="error" role="alert">{error}</p>}</div>
    <section className="section">
      <h2>Create course</h2>
      <form className="form" onSubmit={(event) => send(event, "/api/admin/courses", (data) => setCourses([...courses, { ...(data.course as Course), is_published: false, is_archived: false }]))}>
        <label>Course title <input name="title" required maxLength={120} /></label>
        <label>Course URL slug <input name="slug" required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" placeholder="cusat-cat" /></label>
        <label>Description <textarea name="description" maxLength={1000} /></label>
        <button className="button" disabled={busy}>Create course</button>
      </form>
    </section>
    <section className="section">
      <h2>Courses</h2>
      {!courses.length ? <div className="empty-state"><strong>No courses yet.</strong></div> :
        <div className="table-wrap"><table><thead><tr><th>Course</th><th>Slug</th><th>Status</th><th>Action</th></tr></thead><tbody>
          {courses.map((course) => <tr key={course.id}><td>{course.title}</td><td><code>{course.slug}</code></td><td>{course.is_archived ? "Archived" : course.is_published ? "Published" : "Draft"}</td><td>
            {course.is_archived ? <button className="button" type="button" onClick={() => void updateStatus("courses", course.id, "restore")}>Restore draft</button> :
              <><button className="button secondary" type="button" onClick={() => void updateStatus("courses", course.id, course.is_published ? "unpublish" : "publish")}>{course.is_published ? "Unpublish" : "Publish"}</button>{" "}<button className="button secondary" type="button" onClick={() => void updateStatus("courses", course.id, "archive")}>Archive</button></>}
          </td></tr>)}
        </tbody></table></div>}
    </section>
    <section className="section">
      <h2>Create test draft</h2>
      <form className="form" onSubmit={(event) => send(event, "/api/admin/tests", (data) => {
        const created = data.test as Test;
        setTests([{ ...created, is_published: false, is_archived: false, review_requested_at: null, courses: null }, ...tests]);
      })}>
        <label>Course <select name="course_id" required defaultValue=""><option value="" disabled>Select a course</option>{courses.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}</select></label>
        <label>Test title <input name="title" required maxLength={160} /></label>
        <label>Instructions <textarea name="instructions" maxLength={5000} /></label>
        <label>Duration in minutes <input name="duration_minutes" type="number" min="1" max="1440" defaultValue="60" required /></label>
        <label>Marks per correct answer <input name="correct_marks" type="number" min="0" step="0.25" defaultValue="4" required /></label>
        <label>Negative marks per incorrect answer <input name="negative_marks" type="number" min="0" step="0.25" defaultValue="0" required /></label>
        <label>Attempt limit <input name="attempt_limit" type="number" min="1" max="100" defaultValue="1" required /></label>
        <label>Availability starts <input name="starts_at" type="datetime-local" /></label>
        <label>Availability ends <input name="ends_at" type="datetime-local" /></label>
        <label>Access mode <select name="access_mode"><option value="code">Test code</option><option value="public">Public</option><option value="assigned">Assigned students</option></select></label>
        <label><span><input name="release_answers" type="checkbox" value="true" /> Release answer review after submission</span></label>
        <button className="button" disabled={busy}>Create draft</button>
      </form>
    </section>
    <section className="section">
      <h2>Invite mediator</h2>
      <p className="muted">The invited account can manage only its assigned courses. Supabase email invitations must be configured.</p>
      <form className="form" onSubmit={(event) => send(event, "/api/admin/invitations", (data) => setMessage(`Mediator invitation sent. User ID: ${String(data.user_id)}`))}>
        <label>Name <input name="display_name" required maxLength={120} /></label>
        <label>Email <input name="email" type="email" required /></label>
        <label>Assign courses <select name="course_ids" multiple required size={Math.min(Math.max(courses.length, 2), 6)}>{courses.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}</select></label>
        <p className="form-hint">Use Ctrl (Windows/Linux) or Command (Mac) to choose multiple courses.</p>
        <button className="button" disabled={busy}>Invite mediator</button>
      </form>
    </section>
    <section className="section">
      <h2>Mediator access</h2>
      {!mediators.length ? <div className="empty-state"><strong>No mediator accounts.</strong></div> :
        <div className="table-wrap"><table><thead><tr><th>Account</th><th>Assigned courses</th><th>Access</th></tr></thead><tbody>
          {mediators.map((mediator) => <tr key={mediator.id}><td>{mediator.display_name || mediator.id}</td><td>{mediator.courses.map((course) => course.title).join(", ") || "No courses assigned"}<MediatorAssignmentManager mediatorId={mediator.id} courses={courses} /></td><td><button type="button" className="button secondary" onClick={() => void revokeMediator(mediator.id)}>Revoke access</button></td></tr>)}
        </tbody></table></div>}
    </section>
    <section className="section">
      <h2>Tests</h2>
      {!tests.length ? <div className="empty-state"><strong>No tests yet.</strong></div> :
        <div className="table-wrap"><table><thead><tr><th>Test</th><th>Course</th><th>Code</th><th>Status</th><th>Action</th></tr></thead><tbody>
          {tests.map((test) => <tr key={test.id}><td>{test.title}{!test.is_published && !test.is_archived && <TestSettingsEditor test={test} canManageAccess onSaved={(updated) => setTests(tests.map((item) => item.id === test.id ? { ...item, ...updated } : item))} />}<details><summary>Review paper</summary><TestPreview testId={test.id} /></details>{test.access_mode === "assigned" && <details><summary>Assigned students</summary><TestAccessManager testId={test.id} students={students} /></details>}</td><td>{Array.isArray(test.courses) ? test.courses[0]?.title ?? "—" : test.courses?.title ?? "—"}</td><td><code>{test.test_code}</code><br /><button type="button" className="text-link" onClick={() => void rotateCode(test.id)}>Regenerate code</button></td><td>{test.is_archived ? "Archived" : test.is_published ? "Published" : test.review_requested_at ? "Review requested" : "Draft"}</td><td>
            {test.is_archived ? <button className="button" type="button" onClick={() => void updateStatus("tests", test.id, "restore")}>Restore draft</button> :
              <>{!test.is_published && <button className="button" type="button" onClick={() => void publish(test.id)}>Publish after review</button>}{" "}<button className="button secondary" type="button" onClick={() => void updateStatus("tests", test.id, test.is_published ? "unpublish" : "archive")}>{test.is_published ? "Unpublish" : "Archive"}</button></>}
          </td></tr>)}
        </tbody></table></div>}
    </section>
  </>;
}
