import { NextRequest, NextResponse } from "next/server";
import { getApiContext } from "@/lib/http";

export async function POST(request: NextRequest, { params }: { params: Promise<{ testId: string }> }) {
  const context = await getApiContext(["admin"]);
  if ("response" in context) return context.response;
  const { testId } = await params;
  let body: { action?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 }); }
  const action = body.action;
  if (!["unpublish", "archive", "restore"].includes(String(action))) {
    return NextResponse.json({ error: "Test action is invalid." }, { status: 400 });
  }
  const updates = action === "unpublish" ? { is_published: false }
    : action === "archive" ? { is_published: false, is_archived: true }
    : { is_published: false, is_archived: false };
  const { data, error } = await context.supabase.from("tests").update(updates)
    .eq("id", testId).select("id, is_published, is_archived").maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data) return NextResponse.json({ error: "Test not found." }, { status: 404 });
  const { error: auditError } = await context.supabase.from("audit_logs").insert({
    actor_id: context.user.id, action: `test_${String(action)}`, entity_type: "test", entity_id: testId,
  });
  if (auditError) return NextResponse.json({ error: `Test status updated but audit logging failed: ${auditError.message}` }, { status: 500 });
  return NextResponse.json({ test: data });
}
