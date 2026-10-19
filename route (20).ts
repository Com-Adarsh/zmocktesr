import { NextRequest, NextResponse } from "next/server";
import { getApiContext } from "@/lib/http";

const allowedFields = new Set([
  "title", "instructions", "duration_minutes", "correct_marks", "negative_marks",
  "attempt_limit", "access_mode", "starts_at", "ends_at", "release_answers",
]);

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ testId: string }> }) {
  const context = await getApiContext(["admin", "mediator"]);
  if ("response" in context) return context.response;
  const { testId } = await params;
  const { data: profile, error: profileError } = await context.supabase.from("profiles")
    .select("role").eq("id", context.user.id).single();
  if (profileError) return NextResponse.json({ error: "Unable to verify account permissions." }, { status: 403 });
  const { data: test, error: testError } = await context.supabase.from("tests")
    .select("id, course_id, created_by, is_published, is_archived, starts_at, ends_at")
    .eq("id", testId).maybeSingle();
  if (testError) return NextResponse.json({ error: testError.message }, { status: 500 });
  if (!test) return NextResponse.json({ error: "Test not found." }, { status: 404 });
  if (test.is_published || test.is_archived) return NextResponse.json({ error: "Only active draft tests can be edited." }, { status: 400 });
  if (profile.role === "mediator" && test.created_by !== context.user.id) {
    return NextResponse.json({ error: "Mediators can edit only their own drafts." }, { status: 403 });
  }
  const { data: hasAttempts, error: attemptsError } = await context.supabase.rpc("has_test_attempts", { target_test: testId });
  if (attemptsError) return NextResponse.json({ error: "Unable to verify whether this test has existing attempts." }, { status: 500 });
  if (hasAttempts) return NextResponse.json({ error: "Test settings cannot change after an attempt has started." }, { status: 400 });

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 }); }
  const fields = Object.keys(body);
  if (!fields.length || fields.some((field) => !allowedFields.has(field))) {
    return NextResponse.json({ error: "Settings are empty or contain unsupported fields." }, { status: 400 });
  }
  if (profile.role === "mediator" && fields.some((field) => ["attempt_limit", "access_mode"].includes(field))) {
    return NextResponse.json({ error: "Only administrators can change attempt limits or access mode." }, { status: 403 });
  }

  const updates: Record<string, unknown> = {};
  if ("title" in body) {
    if (typeof body.title !== "string" || !body.title.trim() || body.title.length > 160) {
      return NextResponse.json({ error: "Test title must be between 1 and 160 characters." }, { status: 400 });
    }
    updates.title = body.title.trim();
  }
  if ("instructions" in body) {
    if (typeof body.instructions !== "string" || body.instructions.length > 5000) {
      return NextResponse.json({ error: "Instructions must be 5,000 characters or fewer." }, { status: 400 });
    }
    updates.instructions = body.instructions.trim();
  }
  if ("duration_minutes" in body) {
    if (typeof body.duration_minutes !== "number" || !Number.isInteger(body.duration_minutes) || body.duration_minutes < 1 || body.duration_minutes > 1440) {
      return NextResponse.json({ error: "Duration must be from 1 to 1,440 minutes." }, { status: 400 });
    }
    updates.duration_minutes = body.duration_minutes;
  }
  for (const field of ["correct_marks", "negative_marks"] as const) {
    if (field in body) {
      if (typeof body[field] !== "number" || !Number.isFinite(body[field]) || body[field] < 0) {
        return NextResponse.json({ error: "Marks must be non-negative numbers." }, { status: 400 });
      }
      updates[field] = body[field];
    }
  }
  if ("attempt_limit" in body) {
    if (typeof body.attempt_limit !== "number" || !Number.isInteger(body.attempt_limit) || body.attempt_limit < 1 || body.attempt_limit > 100) {
      return NextResponse.json({ error: "Attempt limit must be from 1 to 100." }, { status: 400 });
    }
    updates.attempt_limit = body.attempt_limit;
  }
  if ("access_mode" in body) {
    if (!["public", "code", "assigned"].includes(String(body.access_mode))) {
      return NextResponse.json({ error: "Test access mode is invalid." }, { status: 400 });
    }
    updates.access_mode = body.access_mode;
  }
  if ("release_answers" in body) {
    if (typeof body.release_answers !== "boolean") return NextResponse.json({ error: "Answer-release setting must be true or false." }, { status: 400 });
    updates.release_answers = body.release_answers;
  }

  for (const field of ["starts_at", "ends_at"] as const) {
    if (field in body) {
      if (typeof body[field] !== "string") return NextResponse.json({ error: "Availability dates must be text values." }, { status: 400 });
      if (!body[field]) updates[field] = null;
      else {
        const date = new Date(body[field]);
        if (Number.isNaN(date.getTime())) return NextResponse.json({ error: "Availability date is invalid." }, { status: 400 });
        updates[field] = date.toISOString();
      }
    }
  }
  const startsAt = "starts_at" in updates ? updates.starts_at as string | null : test.starts_at;
  const endsAt = "ends_at" in updates ? updates.ends_at as string | null : test.ends_at;
  if (startsAt && endsAt && new Date(endsAt) <= new Date(startsAt)) {
    return NextResponse.json({ error: "Test end time must be after its start time." }, { status: 400 });
  }

  const { data, error } = await context.supabase.from("tests").update(updates)
    .eq("id", testId).select("id, title, instructions, duration_minutes, correct_marks, negative_marks, attempt_limit, access_mode, starts_at, ends_at, release_answers, review_requested_at").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const action = profile.role === "admin" ? "test_settings_updated" : "mediator_test_updated";
  const { error: auditError } = await context.supabase.from("audit_logs").insert({
    actor_id: context.user.id, action, entity_type: "test", entity_id: testId,
  });
  if (auditError) return NextResponse.json({ error: `Settings saved but audit logging failed: ${auditError.message}` }, { status: 500 });
  return NextResponse.json({ test: data });
}
