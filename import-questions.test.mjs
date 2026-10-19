import assert from "node:assert/strict";
import test from "node:test";
import { validateQuestionImport } from "../lib/import-questions.ts";

test("accepts supported question types and preserves optional metadata", () => {
  const result = validateQuestionImport([
    { question: "Choose one", type: "single_choice", options: ["A", "B"], answer: "A", marks: 2, section: "Math" },
    { question: "Choose many", type: "multiple_select", options: ["A", "B"], answer: ["A", "B"] },
    { question: "True?", type: "true_false", answer: "true" },
    { question: "Short response", type: "short_answer", answer: "CUSAT" },
  ]);
  assert.deepEqual(result.errors, []);
  assert.equal(result.questions.length, 4);
  assert.equal(result.questions[0].section, "Math");
});

test("reports empty input and malformed rows with row numbers", () => {
  assert.match(validateQuestionImport([]).errors[0], /non-empty/);
  const result = validateQuestionImport([{ question: "", type: "unknown", answer: null }]);
  assert.ok(result.errors.some((error) => /Row 1/.test(error)));
  assert.ok(result.errors.some((error) => /type is invalid/.test(error)));
});

test("rejects duplicate ids and answers that do not match available choices", () => {
  const result = validateQuestionImport([
    { external_id: "same", question: "One", type: "single_choice", options: ["A", "B"], answer: "C" },
    { external_id: "same", question: "Two", type: "multiple_select", options: ["A", "B"], answer: ["C"] },
  ]);
  assert.ok(result.errors.some((error) => /duplicate external_id/.test(error)));
  assert.ok(result.errors.some((error) => /single_choice answer/.test(error)));
  assert.ok(result.errors.some((error) => /multiple_select answer/.test(error)));
});

test("rejects duplicate options, negative marks and oversized question text", () => {
  const result = validateQuestionImport([{
    question: "Q".repeat(10001), type: "single_choice", options: ["A", "A"], answer: "A", marks: -1,
  }]);
  assert.ok(result.errors.some((error) => /10,000/.test(error)));
  assert.ok(result.errors.some((error) => /duplicate options/.test(error)));
  assert.ok(result.errors.some((error) => /marks must be a non-negative/.test(error)));
});
