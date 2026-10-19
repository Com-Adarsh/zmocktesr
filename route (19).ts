import { NextRequest, NextResponse } from "next/server";
import { getApiContext } from "@/lib/http";
import { validateQuestionImport } from "@/lib/import-questions";

export async function POST(request: NextRequest, { params }: { params: Promise<{ testId: string }> }) {
  const context = await getApiContext(["admin", "mediator"]);
  if ("response" in context) return context.response;
  const { testId } = await params;
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > 1_000_000) return NextResponse.json({ error: "Question import exceeds the 1 MB limit." }, { status: 413 });
  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > 1_000_000) {
    return NextResponse.json({ error: "Question import exceeds the 1 MB limit." }, { status: 413 });
  }
  let body: { filename?: unknown; questions?: unknown; replace_existing?: unknown };
  try { body = JSON.parse(raw) as typeof body; } catch { return NextResponse.json({ error: "Upload must be valid JSON." }, { status: 400 }); }
  if (typeof body.filename !== "string" || body.filename.length > 200) {
    return NextResponse.json({ error: "Provide a source filename up to 200 characters." }, { status: 400 });
  }
  if (body.replace_existing !== undefined && typeof body.replace_existing !== "boolean") {
    return NextResponse.json({ error: "The replacement setting must be true or false." }, { status: 400 });
  }
  const validated = validateQuestionImport(body.questions);
  if (validated.errors.length) return NextResponse.json({ error: "Question validation failed.", details: validated.errors }, { status: 400 });

  const { data, error } = await context.supabase.rpc("import_questions", {
    p_test_id: testId, p_filename: body.filename, p_questions: validated.questions, p_replace: body.replace_existing === true,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data, { status: 201 });
}
