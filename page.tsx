import { requireRole } from "@/lib/auth";
import AdminConsole from "@/components/admin-console";
import Link from "next/link";

export default async function AdminPage() {
  const { supabase } = await requireRole(["admin"]);
  const [{ data: courses, error: courseError }, { data: tests, error: testError }, { data: mediators, error: mediatorError }, { data: students, error: studentError }] = await Promise.all([
    supabase.from("courses").select("id, title, slug, is_published, is_archived").order("title"),
    supabase.from("tests").select("id, title, instructions, duration_minutes, correct_marks, negative_marks, attempt_limit, access_mode, starts_at, ends_at, release_answers, test_code, is_published, is_archived, review_requested_at, courses(title)").order("created_at", { ascending: false }),
    supabase.from("profiles").select("id, display_name").eq("role", "mediator").order("created_at", { ascending: false }),
    supabase.from("profiles").select("id, display_name").eq("role", "student").order("created_at", { ascending: false }),
  ]);
  if (courseError) throw new Error(`Unable to load courses: ${courseError.message}`);
  if (testError) throw new Error(`Unable to load tests: ${testError.message}`);
  if (mediatorError) throw new Error(`Unable to load mediators: ${mediatorError.message}`);
  if (studentError) throw new Error(`Unable to load student accounts: ${studentError.message}`);
  const { data: assignments, error: assignmentError } = await supabase.from("mediator_assignments")
    .select("mediator_id, courses(id, title)");
  if (assignmentError) throw new Error(`Unable to load mediator assignments: ${assignmentError.message}`);
  const mediatorRows = (mediators ?? []).map((mediator) => ({
    ...mediator,
    courses: (assignments ?? []).filter((assignment) => assignment.mediator_id === mediator.id)
      .flatMap((assignment) => Array.isArray(assignment.courses) ? assignment.courses : assignment.courses ? [assignment.courses] : []),
  }));
  return <main className="container">
    <section className="page-heading"><p className="eyebrow">Administrator</p><h1>Platform management</h1><p>Manage courses, drafts and mediator invitations. Student answer keys remain protected by database policies.</p></section>
    <p><Link className="button secondary" href="/admin/reports">View attempt reports</Link></p>
    <AdminConsole initialCourses={courses ?? []} initialTests={tests ?? []} initialMediators={mediatorRows} students={students ?? []} />
  </main>;
}
