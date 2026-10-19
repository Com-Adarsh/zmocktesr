import { NextRequest, NextResponse } from "next/server";
import { getApiContext } from "@/lib/http";

export async function POST(request: NextRequest) {
  const context = await getApiContext(["admin"]);
  if ("response" in context) return context.response;
  let body: { title?: unknown; slug?: unknown; description?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 }); }
  if (typeof body.title !== "string" || !body.title.trim() || typeof body.slug !== "string" ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(body.slug) ||
      (body.description !== undefined && typeof body.description !== "string")) {
    return NextResponse.json({ error: "Provide a title, a lowercase hyphenated slug, and an optional description." }, { status: 400 });
  }
  const { data, error } = await context.supabase.from("courses").insert({
    title: body.title.trim(), slug: body.slug, description: typeof body.description === "string" ? body.description.trim() : "",
    created_by: context.user.id, is_published: false,
  }).select("id, title, slug").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const { error: auditError } = await context.supabase.from("audit_logs").insert({
    actor_id: context.user.id, action: "course_created", entity_type: "course", entity_id: data.id,
  });
  if (auditError) return NextResponse.json({ error: `Course created but audit logging failed: ${auditError.message}` }, { status: 500 });
  return NextResponse.json({ course: data }, { status: 201 });
}
