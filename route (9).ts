import { NextResponse } from "next/server";
import { getApiContext } from "@/lib/http";

export async function GET(_request: Request, { params }: { params: Promise<{ testId: string }> }) {
  const context = await getApiContext(["admin"]);
  if ("response" in context) return context.response;
  const { testId } = await params;
  const { data: questions, error } = await context.supabase.from("questions")
    .select("id, position, question_text, question_type, options, marks, negative_marks, explanation, section, topic")
    .eq("test_id", testId).order("position");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const ids = (questions ?? []).map((question) => question.id);
  const { data: keys, error: keyError } = ids.length
    ? await context.supabase.from("answer_keys").select("question_id, answer").in("question_id", ids)
    : { data: [], error: null };
  if (keyError) return NextResponse.json({ error: keyError.message }, { status: 500 });
  return NextResponse.json({ questions: (questions ?? []).map((question) => ({
    ...question, answer: keys?.find((key) => key.question_id === question.id)?.answer ?? null,
  })) });
}
