import { and, asc, eq, sql } from "drizzle-orm";
import { db, questions, tests } from "@db";
import { requireAdmin } from "@/lib/admin-auth";
import { isOptionKey, type OptionKey } from "@/lib/grading";
import { jsonError, normalizeTestCode, readJson, str } from "@/lib/http";

const MAX_BATCH = 500;

type QuestionInput = {
  questionNumber: number;
  questionText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  diagramUrl: string | null;
  correctAnswer: OptionKey;
};

/** Accepts both camelCase and legacy snake_case keys. */
function parseQuestion(raw: unknown, index: number): QuestionInput | string {
  if (!raw || typeof raw !== "object") return `Item ${index + 1}: must be an object.`;
  const q = raw as Record<string, unknown>;
  const pick = (...keys: string[]) => keys.map((k) => q[k]).find((v) => v !== undefined && v !== null);
  const questionNumber = Number(pick("questionNumber", "question_number"));
  const correctAnswer = str(pick("correctAnswer", "correct_answer"), 1).toUpperCase();
  const parsed = {
    questionNumber,
    questionText: str(pick("questionText", "question_text", "question"), 5000),
    optionA: str(pick("optionA", "option_a"), 1000),
    optionB: str(pick("optionB", "option_b"), 1000),
    optionC: str(pick("optionC", "option_c"), 1000),
    optionD: str(pick("optionD", "option_d"), 1000),
    diagramUrl: str(pick("diagramUrl", "diagram_url"), 1000) || null,
    correctAnswer: correctAnswer as OptionKey,
  };
  const label = `Item ${index + 1}${Number.isInteger(questionNumber) ? ` (Q${questionNumber})` : ""}`;
  if (!Number.isInteger(questionNumber) || questionNumber < 1) return `${label}: questionNumber must be a positive integer.`;
  if (!parsed.questionText) return `${label}: questionText is required.`;
  if (!parsed.optionA || !parsed.optionB || !parsed.optionC || !parsed.optionD) return `${label}: options A–D are required.`;
  if (!isOptionKey(correctAnswer)) return `${label}: correctAnswer must be A, B, C or D.`;
  if (parsed.diagramUrl && !/^https?:\/\//i.test(parsed.diagramUrl)) return `${label}: diagramUrl must be an http(s) URL.`;
  return parsed;
}

export async function GET(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const testCode = normalizeTestCode(new URL(request.url).searchParams.get("testCode"));
  if (!testCode) return jsonError("testCode is required.", 400);
  const rows = await db.select().from(questions).where(eq(questions.testCode, testCode)).orderBy(asc(questions.questionNumber));
  return Response.json({ questions: rows });
}

export async function POST(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const body = await readJson<Record<string, unknown> | unknown[]>(request);
  if (!body) return jsonError("Invalid JSON body.", 400);

  // Accepted shapes: { testCode, questions: [...] }, { testCode, question: {...} }, or { testCode, ...question }.
  const obj = (Array.isArray(body) ? {} : body) as Record<string, unknown>;
  const testCode = normalizeTestCode(obj.testCode ?? new URL(request.url).searchParams.get("testCode"));
  if (!testCode) return jsonError("testCode is required.", 400);
  const rawList = Array.isArray(body) ? body : Array.isArray(obj.questions) ? obj.questions : [obj.question ?? obj];
  if (rawList.length === 0) return jsonError("No questions supplied.", 400);
  if (rawList.length > MAX_BATCH) return jsonError(`At most ${MAX_BATCH} questions per request.`, 400);

  const parsed: QuestionInput[] = [];
  const errors: string[] = [];
  const seen = new Set<number>();
  rawList.forEach((raw, i) => {
    const q = parseQuestion(raw, i);
    if (typeof q === "string") errors.push(q);
    else if (seen.has(q.questionNumber)) errors.push(`Item ${i + 1}: duplicate question number ${q.questionNumber} in this batch.`);
    else {
      seen.add(q.questionNumber);
      parsed.push(q);
    }
  });
  if (errors.length) return jsonError("Validation failed. No questions were saved.", 400, { details: errors.slice(0, 50) });

  const [test] = await db.select({ id: tests.id }).from(tests).where(eq(tests.testCode, testCode)).limit(1);
  if (!test) return jsonError("Test not found.", 404);

  const totalQuestions = await db.transaction(async (tx) => {
    await tx
      .insert(questions)
      .values(parsed.map((q) => ({ ...q, testCode })))
      .onConflictDoUpdate({
        target: [questions.testCode, questions.questionNumber],
        set: {
          questionText: sql`excluded.question_text`,
          optionA: sql`excluded.option_a`,
          optionB: sql`excluded.option_b`,
          optionC: sql`excluded.option_c`,
          optionD: sql`excluded.option_d`,
          diagramUrl: sql`excluded.diagram_url`,
          correctAnswer: sql`excluded.correct_answer`,
        },
      });
    return syncQuestionCount(tx, testCode);
  });

  return Response.json({ saved: parsed.length, totalQuestions });
}

export async function DELETE(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const params = new URL(request.url).searchParams;
  const testCode = normalizeTestCode(params.get("testCode"));
  const questionNumber = Number(params.get("questionNumber"));
  if (!testCode || !Number.isInteger(questionNumber)) return jsonError("testCode and questionNumber are required.", 400);

  const totalQuestions = await db.transaction(async (tx) => {
    await tx.delete(questions).where(and(eq(questions.testCode, testCode), eq(questions.questionNumber, questionNumber)));
    return syncQuestionCount(tx, testCode);
  });
  return Response.json({ deleted: true, totalQuestions });
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function syncQuestionCount(tx: Tx, testCode: string) {
  const [row] = await tx
    .update(tests)
    .set({ totalQuestions: sql`(select count(*)::int from ${questions} where ${questions.testCode} = ${testCode})` })
    .where(eq(tests.testCode, testCode))
    .returning({ totalQuestions: tests.totalQuestions });
  return row?.totalQuestions ?? 0;
}
