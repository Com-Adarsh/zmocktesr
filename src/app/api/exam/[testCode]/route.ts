import { and, asc, eq } from "drizzle-orm";
import { db, questions, tests } from "@db";
import { jsonError, normalizeTestCode } from "@/lib/http";
import { normalizeMarkingScheme } from "@/lib/grading";

export async function GET(_request: Request, { params }: { params: Promise<{ testCode: string }> }) {
  const testCode = normalizeTestCode((await params).testCode);

  const [test] = await db
    .select({
      testCode: tests.testCode,
      title: tests.title,
      description: tests.description,
      durationMinutes: tests.durationMinutes,
      totalQuestions: tests.totalQuestions,
      markingScheme: tests.markingScheme,
    })
    .from(tests)
    .where(and(eq(tests.testCode, testCode), eq(tests.isActive, 1)))
    .limit(1);
  if (!test) return jsonError("This test is not available.", 404);

  // Anti-cheat projection: correct_answer is deliberately never selected.
  const paper = await db
    .select({
      questionNumber: questions.questionNumber,
      questionText: questions.questionText,
      optionA: questions.optionA,
      optionB: questions.optionB,
      optionC: questions.optionC,
      optionD: questions.optionD,
      diagramUrl: questions.diagramUrl,
    })
    .from(questions)
    .where(eq(questions.testCode, testCode))
    .orderBy(asc(questions.questionNumber));

  return Response.json(
    { test: { ...test, markingScheme: normalizeMarkingScheme(test.markingScheme), totalQuestions: paper.length }, questions: paper },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
