# Administrator and mediator guide

## First administrator

There is deliberately no public administrator registration. After configuring the Supabase project and applying the migration, create the first trusted user through Supabase Auth. In the Supabase SQL editor, set that known user's role from `student` to `admin` by matching the verified UUID:

```sql
update public.profiles
set role = 'admin'
where id = '<verified-auth-user-uuid>';
```

Do not expose the service-role key or grant administrator status to an unverified account. The first administrator can then sign in and open `/admin`.

## Administrator tasks

1. Create a course with a stable lowercase slug.
2. Publish the course when it is ready to appear in the student catalogue.
3. Create mediator invitations, assigning only the courses each mediator needs. Supabase email invitations and `SUPABASE_SERVICE_ROLE_KEY` must be configured.
4. Create a test draft, set its duration, scoring, attempt limit, access mode and answer-release policy.
5. For assigned-access tests, select student accounts in the test's assigned-students panel.
6. Review all uploaded questions and answer keys, adjust draft settings as needed, and publish only after checking the paper. Tests with started attempts cannot have their answer key or scoring settings changed.
7. Use `/admin/reports` to review actual attempts. Reports do not include invented rankings or percentiles.

The database refuses test publication if its course is unpublished, no questions exist, or any question lacks an answer key. Test access and scoring are checked in database functions rather than trusted from the browser.

## Mediator tasks

1. Accept the administrator's invitation and sign in.
2. Open `/mediator`; only assigned courses are listed.
3. Create a draft in an assigned course.
4. Download the JSON template and paste a completed question array into the import field.
5. Correct every validation error, preview the test paper, edit the draft as needed, and submit it for administrator review.

Mediators cannot publish tests, invite accounts, create courses, access unrelated course records, or manage global settings. Uploads are transactional; a failed import does not partially add questions.

## JSON import format

The file `public/question-template.json` is the canonical example. The upload endpoint accepts a non-empty JSON array with these fields:

- `question`: required question text.
- `type`: `single_choice`, `multiple_select`, `true_false`, or `short_answer`.
- `options`: at least two distinct strings for choice questions.
- `answer`: a string matching one choice, an array of strings matching multiple choices, or `"true"` / `"false"` for true/false. Short answers use a string.
- `external_id`, `marks`, `negative_marks`, `explanation`, `section`, and `topic`: optional; IDs must be unique within a test and marks must be non-negative numbers.

The import reports row-specific validation issues. Only JSON is currently implemented; PDF/DOCX extraction, question images, and CSV import are not enabled.
