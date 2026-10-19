export type OptionKey = "A" | "B" | "C" | "D";
export type Responses = Record<string, OptionKey>;
export type MarkingScheme = { positive: number; negative: number };

export const OPTION_KEYS: readonly OptionKey[] = ["A", "B", "C", "D"];

export function isOptionKey(value: unknown): value is OptionKey {
  return typeof value === "string" && (OPTION_KEYS as readonly string[]).includes(value);
}

/**
 * Normalises untrusted client responses to the `{ "1": "A", ... }` contract.
 * Keys that are not valid question numbers for this paper and values that are not A–D are dropped,
 * so unanswered questions stay omitted.
 */
export function sanitizeResponses(raw: unknown, validQuestionNumbers: Iterable<number>): Responses {
  const valid = new Set(Array.from(validQuestionNumbers, String));
  const clean: Responses = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return clean;
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const option = typeof value === "string" ? value.trim().toUpperCase() : value;
    if (valid.has(String(Number(key))) && isOptionKey(option)) clean[String(Number(key))] = option;
  }
  return clean;
}

export function normalizeMarkingScheme(raw: unknown): MarkingScheme {
  const scheme = (raw && typeof raw === "object" ? raw : {}) as Partial<Record<string, unknown>>;
  const positive = Number(scheme.positive);
  const negative = Number(scheme.negative);
  return {
    positive: Number.isFinite(positive) ? positive : 4,
    // Legacy rows may store the penalty as either 1 or -1; it is always subtracted.
    negative: Number.isFinite(negative) ? Math.abs(negative) : 1,
  };
}

export type ExamEvaluation = {
  score: number;
  maxScore: number;
  percentage: number;
  correctCount: number;
  wrongCount: number;
  unansweredCount: number;
  attemptedCount: number;
  accuracy: number;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Server-side grading against the authoritative answer key. */
export function evaluateExam(
  answerKey: ReadonlyArray<{ questionNumber: number; correctAnswer: string }>,
  responses: Responses,
  markingScheme: MarkingScheme,
): ExamEvaluation {
  let correctCount = 0;
  let wrongCount = 0;
  for (const { questionNumber, correctAnswer } of answerKey) {
    const selected = responses[String(questionNumber)];
    if (!selected) continue;
    if (selected === correctAnswer.trim().toUpperCase()) correctCount++;
    else wrongCount++;
  }
  const total = answerKey.length;
  const attemptedCount = correctCount + wrongCount;
  const score = round2(correctCount * markingScheme.positive - wrongCount * markingScheme.negative);
  const maxScore = round2(total * markingScheme.positive);
  return {
    score,
    maxScore,
    percentage: maxScore > 0 ? round2((score / maxScore) * 100) : 0,
    correctCount,
    wrongCount,
    unansweredCount: total - attemptedCount,
    attemptedCount,
    accuracy: attemptedCount > 0 ? round2((correctCount / attemptedCount) * 100) : 0,
  };
}
