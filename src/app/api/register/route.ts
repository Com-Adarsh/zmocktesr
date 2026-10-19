import { and, eq, sql } from "drizzle-orm";
import { db, students, tests } from "@db";
import { isUniqueViolation, jsonError, normalizeTestCode, readJson, str } from "@/lib/http";
import { generateRegistrationId } from "@/lib/registration";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  const body = await readJson<Record<string, unknown>>(request);
  if (!body) return jsonError("Invalid JSON body.", 400);

  const fullName = str(body.fullName ?? body.name, 120);
  const email = str(body.email, 254).toLowerCase();
  const phone = str(body.phone, 20) || null;
  const photoUrl = str(body.photoUrl, 1000) || null;
  const coursePreference = str(body.coursePreference, 200) || null;
  const testCode = normalizeTestCode(body.testCode);

  if (!email || !EMAIL_RE.test(email)) return jsonError("A valid email address is required.", 400);
  if (!testCode) return jsonError("Test code is required.", 400);
  if (photoUrl && !/^https?:\/\//i.test(photoUrl)) return jsonError("Photo URL must start with http(s)://", 400);

  const [test] = await db
    .select({ testCode: tests.testCode, title: tests.title })
    .from(tests)
    .where(and(eq(tests.testCode, testCode), eq(tests.isActive, 1)))
    .limit(1);
  if (!test) return jsonError("This test code is invalid or the test is not active.", 404);

  // Repeat lookup: existing candidates only get their test assignment and course preference refreshed.
  const [existing] = await db
    .select({ id: students.id })
    .from(students)
    .where(eq(students.email, email))
    .limit(1);

  if (existing) {
    const [student] = await db
      .update(students)
      .set({
        testCode,
        ...(coursePreference ? { coursePreference } : {}),
        updatedAt: new Date(),
      })
      .where(eq(students.id, existing.id))
      .returning();
    return Response.json({ student: publicStudent(student), test, returning: true });
  }

  if (!fullName) return jsonError("Full name is required for new registrations.", 400);

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const [student] = await db
        .insert(students)
        .values({ registrationId: generateRegistrationId(), fullName, email, phone, photoUrl, coursePreference, testCode })
        // A concurrent request for the same email lands here instead of raising a duplicate-key error.
        .onConflictDoUpdate({
          target: students.email,
          set: { testCode, coursePreference: sql`coalesce(excluded.course_preference, ${students.coursePreference})`, updatedAt: new Date() },
        })
        .returning();
      return Response.json({ student: publicStudent(student), test, returning: false }, { status: 201 });
    } catch (error) {
      // Registration ID collision: retry with a fresh random suffix.
      if (isUniqueViolation(error)) continue;
      throw error;
    }
  }
  return jsonError("Could not allocate a registration ID. Please try again.", 503);
}

function publicStudent(s: typeof students.$inferSelect) {
  return {
    id: s.id,
    registrationId: s.registrationId,
    fullName: s.fullName,
    email: s.email,
    photoUrl: s.photoUrl,
    coursePreference: s.coursePreference,
    testCode: s.testCode,
  };
}
