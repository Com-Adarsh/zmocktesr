import { asc, eq, isNotNull, and } from "drizzle-orm";
import { db, performances, students } from "@db";
import { normalizeTestCode } from "@/lib/http";

export async function GET(_request: Request, { params }: { params: Promise<{ testCode: string }> }) {
  const testCode = normalizeTestCode((await params).testCode);
  const rows = await db
    .select({
      rank: performances.rank,
      fullName: students.fullName,
      score: performances.score,
      percentage: performances.percentage,
      timeTakenSeconds: performances.timeTakenSeconds,
    })
    .from(performances)
    .innerJoin(students, eq(students.id, performances.studentId))
    .where(and(eq(performances.testCode, testCode), isNotNull(performances.rank)))
    .orderBy(asc(performances.rank))
    .limit(25);
  return Response.json({ testCode, leaderboard: rows }, { headers: { "Cache-Control": "public, max-age=15" } });
}
