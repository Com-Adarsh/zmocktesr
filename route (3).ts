import { NextRequest, NextResponse } from "next/server";
import { getApiContext } from "@/lib/http";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  const context = await getApiContext(["admin"]);
  if ("response" in context) return context.response;
  const admin = createSupabaseAdminClient();
  if (!admin) return NextResponse.json({ error: "Mediator invitations require SUPABASE_SERVICE_ROLE_KEY on the server." }, { status: 503 });
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!siteUrl) return NextResponse.json({ error: "Mediator invitations require NEXT_PUBLIC_SITE_URL to be configured." }, { status: 503 });
  let invitationUrl: URL;
  try {
    invitationUrl = new URL(siteUrl);
  } catch {
    return NextResponse.json({ error: "NEXT_PUBLIC_SITE_URL must be a valid absolute URL." }, { status: 503 });
  }
  if (invitationUrl.protocol !== "https:" && invitationUrl.hostname !== "localhost") {
    return NextResponse.json({ error: "The invitation site URL must use HTTPS, except for localhost development." }, { status: 503 });
  }
  let body: { email?: unknown; display_name?: unknown; course_ids?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 }); }
  if (typeof body.email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email) ||
      typeof body.display_name !== "string" || !body.display_name.trim() ||
      !Array.isArray(body.course_ids) || body.course_ids.length === 0 ||
      !body.course_ids.every((course) => typeof course === "string")) {
    return NextResponse.json({ error: "A valid email, display name and at least one course assignment are required." }, { status: 400 });
  }
  const { data: invitation, error: inviteError } = await admin.auth.admin.inviteUserByEmail(body.email, {
    data: { display_name: body.display_name.trim() },
    redirectTo: new URL("/login", invitationUrl).toString(),
  });
  if (inviteError) return NextResponse.json({ error: inviteError.message }, { status: 400 });
  const userId = invitation.user.id;
  const { error: profileError } = await admin.from("profiles")
    .update({ role: "mediator", display_name: body.display_name.trim() }).eq("id", userId);
  if (profileError) return NextResponse.json({ error: `Invitation sent but mediator role setup failed: ${profileError.message}` }, { status: 500 });
  const assignments = (body.course_ids as string[]).map((course_id) => ({ mediator_id: userId, course_id }));
  const { error: assignmentError } = await admin.from("mediator_assignments").insert(assignments);
  if (assignmentError) return NextResponse.json({ error: `Invitation sent but course assignment failed: ${assignmentError.message}` }, { status: 500 });
  const { error: auditError } = await context.supabase.from("audit_logs").insert({
    actor_id: context.user.id, action: "mediator_invited", entity_type: "profile", entity_id: userId,
    details: { course_ids: body.course_ids },
  });
  if (auditError) return NextResponse.json({ error: `Mediator invitation sent but audit logging failed: ${auditError.message}` }, { status: 500 });
  return NextResponse.json({ invited: true, user_id: userId }, { status: 201 });
}
