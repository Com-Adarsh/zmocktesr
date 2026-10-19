import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";

type ReviewItem = {
  id: string;
  position: number;
  question: string;
  answer: string | string[];
  response: string | string[] | null;
  correct: boolean;
  explanation: string | null;
};

export default async function ResultPage({ params }: { params: Promise<{ attemptId: string }> }) {
  const { attemptId } = await params;
  const { supabase, user } = await requireRole(["student"]);
  const { data: attempt, error } = await supabase.from("attempts")
    .select("id, status, score, maximum_score, correct_count, incorrect_count, unanswered_count, elapsed_seconds, test_id, tests(title, release_answers)")
    .eq("id", attemptId).eq("student_id", user.id).maybeSingle();
  if (error) throw new Error(`Unable to load result: ${error.message}`);
  if (!attempt) notFound();
  const testDetails = (attempt.tests as { title: string; release_answers: boolean }[] | null)?.[0];
  if (attempt.status !== "submitted") return <main className="container"><section className="page-heading"><h1>Test not submitted yet</h1><p>Your result will be available after you submit the test.</p><Link className="button" href={`/test/${attempt.id}`}>Resume test</Link></section></main>;

  const { data: review, error: reviewError } = testDetails?.release_answers
    ? await supabase.rpc("get_attempt_review", { p_attempt_id: attemptId })
    : { data: null, error: null };
  if (reviewError && !reviewError.message.includes("not available")) {
    throw new Error(`Unable to load answer review: ${reviewError.message}`);
  }
  const reviewItems = review as ReviewItem[] | null;
  const accuracy = (attempt.correct_count ?? 0) + (attempt.incorrect_count ?? 0) === 0
    ? 0 : Math.round((attempt.correct_count ?? 0) / ((attempt.correct_count ?? 0) + (attempt.incorrect_count ?? 0)) * 100);

  return <main className="container">
    <section className="page-heading"><p className="eyebrow">Result</p><h1>{testDetails?.title ?? "Mock test"} submitted</h1><p>Your score is calculated by the server from the saved responses and published answer key.</p></section>
    <section className="grid">
      <article className="card"><p className="eyebrow">Score</p><h2>{attempt.score} / {attempt.maximum_score}</h2></article>
      <article className="card"><p className="eyebrow">Answers</p><h2>{attempt.correct_count} correct</h2><p>{attempt.incorrect_count} incorrect · {attempt.unanswered_count} unanswered</p></article>
      <article className="card"><p className="eyebrow">Attempt</p><h2>{accuracy}% accuracy</h2><p>{Math.floor((attempt.elapsed_seconds ?? 0) / 60)} min {((attempt.elapsed_seconds ?? 0) % 60)} sec recorded</p></article>
    </section>
    <section className="section">
      <h2>Answer review</h2>
      {!testDetails?.release_answers ? <div className="notice">Answer review is not enabled for this test.</div> :
        !reviewItems?.length ? <div className="empty-state"><strong>No answer review is available.</strong></div> :
          <div className="test-list">{reviewItems.map((item) => <article className="card" key={item.id}>
            <p className="eyebrow">Question {item.position} · {item.correct ? "Correct" : item.response === null ? "Unanswered" : "Incorrect"}</p>
            <h3>{item.question}</h3><p>Your answer: {item.response === null ? "No answer" : JSON.stringify(item.response)}</p>
            <p>Correct answer: {JSON.stringify(item.answer)}</p>
            {item.explanation && <p>{item.explanation}</p>}
          </article>)}</div>}
    </section>
  </main>;
}
