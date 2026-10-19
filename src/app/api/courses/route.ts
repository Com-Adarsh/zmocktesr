import { asc, eq } from "drizzle-orm";
import { db, courses } from "@db";

export async function GET() {
  const rows = await db
    .select({ id: courses.id, courseName: courses.courseName, level: courses.level })
    .from(courses)
    .where(eq(courses.isActive, 1))
    .orderBy(asc(courses.level), asc(courses.courseName));
  return Response.json({ courses: rows });
}
