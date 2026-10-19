import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import SignOutButton from "@/components/sign-out-button";

export default async function DashboardPage() {
  const session = await getCurrentUser();
  if (!session) redirect("/login");
  const { data: profile, error: profileError } = await session.supabase
    .from("profiles").select("role, display_name").eq("id", session.user.id).single();
  if (profileError) throw new Error(`Unable to load profile: ${profileError.message}`);
  const { data: attempts, error } = await session.supabase.from("attempts")
    .select("id, status, score, maximum_score, started_at, tests(title)")
    .eq("student_id", session.user.id).order("started_at", { ascending: false }).limit(25);
  if (error) throw new Error(`Unable to load attempt history: ${error.message}`);

  return <main className="container">
    <section className="page-heading"><p className="eyebrow">Student dashboard</p><h1>Hello{profile.display_name ? `, ${profile.display_name}` : ""}</h1><p>Your mock-test attempts and results.</p></section>
    <div className="role-actions">
      {profile.role === "admin" && <Link className="button" href="/admin">Admin dashboard</Link>}
      {profile.role === "mediator" && <Link className="button" href="/mediator">Mediator dashboard</Link>}
      <SignOutButton />
    </div>
    <section className="section">
      <h2>Attempt history</h2>
      {!attempts?.length ? <div className="empty-state"><strong>No attempts yet.</strong><p>Browse published courses or enter a test code to begin.</p></div> :
        <div className="test-list">{attempts.map((attempt) => <article className="test-row" key={attempt.id}>
          <div><h2>{(attempt.tests as { title: string }[] | null)?.[0]?.title ?? "Mock test"}</h2>
            <p><span className="status-badge">{attempt.status}</span>{attempt.status === "submitted" ? ` · Score ${attempt.score} / ${attempt.maximum_score}` : ""}</p></div>
          {attempt.status === "submitted" ? <Link className="button secondary" href={`/result/${attempt.id}`}>View result</Link> : <Link className="button" href={`/test/${attempt.id}`}>Resume test</Link>}
        </article>)}</div>}
    </section>
  </main>;
}
