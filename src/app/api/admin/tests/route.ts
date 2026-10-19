import { desc, eq, sql } from "drizzle-orm";
import { db, performances, tests } from "@db";
import { requireAdmin } from "@/lib/admin-auth";
import { isUniqueViolation, jsonError, normalizeTestCode, readJson, str } from "@/lib/http";
import { normalizeMarkingScheme } from "@/lib/grading";

const TEST_CODE_RE = /^[A-Z0-9][A-Z0-9_-]{1,63}$/;

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  const counts = db
    .select({ testCode: performances.testCode, submissions: sql<number>`count(*)::int`.as("submissions") })
    .from(performances)
    .groupBy(performances.testCode)
    .as("counts");

  const rows = await db
    .select({
      id: tests.id,
      testCode: tests.testCode,
      title: tests.title,
      description: tests.description,
      durationMinutes: tests.durationMinutes,
      totalQuestions: tests.totalQuestions,
      isActive: tests.isActive,
      markingScheme: tests.markingScheme,
      createdAt: tests.createdAt,
      submissions: sql<number>`coalesce(${counts.submissions}, 0)`,
    })
    .from(tests)
    .leftJoin(counts, eq(counts.testCode, tests.testCode))
    .orderBy(desc(tests.createdAt));

  return Response.json({ tests: rows.map((t) => ({ ...t, _count: { performances: t.submissions } })) });
}

export async function POST(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const body = await readJson<Record<string, unknown>>(request);
  if (!body) return jsonError("Invalid JSON body.", 400);

  const testCode = normalizeTestCode(body.testCode);
  const title = str(body.title, 200);
  const durationMinutes = Number(body.durationMinutes ?? 120);
  if (!TEST_CODE_RE.test(testCode)) return jsonError("Test code must be 2–64 letters, digits, '-' or '_'.", 400);
  if (!title) return jsonError("Title is required.", 400);
  if (!Number.isInteger(durationMinutes) || durationMinutes < 1 || durationMinutes > 600) {
    return jsonError("Duration must be between 1 and 600 minutes.", 400);
  }

  try {
    const [test] = await db
      .insert(tests)
      .values({
        testCode,
        title,
        description: str(body.description, 2000) || null,
        durationMinutes,
        isActive: body.isActive === 1 || body.isActive === true ? 1 : 0,
        markingScheme: normalizeMarkingScheme(body.markingScheme),
      })
      .returning();
    return Response.json({ test }, { status: 201 });
  } catch (error) {
    if (isUniqueViolation(error)) return jsonError(`A test with code ${testCode} already exists.`, 409);
    throw error;
  }
}

export async function PATCH(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const body = await readJson<Record<string, unknown>>(request);
  const testCode = normalizeTestCode(body?.testCode);
  if (!body || !testCode) return jsonError("testCode is required.", 400);

  const update: Partial<typeof tests.$inferInsert> = {};
  if (body.isActive !== undefined) update.isActive = body.isActive === 1 || body.isActive === true ? 1 : 0;
  if (body.title !== undefined) {
    const title = str(body.title, 200);
    if (!title) return jsonError("Title cannot be empty.", 400);
    update.title = title;
  }
  if (body.description !== undefined) update.description = str(body.description, 2000) || null;
  if (body.durationMinutes !== undefined) {
    const d = Number(body.durationMinutes);
    if (!Number.isInteger(d) || d < 1 || d > 600) return jsonError("Duration must be between 1 and 600 minutes.", 400);
    update.durationMinutes = d;
  }
  if (body.markingScheme !== undefined) update.markingScheme = normalizeMarkingScheme(body.markingScheme);
  if (Object.keys(update).length === 0) return jsonError("Nothing to update.", 400);

  const [test] = await db.update(tests).set(update).where(eq(tests.testCode, testCode)).returning();
  if (!test) return jsonError("Test not found.", 404);
  return Response.json({ test });
}
