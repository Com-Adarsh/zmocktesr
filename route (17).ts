import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getApiContext } from "@/lib/http";

export async function GET() {
  const context = await getApiContext(["mediator"]);
  if ("response" in context) return context.response;
  const { data, error } = await context.supabase.from("mediator_assignments")
    .select("courses(id, title, slug)").eq("mediator_id", context.user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ courses: data.flatMap((item) => Array.isArray(item.courses) ? item.courses : item.courses ? [item.courses] : []) });
}

export async function POST(request: NextRequest) {
  const context = await getApiContext(["mediator"]);
  if ("response" in context) return context.response;
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 }); }
  if (typeof body.course_id !== "string" || typeof body.title !== "string" || !body.title.trim() ||
      typeof body.duration_minutes !== "number" || !Number.isInteger(body.duration_minutes) || body.duration_minutes < 1 || body.duration_minutes > 1440) {
    return NextResponse.json({ error: "Provide an assigned course, title and valid duration." }, { status: 400 });
  }
  if ((body.correct_marks !== undefined && (typeof body.correct_marks !== "number" || body.correct_marks < 0)) ||
      (body.negative_marks !== undefined && (typeof body.negative_marks !== "number" || body.negative_marks < 0)) ||
      (body.release_answers !== undefined && typeof body.release_answers !== "boolean") ||
      (body.instructions !== undefined && typeof body.instructions !== "string") ||
      (body.starts_at !== undefined && typeof body.starts_at !== "string") ||
      (body.ends_at !== undefined && typeof body.ends_at !== "string")) {
    return NextResponse.json({ error: "Test settings are invalid; check marks, instructions, availability dates and answer-release settings." }, { status: 400 });
  }
  const startsAt = typeof body.starts_at === "string" && body.starts_at ? new Date(body.starts_at) : null;
  const endsAt = typeof body.ends_at === "string" && body.ends_at ? new Date(body.ends_at) : null;
  if ((startsAt && Number.isNaN(startsAt.getTime())) || (endsAt && Number.isNaN(endsAt.getTime())) ||
      (startsAt && endsAt && endsAt <= startsAt)) {
    return NextResponse.json({ error: "Availability dates are invalid; the end must be after the start." }, { status: 400 });
  }
  const { data: assignment, error: assignmentError } = await context.supabase.from("mediator_assignments")
    .select("course_id").eq("course_id", body.course_id).eq("mediator_id", context.user.id).maybeSingle();
  if (assignmentError) return NextResponse.json({ error: assignmentError.message }, { status: 500 });
  if (!assignment) return NextResponse.json({ error: "This course is not assigned to your mediator account." }, { status: 403 });
  const { data, error } = await context.supabase.from("tests").insert({
    course_id: body.course_id, created_by: context.user.id, title: body.title.trim(),
    test_code: `SFI-${randomBytes(16).toString("hex").toUpperCase()}`,
    instructions: typeof body.instructions === "string" ? body.instructions.trim() : "",
    duration_minutes: body.duration_minutes,
    correct_marks: typeof body.correct_marks === "number" && body.correct_marks >= 0 ? body.correct_marks : 4,
    negative_marks: typeof body.negative_marks === "number" && body.negative_marks >= 0 ? body.negative_marks : 0,
    attempt_limit: 1, access_mode: "code", release_answers: body.release_answers === true,
    starts_at: startsAt?.toISOString() ?? null, ends_at: endsAt?.toISOString() ?? null, is_published: false,
  }).select("id, title, instructions, duration_minutes, correct_marks, negative_marks, attempt_limit, access_mode, starts_at, ends_at, release_answers, test_code, review_requested_at").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const { error: auditError } = await context.supabase.from("audit_logs").insert({
    actor_id: context.user.id, action: "mediator_test_created", entity_type: "test", entity_id: data.id,
  });
  if (auditError) return NextResponse.json({ error: `Draft created but audit logging failed: ${auditError.message}` }, { status: 500 });
  return NextResponse.json({ test: data }, { status: 201 });
}
