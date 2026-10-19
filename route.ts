import { NextRequest, NextResponse } from "next/server";
import { getApiContext } from "@/lib/http";

export async function POST(request: NextRequest, { params }: { params: Promise<{ courseId: string }> }) {
  const context = await getApiContext(["admin"]);
  if ("response" in context) return context.response;
  const { courseId } = await params;
  let body: { action?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 }); }
  const action = body.action;
  if (!["publish", "unpublish", "archive", "restore"].includes(String(action))) {
    return NextResponse.json({ error: "Course action is invalid." }, { status: 400 });
  }
  const updates = action === "publish" ? { is_published: true, is_archived: false }
    : action === "unpublish" ? { is_published: false }
    : action === "archive" ? { is_published: false, is_archived: true }
    : { is_published: false, is_archived: false };
  const { data, error } = await context.supabase.from("courses").update(updates)
    .eq("id", courseId).select("id, is_published, is_archived").maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data) return NextResponse.json({ error: "Course not found." }, { status: 404 });
  const { error: auditError } = await context.supabase.from("audit_logs").insert({
    actor_id: context.user.id, action: `course_${String(action)}`, entity_type: "course", entity_id: courseId,
  });
  if (auditError) return NextResponse.json({ error: `Course status updated but audit logging failed: ${auditError.message}` }, { status: 500 });
  return NextResponse.json({ course: data });
}
