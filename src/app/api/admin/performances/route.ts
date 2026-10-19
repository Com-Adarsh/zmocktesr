import { asc, eq } from "drizzle-orm";
import { db, performances, students } from "@db";
import { requireAdmin } from "@/lib/admin-auth";
import { jsonError, normalizeTestCode } from "@/lib/http";

export async function GET(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const testCode = normalizeTestCode(new URL(request.url).searchParams.get("testCode"));
  if (!testCode) return jsonError("testCode is required.", 400);

  const rows = await db
    .select({
      id: performances.id,
      rank: performances.rank,
      registrationId: students.registrationId,
      fullName: students.fullName,
      email: students.email,
      phone: students.phone,
      coursePreference: students.coursePreference,
      score: performances.score,
      maxScore: performances.maxScore,
      percentage: performances.percentage,
      correctCount: performances.correctCount,
      wrongCount: performances.wrongCount,
      unansweredCount: performances.unansweredCount,
      timeTakenSeconds: performances.timeTakenSeconds,
      completedAt: performances.completedAt,
    })
    .from(performances)
    .innerJoin(students, eq(students.id, performances.studentId))
    .where(eq(performances.testCode, testCode))
    .orderBy(asc(performances.rank));
  return Response.json({ performances: rows });
}
