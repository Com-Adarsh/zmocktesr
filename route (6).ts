import { NextRequest, NextResponse } from "next/server";
import { getApiContext } from "@/lib/http";

export async function GET(_request: Request, { params }: { params: Promise<{ testId: string }> }) {
  const context = await getApiContext(["admin"]);
  if ("response" in context) return context.response;
  const { testId } = await params;
  const { data, error } = await context.supabase.from("test_access").select("student_id").eq("test_id", testId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ student_ids: data.map((row) => row.student_id) });
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ testId: string }> }) {
  const context = await getApiContext(["admin"]);
  if ("response" in context) return context.response;
  const { testId } = await params;
  let body: { student_ids?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 }); }
  if (!Array.isArray(body.student_ids) || !body.student_ids.every((id) =>
    typeof id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))) {
    return NextResponse.json({ error: "Choose valid student accounts." }, { status: 400 });
  }
  const { data, error } = await context.supabase.rpc("set_test_access", {
    p_test_id: testId, p_student_ids: body.student_ids,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ assigned_count: data });
}
