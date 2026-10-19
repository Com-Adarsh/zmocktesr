# SFI CUSAT Mock Test

An independent, course-based mock-test platform built with Next.js, TypeScript, and Supabase. It does not redirect students to the previous mock-test service. No courses, question papers, rankings, student counts, or performance claims are seeded; the catalogue is populated only by authorised administrators.

## Implemented

- Responsive public home page, published course catalogue, course pages, and test-code lookup.
- Student email/password registration and sign-in through Supabase Auth.
- Server-checked administrator, mediator, and student route/API permissions.
- Administrator course and test draft management (including edit, unpublish, archive, restore and code rotation), mediator invitations and course assignment/revocation, paper preview, and publication checks.
- Test-specific student assignment for restricted papers.
- Mediator draft test creation/editing, review requests, and validated, replaceable bulk JSON question import.
- Server-validated test access and attempt limits, saved responses, question navigation, review marks, timer/timeout submission, server-side scoring, and gated answer review.
- Student attempt history and administrator attempt reports.
- PostgreSQL migration with Row Level Security and transactional database functions.

## Local setup

Requirements: Node.js 20.9 or newer, npm, and a Supabase project.

1. Install packages: `npm install`.
2. Copy `.env.example` to `.env.local` and set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
3. Apply `supabase/migrations/202610180001_initial_schema.sql` to a new or approved development Supabase project.
4. Set the first administrator using the trusted Supabase SQL editor; see [the administrator guide](docs/ADMIN_GUIDE.md).
5. Set `SUPABASE_SERVICE_ROLE_KEY` in the server environment only to enable mediator invitations. Never expose it as a `NEXT_PUBLIC_` variable.
6. Run `npm run dev` and open <http://localhost:3000>.

The database is a required dependency. Without Supabase configuration the app displays an explicit setup state; it does not substitute local fake records.

## Commands

```sh
npm test
npm run lint
npm run build
```

## Setup and operating notes

- [Admin and mediator guide](docs/ADMIN_GUIDE.md)
- [Deployment guide](docs/DEPLOYMENT.md)
- [Data preservation and migration report](docs/DATA_PRESERVATION.md)
- [Question JSON template](public/question-template.json)

## Limitations and required manual setup

- No Supabase project credentials are available in this repository, so database integration, authentication, invitations, and exam transactions require configuration and staging verification.
- The migration assumes the Supabase Auth and Storage schemas available in Supabase. Apply it to staging first and inspect policies before production.
- Only JSON bulk import is implemented. CSV, PDF/DOCX extraction, question images, and automated section-wise analytics are not enabled.
- Short answers are graded by normalized exact text comparison.
- No historical accounts, files, attempts, scores, or private data have been migrated. The prior static reconstruction contained only public-facing page content and no verified backend access.
- Section-wise performance analytics, CSV/PDF/DOCX import, question-image uploads, and server-scheduled expiration for students who never reconnect are not implemented.
- No production deployment, DNS change, or data migration has been performed.
