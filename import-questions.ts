export type ImportedQuestion = {
  external_id?: string;
  question: string;
  type: "single_choice" | "multiple_select" | "true_false" | "short_answer";
  options?: string[];
  answer: string | string[];
  marks?: number;
  negative_marks?: number;
  explanation?: string;
  section?: string;
  topic?: string;
};

export function validateQuestionImport(input: unknown): { questions?: ImportedQuestion[]; errors: string[] } {
  if (!Array.isArray(input) || input.length === 0) {
    return { errors: ["Provide a non-empty JSON array of questions."] };
  }
  const errors: string[] = [];
  const seenIds = new Set<string>();
  const questions: ImportedQuestion[] = [];
  const types = new Set(["single_choice", "multiple_select", "true_false", "short_answer"]);

  input.forEach((item: unknown, index) => {
    const row = index + 1;
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      errors.push(`Row ${row}: question must be an object.`);
      return;
    }
    const q = item as Record<string, unknown>;
    const rowErrors: string[] = [];
    if (typeof q.question !== "string" || !q.question.trim()) rowErrors.push(`Row ${row}: question text is required.`);
    else if (q.question.length > 10000) rowErrors.push(`Row ${row}: question text must be 10,000 characters or fewer.`);
    if (typeof q.type !== "string" || !types.has(q.type)) rowErrors.push(`Row ${row}: question type is invalid.`);
    if (typeof q.answer !== "string" && !(Array.isArray(q.answer) && q.answer.every((v) => typeof v === "string"))) {
      rowErrors.push(`Row ${row}: answer must be a string or an array of strings.`);
    }
    if (typeof q.external_id === "string") {
      if (seenIds.has(q.external_id)) rowErrors.push(`Row ${row}: duplicate external_id "${q.external_id}".`);
      seenIds.add(q.external_id);
    }
    const type = q.type;
    const options = Array.isArray(q.options) ? q.options : [];
    if ((type === "single_choice" || type === "multiple_select") &&
        (!Array.isArray(q.options) || q.options.length < 2 || q.options.length > 20 ||
          !q.options.every((option) => typeof option === "string" && option.trim() && option.length <= 500))) {
      rowErrors.push(`Row ${row}: choice questions need at least two non-empty options.`);
    }
    if (Array.isArray(q.options) && new Set(q.options).size !== q.options.length) rowErrors.push(`Row ${row}: duplicate options are not allowed.`);
    if (type === "single_choice" && (typeof q.answer !== "string" || !Array.isArray(q.options) || !q.options.includes(q.answer))) {
      rowErrors.push(`Row ${row}: single_choice answer must match one option.`);
    }
    if (type === "multiple_select" && (!Array.isArray(q.answer) || q.answer.length === 0 || !Array.isArray(q.options) ||
        !q.answer.every((answer) => typeof answer === "string" && options.includes(answer)))) {
      rowErrors.push(`Row ${row}: multiple_select answer must contain one or more matching options.`);
    }
    if (Array.isArray(q.answer) && new Set(q.answer).size !== q.answer.length) {
      rowErrors.push(`Row ${row}: duplicate answers are not allowed.`);
    }
    if (type === "true_false" && !["true", "false"].includes(String(q.answer).toLowerCase())) {
      rowErrors.push(`Row ${row}: true_false answer must be "true" or "false".`);
    }
    if (type === "short_answer" && (typeof q.answer !== "string" || !q.answer.trim())) {
      rowErrors.push(`Row ${row}: short_answer answer must be a non-empty string.`);
    }
    for (const field of ["marks", "negative_marks"] as const) {
      if (q[field] !== undefined && (typeof q[field] !== "number" || !Number.isFinite(q[field]) || q[field] < 0)) {
        rowErrors.push(`Row ${row}: ${field} must be a non-negative number.`);
      }
    }
    for (const field of ["explanation", "section", "topic"] as const) {
      if (q[field] !== undefined && (typeof q[field] !== "string" || q[field].length > 10000)) rowErrors.push(`Row ${row}: ${field} must be a string of at most 10,000 characters.`);
    }
    if (q.external_id !== undefined && typeof q.external_id !== "string") rowErrors.push(`Row ${row}: external_id must be a string.`);

    if (rowErrors.length) errors.push(...rowErrors);
    else {
      questions.push({
        ...(typeof q.external_id === "string" ? { external_id: q.external_id } : {}),
        question: q.question as string,
        type: q.type as ImportedQuestion["type"],
        ...(Array.isArray(q.options) ? { options: q.options as string[] } : {}),
        answer: q.answer as string | string[],
        ...(typeof q.marks === "number" ? { marks: q.marks } : {}),
        ...(typeof q.negative_marks === "number" ? { negative_marks: q.negative_marks } : {}),
        ...(typeof q.explanation === "string" ? { explanation: q.explanation } : {}),
        ...(typeof q.section === "string" ? { section: q.section } : {}),
        ...(typeof q.topic === "string" ? { topic: q.topic } : {}),
      });
    }
  });
  return errors.length ? { errors } : { questions, errors: [] };
}
