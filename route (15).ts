import { NextRequest, NextResponse } from "next/server";
import { getApiContext } from "@/lib/http";

export async function POST(request: NextRequest) {
  const context = await getApiContext(["student"]);
  if ("response" in context) return context.response;
  let body: { code?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  if (typeof body.code !== "string" || !body.code.trim()) {
    return NextResponse.json({ error: "A test code is required." }, { status: 400 });
  }
  const { data, error } = await context.supabase.rpc("start_attempt", { p_test_code: body.code });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data, { status: 201 });
}
