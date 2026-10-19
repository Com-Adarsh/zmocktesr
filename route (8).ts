import { NextResponse } from "next/server";
import { getApiContext } from "@/lib/http";

export async function POST(_request: Request, { params }: { params: Promise<{ testId: string }> }) {
  const context = await getApiContext(["admin"]);
  if ("response" in context) return context.response;
  const { testId } = await params;
  const { data: test, error: testError } = await context.supabase.from("tests")
    .select("id, course_id, title").eq("id", testId).maybeSingle();
  if (testError) return NextResponse.json({ error: testError.message }, { status: 500 });
  if (!test) return NextResponse.json({ error: "Test not found." }, { status: 404 });
  const { data: course, error: courseError } = await context.supabase.from("courses")
    .select("is_published").eq("id", test.course_id).single();
  if (courseError) return NextResponse.json({ error: courseError.message }, { status: 500 });
  if (!course.is_published) return NextResponse.json({ error: "Publish the course before publishing its tests." }, { status: 400 });
  const { count, error: countError } = await context.supabase.from("questions")
    .select("id", { count: "exact", head: true }).eq("test_id", testId);
  if (countError) return NextResponse.json({ error: countError.message }, { status: 500 });
  if (!count) return NextResponse.json({ error: "A test needs at least one question before publication." }, { status: 400 });
  const { data: questions, error: questionError } = await context.supabase.from("questions").select("id").eq("test_id", testId);
  if (questionError) return NextResponse.json({ error: questionError.message }, { status: 500 });
  const { count: keyCount, error: keyError } = await context.supabase.from("answer_keys")
    .select("question_id", { count: "exact", head: true }).in("question_id", (questions ?? []).map((item) => item.id));
  if (keyError) return NextResponse.json({ error: keyError.message }, { status: 500 });
  if (keyCount !== count) return NextResponse.json({ error: "Every test question must have a correct answer before publication." }, { status: 400 });
  const { error } = await context.supabase.from("tests").update({ is_published: true }).eq("id", testId);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const { error: auditError } = await context.supabase.from("audit_logs").insert({
    actor_id: context.user.id, action: "test_published", entity_type: "test", entity_id: testId, details: { title: test.title },
  });
  if (auditError) return NextResponse.json({ error: `Test published but audit logging failed: ${auditError.message}` }, { status: 500 });
  return NextResponse.json({ published: true });
}
