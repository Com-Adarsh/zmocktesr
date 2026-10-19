import { NextRequest, NextResponse } from "next/server";
import { getApiContext } from "@/lib/http";

export async function GET(_request: Request, { params }: { params: Promise<{ mediatorId: string }> }) {
  const context = await getApiContext(["admin"]);
  if ("response" in context) return context.response;
  const { mediatorId } = await params;
  const { data, error } = await context.supabase.from("mediator_assignments").select("course_id")
    .eq("mediator_id", mediatorId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ course_ids: data.map((row) => row.course_id) });
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ mediatorId: string }> }) {
  const context = await getApiContext(["admin"]);
  if ("response" in context) return context.response;
  const { mediatorId } = await params;
  let body: { course_ids?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 }); }
  if (!Array.isArray(body.course_ids) || !body.course_ids.every((id) =>
    typeof id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))) {
    return NextResponse.json({ error: "Choose valid courses." }, { status: 400 });
  }
  const { data, error } = await context.supabase.rpc("set_mediator_courses", {
    p_mediator_id: mediatorId, p_course_ids: body.course_ids,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ assigned_count: data });
}
