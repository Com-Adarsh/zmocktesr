import { NextResponse } from "next/server";
import { getApiContext } from "@/lib/http";

export async function DELETE(_request: Request, { params }: { params: Promise<{ mediatorId: string }> }) {
  const context = await getApiContext(["admin"]);
  if ("response" in context) return context.response;
  const { mediatorId } = await params;
  const { data: mediator, error: profileError } = await context.supabase.from("profiles")
    .select("id, role").eq("id", mediatorId).maybeSingle();
  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 });
  if (!mediator || mediator.role !== "mediator") return NextResponse.json({ error: "Mediator account not found." }, { status: 404 });
  const { error: assignmentError } = await context.supabase.from("mediator_assignments").delete().eq("mediator_id", mediatorId);
  if (assignmentError) return NextResponse.json({ error: `Could not revoke course assignments: ${assignmentError.message}` }, { status: 500 });
  const { error } = await context.supabase.from("profiles").update({ role: "student" }).eq("id", mediatorId);
  if (error) return NextResponse.json({ error: `Course assignments removed but account role could not be changed: ${error.message}` }, { status: 500 });
  const { error: auditError } = await context.supabase.from("audit_logs").insert({
    actor_id: context.user.id, action: "mediator_access_revoked", entity_type: "profile", entity_id: mediatorId,
  });
  if (auditError) return NextResponse.json({ error: `Mediator access revoked but audit logging failed: ${auditError.message}` }, { status: 500 });
  return NextResponse.json({ revoked: true });
}
