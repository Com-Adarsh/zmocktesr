import { NextResponse } from "next/server";
import { getApiContext } from "@/lib/http";

export async function POST(_request: Request, { params }: { params: Promise<{ testId: string }> }) {
  const context = await getApiContext(["mediator"]);
  if ("response" in context) return context.response;
  const { testId } = await params;
  const { data: test, error: testError } = await context.supabase.from("tests")
    .select("id, created_by, is_published, is_archived").eq("id", testId).maybeSingle();
  if (testError) return NextResponse.json({ error: testError.message }, { status: 500 });
  if (!test || test.created_by !== context.user.id) return NextResponse.json({ error: "Your draft test was not found." }, { status: 404 });
  if (test.is_published || test.is_archived) return NextResponse.json({ error: "Only active draft tests can be submitted for review." }, { status: 400 });
  const { count, error: countError } = await context.supabase.from("questions")
    .select("id", { count: "exact", head: true }).eq("test_id", testId);
  if (countError) return NextResponse.json({ error: countError.message }, { status: 500 });
  if (!count) return NextResponse.json({ error: "Import questions before requesting review." }, { status: 400 });
  const { error } = await context.supabase.from("tests").update({ review_requested_at: new Date().toISOString() }).eq("id", testId);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const { error: auditError } = await context.supabase.from("audit_logs").insert({
    actor_id: context.user.id, action: "mediator_review_requested", entity_type: "test", entity_id: testId,
  });
  if (auditError) return NextResponse.json({ error: `Review request submitted but audit logging failed: ${auditError.message}` }, { status: 500 });
  return NextResponse.json({ submitted: true, review_requested_at: new Date().toISOString() });
}
