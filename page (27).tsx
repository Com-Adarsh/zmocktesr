import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function HomePage() {
  const supabase = await createSupabaseServerClient();
  const { data: courses, error } = supabase
    ? await supabase.from("courses").select("id, slug, title, description").eq("is_published", true).eq("is_archived", false).order("title")
    : { data: null, error: null };

  return (
    <main>
      <section className="hero container">
        <div className="hero-copy">
          <div className="pill"><span className="pill-dot" /> Built for focused preparation</div>
          <h1>Your next score starts with a better <em>practice.</em></h1>
          <p className="hero-lede">Take realistic mock tests, understand your progress, and walk into every exam with a clearer plan.</p>
          <div className="actions"><Link className="button" href="/courses">Explore courses <span aria-hidden="true">↗</span></Link><Link className="button secondary" href="/enter-test">I have a test code</Link></div>
          <div className="trust-row"><span className="trust-icon">✓</span><span>Authorised tests</span><span className="trust-icon">✓</span><span>Clear results</span><span className="trust-icon">✓</span><span>Built for students</span></div>
        </div>
        <div className="hero-visual" aria-label="Mock test progress overview">
          <div className="visual-glow" />
          <div className="score-card"><div className="card-top"><span>Latest attempt</span><span className="trend">+12.4%</span></div><strong>82<span>/100</span></strong><div className="progress"><span /></div><div className="score-foot"><span>Practice score</span><span>Excellent</span></div></div>
          <div className="floating-card floating-one"><span className="mini-icon">✓</span><div><b>Test completed</b><small>Reasoning · 45 min</small></div></div>
          <div className="floating-card floating-two"><span className="bar-icon">▮▮▮</span><div><b>Keep improving</b><small>Review your results</small></div></div>
        </div>
      </section>
      <section className="container section course-section">
        <div className="section-heading"><div><p className="eyebrow">Start here</p><h2>Choose your path</h2></div><Link className="text-link" href="/courses">View all courses <span aria-hidden="true">→</span></Link></div>
        {!supabase && <div className="notice">Platform setup is incomplete: configure the Supabase URL and public key to load published courses.</div>}
        {error && <div className="error">Courses could not be loaded: {error.message}</div>}
        {supabase && !error && (!courses || courses.length === 0) && <div className="empty-state"><strong>No published courses yet.</strong><p>Authorised administrators can add courses after the platform is configured.</p></div>}
        {courses && courses.length > 0 && <div className="grid">{courses.map((course, index) => (<article className="card course-card" key={course.id}><span className="course-number">0{index + 1}</span><div><h2>{course.title}</h2><p>{course.description || "Browse published mock tests for this course."}</p></div><Link className="text-link" href={`/courses/${course.slug}`}>View tests <span aria-hidden="true">→</span></Link></article>))}</div>}
      </section>
    </main>
  );
}
