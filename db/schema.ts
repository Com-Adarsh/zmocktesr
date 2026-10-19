import {
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  smallint,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/** `tests.marking_scheme` — e.g. `{ "positive": 4, "negative": 1 }` */
export type MarkingScheme = { positive: number; negative: number };

export type OptionKey = "A" | "B" | "C" | "D";

/** `performances.responses` — question_number (string key) → selected option. Unanswered questions are omitted. */
export type Responses = Record<string, OptionKey>;

export const students = pgTable(
  "students",
  {
    id: serial().primaryKey(),
    registrationId: text("registration_id").notNull().unique(),
    fullName: text("full_name").notNull(),
    email: text().notNull().unique(),
    phone: text(),
    photoUrl: text("photo_url"),
    coursePreference: text("course_preference"),
    testCode: text("test_code"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("students_email_idx").on(t.email), index("students_test_code_idx").on(t.testCode)],
);

export const tests = pgTable("tests", {
  id: serial().primaryKey(),
  testCode: text("test_code").notNull().unique(),
  title: text().notNull(),
  description: text(),
  durationMinutes: integer("duration_minutes").notNull().default(120),
  totalQuestions: integer("total_questions").notNull().default(0),
  isActive: smallint("is_active").notNull().default(0),
  markingScheme: jsonb("marking_scheme")
    .$type<MarkingScheme>()
    .notNull()
    .default({ positive: 4, negative: 1 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const questions = pgTable(
  "questions",
  {
    id: serial().primaryKey(),
    testCode: text("test_code")
      .notNull()
      .references(() => tests.testCode, { onDelete: "cascade", onUpdate: "cascade" }),
    questionNumber: integer("question_number").notNull(),
    questionText: text("question_text").notNull(),
    optionA: text("option_a").notNull(),
    optionB: text("option_b").notNull(),
    optionC: text("option_c").notNull(),
    optionD: text("option_d").notNull(),
    diagramUrl: text("diagram_url"),
    correctAnswer: text("correct_answer").$type<OptionKey>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("questions_test_code_question_number_key").on(t.testCode, t.questionNumber)],
);

export const performances = pgTable(
  "performances",
  {
    id: serial().primaryKey(),
    studentId: integer("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    testCode: text("test_code")
      .notNull()
      .references(() => tests.testCode, { onUpdate: "cascade" }),
    score: doublePrecision().notNull(),
    maxScore: doublePrecision("max_score").notNull(),
    percentage: doublePrecision().notNull(),
    correctCount: integer("correct_count").notNull(),
    wrongCount: integer("wrong_count").notNull(),
    unansweredCount: integer("unanswered_count").notNull(),
    rank: integer(),
    timeTakenSeconds: integer("time_taken_seconds").notNull(),
    responses: jsonb().$type<Responses>().notNull().default({}),
    completedAt: timestamp("completed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("performances_test_code_score_idx").on(t.testCode, t.score),
    index("performances_student_id_test_code_idx").on(t.studentId, t.testCode),
  ],
);

export const courses = pgTable("courses", {
  id: serial().primaryKey(),
  courseName: text("course_name").notNull().unique(),
  level: text().notNull().default("UG"),
  isActive: smallint("is_active").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const adminSessions = pgTable("admin_sessions", {
  id: serial().primaryKey(),
  token: text().notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
