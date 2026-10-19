import { NextResponse } from "next/server";
import { getApiContext } from "@/lib/http";

export async function POST(_request: Request, { params }: { params: Promise<{ attemptId: string }> }) {
  const context = await getApiContext(["student"]);
  if ("response" in context) return context.response;
  const { attemptId } = await params;
  const { data, error } = await context.supabase.rpc("submit_attempt", { p_attempt_id: attemptId });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}
