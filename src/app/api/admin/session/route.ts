import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { db, adminSessions } from "@db";
import { ADMIN_COOKIE, checkMasterPassword, createAdminSession, sessionCookie, verifyAdminSession } from "@/lib/admin-auth";
import { jsonError, readJson, str } from "@/lib/http";

export async function POST(request: Request) {
  const body = await readJson<{ password?: unknown }>(request);
  const password = str(body?.password, 256);
  if (!password) return jsonError("Password is required.", 400);

  const check = checkMasterPassword(password);
  if (check === "unconfigured") return jsonError("Admin login is not configured (ADMIN_MASTER_PASSWORD is not set).", 503);
  if (check === "invalid") return jsonError("Incorrect password.", 401);

  const { token, expiresAt } = await createAdminSession();
  (await cookies()).set(sessionCookie(token, expiresAt));
  return Response.json({ authenticated: true, expiresAt });
}

export async function GET() {
  const session = await verifyAdminSession();
  return Response.json(session ? { authenticated: true, expiresAt: session.expiresAt } : { authenticated: false });
}

export async function DELETE() {
  const jar = await cookies();
  const token = jar.get(ADMIN_COOKIE)?.value;
  if (token) await db.delete(adminSessions).where(eq(adminSessions.token, token));
  jar.delete(ADMIN_COOKIE);
  return Response.json({ authenticated: false });
}
