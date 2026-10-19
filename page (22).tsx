import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function CoursesPage() {
  const supabase = await createSupabaseServerClient();
  const { data: courses, error } = supabase
    ? await supabase.from("courses").select("id, slug, title, description").eq("is_published", true).eq("is_archived", false).order("title")
    : { data: null, error: null };

  return <main className="container">
    <section className="page-heading"><p className="eyebrow">Student portal</p><h1>Browse courses</h1><p>Choose from courses that have been added and published by an authorised administrator.</p></section>
    {!supabase && <div className="notice">Configure Supabase to display courses. No course catalogue is assumed or fabricated.</div>}
    {error && <div className="error">Courses could not be loaded: {error.message}</div>}
    {supabase && !error && (!courses || courses.length === 0) && <div className="empty-state"><strong>No published courses yet.</strong><p>Check back after an administrator publishes a course.</p></div>}
    {courses && courses.length > 0 && <section className="grid section">{courses.map((course) => <article className="card course-card" key={course.id}>
      <div><h2>{course.title}</h2><p>{course.description || "View published mock tests."}</p></div>
      <Link className="text-link" href={`/courses/${course.slug}`}>View tests →</Link>
    </article>)}</section>}
  </main>;
}
