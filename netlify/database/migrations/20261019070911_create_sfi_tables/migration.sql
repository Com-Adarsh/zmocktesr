CREATE TABLE "admin_sessions" (
	"id" serial PRIMARY KEY,
	"token" text NOT NULL UNIQUE,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "courses" (
	"id" serial PRIMARY KEY,
	"course_name" text NOT NULL UNIQUE,
	"level" text DEFAULT 'UG' NOT NULL,
	"is_active" smallint DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "performances" (
	"id" serial PRIMARY KEY,
	"student_id" integer NOT NULL,
	"test_code" text NOT NULL,
	"score" double precision NOT NULL,
	"max_score" double precision NOT NULL,
	"percentage" double precision NOT NULL,
	"correct_count" integer NOT NULL,
	"wrong_count" integer NOT NULL,
	"unanswered_count" integer NOT NULL,
	"rank" integer,
	"time_taken_seconds" integer NOT NULL,
	"responses" jsonb DEFAULT '{}' NOT NULL,
	"completed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "questions" (
	"id" serial PRIMARY KEY,
	"test_code" text NOT NULL,
	"question_number" integer NOT NULL,
	"question_text" text NOT NULL,
	"option_a" text NOT NULL,
	"option_b" text NOT NULL,
	"option_c" text NOT NULL,
	"option_d" text NOT NULL,
	"diagram_url" text,
	"correct_answer" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "students" (
	"id" serial PRIMARY KEY,
	"registration_id" text NOT NULL UNIQUE,
	"full_name" text NOT NULL,
	"email" text NOT NULL UNIQUE,
	"phone" text,
	"photo_url" text,
	"course_preference" text,
	"test_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tests" (
	"id" serial PRIMARY KEY,
	"test_code" text NOT NULL UNIQUE,
	"title" text NOT NULL,
	"description" text,
	"duration_minutes" integer DEFAULT 120 NOT NULL,
	"total_questions" integer DEFAULT 0 NOT NULL,
	"is_active" smallint DEFAULT 0 NOT NULL,
	"marking_scheme" jsonb DEFAULT '{"positive":4,"negative":1}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "performances_test_code_score_idx" ON "performances" ("test_code","score");--> statement-breakpoint
CREATE INDEX "performances_student_id_test_code_idx" ON "performances" ("student_id","test_code");--> statement-breakpoint
CREATE UNIQUE INDEX "questions_test_code_question_number_key" ON "questions" ("test_code","question_number");--> statement-breakpoint
CREATE INDEX "students_email_idx" ON "students" ("email");--> statement-breakpoint
CREATE INDEX "students_test_code_idx" ON "students" ("test_code");--> statement-breakpoint
ALTER TABLE "performances" ADD CONSTRAINT "performances_student_id_students_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "performances" ADD CONSTRAINT "performances_test_code_tests_test_code_fkey" FOREIGN KEY ("test_code") REFERENCES "tests"("test_code") ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_test_code_tests_test_code_fkey" FOREIGN KEY ("test_code") REFERENCES "tests"("test_code") ON DELETE CASCADE ON UPDATE CASCADE;