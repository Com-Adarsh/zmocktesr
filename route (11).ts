import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getApiContext } from "@/lib/http";

export async function POST(request: NextRequest) {
  const context = await getApiContext(["admin"]);
  if ("response" in context) return context.response;
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 }); }
  if (typeof body.course_id !== "string" || typeof body.title !== "string" || !body.title.trim() ||
      typeof body.duration_minutes !== "number" || !Number.isInteger(body.duration_minutes) || body.duration_minutes < 1 || body.duration_minutes > 1440 ||
      typeof body.correct_marks !== "number" || body.correct_marks < 0 ||
      typeof body.negative_marks !== "number" || body.negative_marks < 0 ||
      typeof body.attempt_limit !== "number" || !Number.isInteger(body.attempt_limit) || body.attempt_limit < 1 ||
      !["public", "code", "assigned"].includes(String(body.access_mode))) {
    return NextResponse.json({ error: "Test details are invalid. Check duration, marks, attempts and access mode." }, { status: 400 });
  }
  if ((body.starts_at !== undefined && typeof body.starts_at !== "string") ||
      (body.ends_at !== undefined && typeof body.ends_at !== "string") ||
      (body.instructions !== undefined && typeof body.instructions !== "string") ||
      (body.release_answers !== undefined && typeof body.release_answers !== "boolean")) {
    return NextResponse.json({ error: "Instructions, availability dates or answer-release settings are invalid." }, { status: 400 });
  }
  const startsAt = typeof body.starts_at === "string" && body.starts_at ? new Date(body.starts_at) : null;
  const endsAt = typeof body.ends_at === "string" && body.ends_at ? new Date(body.ends_at) : null;
  if ((startsAt && Number.isNaN(startsAt.getTime())) || (endsAt && Number.isNaN(endsAt.getTime())) ||
      (startsAt && endsAt && endsAt <= startsAt)) {
    return NextResponse.json({ error: "Availability dates are invalid; the end must be after the start." }, { status: 400 });
  }
  const code = `SFI-${randomBytes(16).toString("hex").toUpperCase()}`;
  const { data, error } = await context.supabase.from("tests").insert({
    course_id: body.course_id, created_by: context.user.id, title: body.title.trim(), test_code: code,
    instructions: typeof body.instructions === "string" ? body.instructions.trim() : "",
    duration_minutes: body.duration_minutes, correct_marks: body.correct_marks, negative_marks: body.negative_marks,
    attempt_limit: body.attempt_limit, access_mode: body.access_mode, release_answers: body.release_answers === true,
    starts_at: startsAt?.toISOString() ?? null, ends_at: endsAt?.toISOString() ?? null,
    is_published: false,
  }).select("id, title, instructions, duration_minutes, correct_marks, negative_marks, attempt_limit, access_mode, starts_at, ends_at, release_answers, test_code, review_requested_at").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const { error: auditError } = await context.supabase.from("audit_logs").insert({
    actor_id: context.user.id, action: "test_created", entity_type: "test", entity_id: data.id,
  });
  if (auditError) return NextResponse.json({ error: `Test created but audit logging failed: ${auditError.message}` }, { status: 500 });
  return NextResponse.json({ test: data }, { status: 201 });
}
