import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function CoursePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createSupabaseServerClient();
  if (!supabase) return <main className="container"><section className="page-heading"><h1>Course unavailable</h1><p>Configure the database connection to view published course tests.</p></section></main>;

  const { data: course, error } = await supabase.from("courses")
    .select("id, title, description").eq("slug", slug).eq("is_published", true).eq("is_archived", false).maybeSingle();
  if (error) throw new Error(`Unable to load course: ${error.message}`);
  if (!course) notFound();

  const { data: tests, error: testsError } = await supabase.from("tests")
    .select("id, title, duration_minutes, correct_marks, negative_marks, test_code")
    .eq("course_id", course.id).eq("is_published", true).eq("is_archived", false).order("title");
  if (testsError) throw new Error(`Unable to load course tests: ${testsError.message}`);

  return <main className="container">
    <section className="page-heading"><p className="eyebrow">Course</p><h1>{course.title}</h1><p>{course.description}</p></section>
    <section className="section">
      <h2>Published mock tests</h2>
      {!tests?.length ? <div className="empty-state"><strong>No published tests for this course yet.</strong><p>Tests will appear after an authorised reviewer publishes them.</p></div> :
        <div className="test-list">{tests.map((item) => <article className="test-row" key={item.id}>
          <div><h2>{item.title}</h2><p>{item.duration_minutes} minutes · +{item.correct_marks} correct · −{item.negative_marks} incorrect</p></div>
          <Link className="button" href={`/enter-test?code=${encodeURIComponent(item.test_code)}`}>View test</Link>
        </article>)}</div>}
    </section>
  </main>;
}
