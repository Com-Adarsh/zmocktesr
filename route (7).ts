import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { getApiContext } from "@/lib/http";

export async function POST(_request: Request, { params }: { params: Promise<{ testId: string }> }) {
  const context = await getApiContext(["admin"]);
  if ("response" in context) return context.response;
  const { testId } = await params;
  const code = `SFI-${randomBytes(16).toString("hex").toUpperCase()}`;
  const { data, error } = await context.supabase.from("tests").update({ test_code: code })
    .eq("id", testId).select("id, test_code").maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data) return NextResponse.json({ error: "Test not found." }, { status: 404 });
  const { error: auditError } = await context.supabase.from("audit_logs").insert({
    actor_id: context.user.id, action: "test_code_regenerated", entity_type: "test", entity_id: testId,
  });
  if (auditError) return NextResponse.json({ error: `Code regenerated but audit logging failed: ${auditError.message}` }, { status: 500 });
  return NextResponse.json({ test: data });
}
