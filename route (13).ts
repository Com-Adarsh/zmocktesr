import { NextRequest, NextResponse } from "next/server";
import { getApiContext } from "@/lib/http";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ attemptId: string }> }) {
  const context = await getApiContext(["student"]);
  if ("response" in context) return context.response;
  const { attemptId } = await params;
  const { data: attempt, error } = await context.supabase.from("attempts")
    .select("id, test_id, status, started_at, expires_at, tests(title, instructions)")
    .eq("id", attemptId).single();
  if (error) return NextResponse.json({ error: "Attempt not found or not available to this account." }, { status: 404 });
  const { data: questions, error: questionError } = await context.supabase.from("questions")
    .select("id, position, question_text, question_type, options, section")
    .eq("test_id", attempt.test_id).order("position");
  if (questionError) return NextResponse.json({ error: "Unable to load test questions." }, { status: 500 });
  const { data: responses, error: responseError } = await context.supabase.from("responses")
    .select("question_id, answer, marked_for_review").eq("attempt_id", attemptId);
  if (responseError) return NextResponse.json({ error: "Unable to restore saved responses." }, { status: 500 });
  const test = Array.isArray(attempt.tests) ? attempt.tests[0] ?? null : attempt.tests;
  return NextResponse.json({ attempt: { ...attempt, tests: test }, questions, responses });
}
