import { randomBytes, timingSafeEqual, createHash } from "node:crypto";
import { cookies } from "next/headers";
import { and, eq, gt, lt } from "drizzle-orm";
import { db, adminSessions } from "@db";
import { jsonError } from "./http";

export const ADMIN_COOKIE = "sfi_admin_token";
export const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

export function checkMasterPassword(candidate: string): "ok" | "invalid" | "unconfigured" {
  const expected = process.env.ADMIN_MASTER_PASSWORD;
  if (!expected) return "unconfigured";
  // Hash both sides so the comparison is constant-time regardless of length.
  const a = createHash("sha256").update(candidate).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b) ? "ok" : "invalid";
}

export async function createAdminSession() {
  const token = randomBytes(32).toString("hex"); // 256-bit, 64 hex chars
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.delete(adminSessions).where(lt(adminSessions.expiresAt, new Date()));
  await db.insert(adminSessions).values({ token, expiresAt });
  return { token, expiresAt };
}

export function sessionCookie(token: string, expiresAt: Date) {
  return {
    name: ADMIN_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  };
}

/** Returns the active session for the request's admin cookie, or null. */
export async function verifyAdminSession() {
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (!token || !/^[0-9a-f]{64}$/.test(token)) return null;
  const [session] = await db
    .select({ id: adminSessions.id, expiresAt: adminSessions.expiresAt })
    .from(adminSessions)
    .where(and(eq(adminSessions.token, token), gt(adminSessions.expiresAt, new Date())))
    .limit(1);
  return session ?? null;
}

/** Guard for admin route handlers: returns a 401 response when not authenticated. */
export async function requireAdmin(): Promise<Response | null> {
  return (await verifyAdminSession()) ? null : jsonError("Admin session required.", 401);
}
