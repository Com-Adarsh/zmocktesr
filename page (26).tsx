import { requireRole } from "@/lib/auth";
import MediatorConsole from "@/components/mediator-console";

export default async function MediatorPage() {
  const { supabase, user } = await requireRole(["mediator"]);
  const { data: assignments, error: assignmentError } = await supabase.from("mediator_assignments")
    .select("courses(id, title, slug)").eq("mediator_id", user.id);
  if (assignmentError) throw new Error(`Unable to load assigned courses: ${assignmentError.message}`);
  const courses = (assignments ?? []).flatMap((item) => Array.isArray(item.courses) ? item.courses : item.courses ? [item.courses] : []);
  const { data: tests, error: testError } = await supabase.from("tests")
    .select("id, title, instructions, duration_minutes, correct_marks, negative_marks, attempt_limit, access_mode, starts_at, ends_at, release_answers, test_code, is_published, is_archived, review_requested_at").eq("created_by", user.id).order("created_at", { ascending: false });
  if (testError) throw new Error(`Unable to load mediator tests: ${testError.message}`);

  return <main className="container">
    <section className="page-heading"><p className="eyebrow">Mediator</p><h1>Question-paper workspace</h1><p>You can create and upload drafts only for courses assigned to your account. Publication requires administrator review.</p></section>
    <MediatorConsole courses={courses} initialTests={tests ?? []} />
  </main>;
}
