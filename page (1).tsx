import { requireRole } from "@/lib/auth";

export default async function AdminReportsPage() {
  const { supabase } = await requireRole(["admin"]);
  const { data: attempts, error } = await supabase.from("attempts")
    .select("id, student_id, status, score, maximum_score, correct_count, incorrect_count, unanswered_count, elapsed_seconds, submitted_at, tests(title)")
    .order("started_at", { ascending: false }).limit(100);
  if (error) throw new Error(`Unable to load attempt reports: ${error.message}`);

  return <main className="container">
    <section className="page-heading"><p className="eyebrow">Administrator</p><h1>Attempt reports</h1><p>Recent attempt records from this platform. This report contains only real submitted data.</p></section>
    {!attempts?.length ? <div className="empty-state"><strong>No attempts have been recorded.</strong></div> :
      <section className="section table-wrap"><table><thead><tr><th>Test</th><th>Student ID</th><th>Status</th><th>Score</th><th>Correct / wrong / blank</th><th>Time</th></tr></thead><tbody>
        {attempts.map((attempt) => <tr key={attempt.id}>
          <td>{(attempt.tests as { title: string }[] | null)?.[0]?.title ?? "Mock test"}</td><td><code>{attempt.student_id}</code></td>
          <td>{attempt.status}</td><td>{attempt.status === "submitted" ? `${attempt.score} / ${attempt.maximum_score}` : "—"}</td>
          <td>{attempt.correct_count ?? "—"} / {attempt.incorrect_count ?? "—"} / {attempt.unanswered_count ?? "—"}</td>
          <td>{attempt.elapsed_seconds === null ? "—" : `${Math.floor(attempt.elapsed_seconds / 60)}m ${attempt.elapsed_seconds % 60}s`}</td>
        </tr>)}
      </tbody></table></section>}
  </main>;
}
