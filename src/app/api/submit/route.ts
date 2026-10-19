import { and, eq, sql } from "drizzle-orm";
import { db, performances, questions, students, tests } from "@db";
import { evaluateExam, normalizeMarkingScheme, sanitizeResponses } from "@/lib/grading";
import { jsonError, normalizeTestCode, readJson } from "@/lib/http";

// Grace period for network latency on auto-submit when the timer expires.
const TIME_GRACE_SECONDS = 120;

export async function POST(request: Request) {
  const body = await readJson<Record<string, unknown>>(request);
  if (!body) return jsonError("Invalid JSON body.", 400);

  const studentId = Number(body.studentId);
  const testCode = normalizeTestCode(body.testCode);
  if (!Number.isInteger(studentId) || studentId <= 0 || !testCode) {
    return jsonError("studentId and testCode are required.", 400);
  }

  const [test] = await db
    .select({ testCode: tests.testCode, isActive: tests.isActive, durationMinutes: tests.durationMinutes, markingScheme: tests.markingScheme })
    .from(tests)
    .where(eq(tests.testCode, testCode))
    .limit(1);
  if (!test || test.isActive !== 1) return jsonError("This test is not accepting submissions.", 404);

  const [student] = await db
    .select({ id: students.id, testCode: students.testCode })
    .from(students)
    .where(eq(students.id, studentId))
    .limit(1);
  if (!student) return jsonError("Candidate not found. Please register again.", 404);
  if (student.testCode !== testCode) return jsonError("This candidate is not registered for this test.", 403);

  const answerKey = await db
    .select({ questionNumber: questions.questionNumber, correctAnswer: questions.correctAnswer })
    .from(questions)
    .where(eq(questions.testCode, testCode));
  if (answerKey.length === 0) return jsonError("This test has no questions.", 409);

  const responses = sanitizeResponses(body.responses, answerKey.map((q) => q.questionNumber));
  const maxSeconds = test.durationMinutes * 60;
  const rawTime = Math.round(Number(body.timeTakenSeconds));
  if (Number.isFinite(rawTime) && rawTime > maxSeconds + TIME_GRACE_SECONDS) {
    return jsonError("Submission received after the exam time limit.", 409);
  }
  const timeTakenSeconds = Math.min(Math.max(Number.isFinite(rawTime) ? rawTime : maxSeconds, 0), maxSeconds);
  const result = evaluateExam(answerKey, responses, normalizeMarkingScheme(test.markingScheme));

  const outcome = await db.transaction(async (tx) => {
    // Serialise rank recalculation per test so concurrent submissions never interleave or deadlock.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${"sfi_rank:" + testCode}))`);

    const [previous] = await tx
      .select({ id: performances.id })
      .from(performances)
      .where(and(eq(performances.studentId, studentId), eq(performances.testCode, testCode)))
      .limit(1);
    if (previous) return { duplicate: true as const, performanceId: previous.id };

    const [inserted] = await tx
      .insert(performances)
      .values({
        studentId,
        testCode,
        score: result.score,
        maxScore: result.maxScore,
        percentage: result.percentage,
        correctCount: result.correctCount,
        wrongCount: result.wrongCount,
        unansweredCount: result.unansweredCount,
        timeTakenSeconds,
        responses,
      })
      .returning({ id: performances.id });

    // Single set-based statement assigns All-India Ranks 1..N for the whole test.
    await tx.execute(sql`
      update ${performances} p
      set rank = ranked.rn
      from (
        select id, row_number() over (
          order by score desc, time_taken_seconds asc, completed_at asc, id asc
        )::int as rn
        from ${performances}
        where test_code = ${testCode}
      ) ranked
      where p.id = ranked.id and p.rank is distinct from ranked.rn
    `);
    return { duplicate: false as const, performanceId: inserted.id };
  });

  const [performance] = await db
    .select()
    .from(performances)
    .where(eq(performances.id, outcome.performanceId))
    .limit(1);
  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(performances)
    .where(eq(performances.testCode, testCode));

  const summary = {
    performanceId: performance.id,
    score: performance.score,
    maxScore: performance.maxScore,
    percentage: performance.percentage,
    correctCount: performance.correctCount,
    wrongCount: performance.wrongCount,
    unansweredCount: performance.unansweredCount,
    accuracy:
      performance.correctCount + performance.wrongCount > 0
        ? Math.round((performance.correctCount / (performance.correctCount + performance.wrongCount)) * 10000) / 100
        : 0,
    timeTakenSeconds: performance.timeTakenSeconds,
    rank: performance.rank,
    totalCandidates: total,
    completedAt: performance.completedAt,
  };

  if (outcome.duplicate) {
    return Response.json({ error: "You have already submitted this test.", alreadySubmitted: true, result: summary }, { status: 409 });
  }
  return Response.json({ result: summary }, { status: 201 });
}
