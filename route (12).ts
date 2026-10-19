import { NextRequest, NextResponse } from "next/server";
import { getApiContext } from "@/lib/http";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ attemptId: string }> }) {
  const context = await getApiContext(["student"]);
  if ("response" in context) return context.response;
  const { attemptId } = await params;
  let body: { question_id?: unknown; answer?: unknown; marked_for_review?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  if (typeof body.question_id !== "string" ||
      (body.answer !== null && typeof body.answer !== "string" &&
        !(Array.isArray(body.answer) && body.answer.every((value) => typeof value === "string"))) ||
      (body.marked_for_review !== undefined && typeof body.marked_for_review !== "boolean")) {
    return NextResponse.json({ error: "Response data is invalid." }, { status: 400 });
  }
  const { error } = await context.supabase.rpc("save_response", {
    p_attempt_id: attemptId,
    p_question_id: body.question_id,
    p_answer: body.answer === null ? null : JSON.stringify(body.answer),
    p_marked_for_review: body.marked_for_review === true,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ saved: true });
}
