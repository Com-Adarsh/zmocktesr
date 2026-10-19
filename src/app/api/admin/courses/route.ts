import { asc, eq } from "drizzle-orm";
import { db, courses } from "@db";
import { requireAdmin } from "@/lib/admin-auth";
import { isUniqueViolation, jsonError, readJson, str } from "@/lib/http";

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  const rows = await db.select().from(courses).orderBy(asc(courses.level), asc(courses.courseName));
  return Response.json({ courses: rows });
}

export async function POST(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const body = await readJson<Record<string, unknown>>(request);
  const courseName = str(body?.courseName, 200);
  const level = str(body?.level, 10).toUpperCase() === "PG" ? "PG" : "UG";
  if (!courseName) return jsonError("Course name is required.", 400);
  try {
    const [course] = await db.insert(courses).values({ courseName, level }).returning();
    return Response.json({ course }, { status: 201 });
  } catch (error) {
    if (isUniqueViolation(error)) return jsonError("That course already exists.", 409);
    throw error;
  }
}

export async function PATCH(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const body = await readJson<Record<string, unknown>>(request);
  const id = Number(body?.id);
  if (!Number.isInteger(id)) return jsonError("id is required.", 400);
  const [course] = await db
    .update(courses)
    .set({ isActive: body?.isActive === 1 || body?.isActive === true ? 1 : 0 })
    .where(eq(courses.id, id))
    .returning();
  if (!course) return jsonError("Course not found.", 404);
  return Response.json({ course });
}
