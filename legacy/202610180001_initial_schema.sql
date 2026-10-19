create extension if not exists pgcrypto;

create type public.app_role as enum ('admin', 'mediator', 'student');
create type public.question_type as enum ('single_choice', 'multiple_select', 'true_false', 'short_answer');
create type public.attempt_status as enum ('in_progress', 'submitted');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.app_role not null default 'student',
  display_name text,
  created_at timestamptz not null default now()
);

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text not null default '',
  is_published boolean not null default false,
  is_archived boolean not null default false,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.mediator_assignments (
  mediator_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (mediator_id, course_id)
);

create table public.tests (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id),
  created_by uuid not null references public.profiles(id),
  title text not null,
  test_code text not null unique,
  instructions text not null default '',
  duration_minutes integer not null check (duration_minutes between 1 and 1440),
  correct_marks numeric(8, 2) not null default 4 check (correct_marks >= 0),
  negative_marks numeric(8, 2) not null default 0 check (negative_marks >= 0),
  attempt_limit integer not null default 1 check (attempt_limit between 1 and 100),
  access_mode text not null default 'code' check (access_mode in ('public', 'code', 'assigned')),
  starts_at timestamptz,
  ends_at timestamptz,
  release_answers boolean not null default false,
  review_requested_at timestamptz,
  is_published boolean not null default false,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);

create index tests_course_published_idx on public.tests(course_id, is_published);
create index tests_code_idx on public.tests(test_code);

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  test_id uuid not null references public.tests(id) on delete cascade,
  external_id text,
  position integer not null check (position > 0),
  question_text text not null,
  question_type public.question_type not null,
  options jsonb not null default '[]'::jsonb,
  marks numeric(8, 2) check (marks is null or marks >= 0),
  negative_marks numeric(8, 2) check (negative_marks is null or negative_marks >= 0),
  explanation text,
  section text,
  topic text,
  created_at timestamptz not null default now(),
  unique (test_id, position),
  unique (test_id, external_id)
);

create table public.answer_keys (
  question_id uuid primary key references public.questions(id) on delete cascade,
  answer jsonb not null
);

create table public.attempts (
  id uuid primary key default gen_random_uuid(),
  test_id uuid not null references public.tests(id),
  student_id uuid not null references public.profiles(id),
  status public.attempt_status not null default 'in_progress',
  started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  submitted_at timestamptz,
  score numeric(10, 2),
  maximum_score numeric(10, 2),
  correct_count integer,
  incorrect_count integer,
  unanswered_count integer,
  elapsed_seconds integer,
  unique (test_id, student_id, id)
);

create index attempts_student_idx on public.attempts(student_id, started_at desc);
create index attempts_test_idx on public.attempts(test_id, status);

create table public.responses (
  attempt_id uuid not null references public.attempts(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  answer jsonb,
  marked_for_review boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (attempt_id, question_id)
);

create table public.upload_records (
  id uuid primary key default gen_random_uuid(),
  test_id uuid not null references public.tests(id) on delete cascade,
  uploaded_by uuid not null references public.profiles(id),
  filename text not null,
  question_count integer not null default 0,
  status text not null check (status in ('draft', 'submitted', 'approved', 'rejected')),
  validation_errors jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.test_access (
  test_id uuid not null references public.tests(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  primary key (test_id, student_id)
);

create or replace function public.current_role()
returns public.app_role
language sql stable security definer
set search_path = ''
as $$
  select role from public.profiles where id = (select auth.uid())
$$;

create or replace function public.has_course_access(target_course uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select public.current_role() = 'admin'
    or exists (
      select 1 from public.mediator_assignments
      where mediator_id = (select auth.uid()) and course_id = target_course
    )
$$;

create or replace function public.has_test_access(target_test uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.test_access
    where test_id = target_test and student_id = (select auth.uid())
  )
$$;

create or replace function public.has_test_attempt(target_test uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.attempts
    where test_id = target_test and student_id = (select auth.uid())
  )
$$;

create or replace function public.has_test_attempts(target_test uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select public.has_course_access(t.course_id)
    and exists (select 1 from public.attempts a where a.test_id = t.id)
  from public.tests t where t.id = target_test
$$;

create or replace function public.answer_matches(actual jsonb, expected jsonb)
returns boolean
language plpgsql immutable
set search_path = ''
as $$
begin
  if actual is null or expected is null then return false; end if;
  if jsonb_typeof(actual) = 'array' and jsonb_typeof(expected) = 'array' then
    return (select array_agg(value order by value) from jsonb_array_elements_text(actual) as item(value))
      is not distinct from
      (select array_agg(value order by value) from jsonb_array_elements_text(expected) as item(value));
  end if;
  if jsonb_typeof(actual) = 'string' and jsonb_typeof(expected) = 'string' then
    return lower(btrim(actual #>> '{}')) = lower(btrim(expected #>> '{}'));
  end if;
  return actual = expected;
end
$$;

alter table public.profiles enable row level security;
alter table public.courses enable row level security;
alter table public.mediator_assignments enable row level security;
alter table public.tests enable row level security;
alter table public.questions enable row level security;
alter table public.answer_keys enable row level security;
alter table public.attempts enable row level security;
alter table public.responses enable row level security;
alter table public.upload_records enable row level security;
alter table public.audit_logs enable row level security;

grant usage on schema public to anon, authenticated;
grant select on public.courses, public.tests to anon, authenticated;
grant select, insert, update, delete on
  public.profiles, public.courses, public.mediator_assignments, public.tests,
  public.questions, public.answer_keys, public.attempts, public.responses,
  public.test_access, public.upload_records, public.audit_logs
to authenticated;
revoke update on public.profiles from authenticated;
grant update (role, display_name) on public.profiles to authenticated;
grant usage, select on sequence public.audit_logs_id_seq to authenticated;

create policy "profiles select self or admin" on public.profiles
  for select to authenticated using (id = (select auth.uid()) or public.current_role() = 'admin');
create policy "admins update profiles" on public.profiles
  for update to authenticated using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');

create policy "published courses are visible" on public.courses
  for select to anon, authenticated
  using ((is_published and not is_archived) or public.has_course_access(id));
create policy "admins manage courses" on public.courses
  for all to authenticated using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');

create policy "assignment owner or admin reads assignments" on public.mediator_assignments
  for select to authenticated using (mediator_id = (select auth.uid()) or public.current_role() = 'admin');
create policy "admin manages assignments" on public.mediator_assignments
  for all to authenticated using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');

create policy "published tests visible" on public.tests
  for select to anon, authenticated
  using (
    (
      is_published and not is_archived
      and exists (select 1 from public.courses c where c.id = course_id and c.is_published and not c.is_archived)
      and (
        access_mode <> 'assigned'
        or public.has_test_access(id)
        or public.has_test_attempt(id)
      )
    )
    or public.has_course_access(course_id)
    or public.has_test_attempt(id)
  );
create policy "authorized test managers write" on public.tests
  for all to authenticated using (
    public.has_course_access(course_id)
    and (public.current_role() = 'admin' or (created_by = (select auth.uid()) and not is_published and not is_archived))
  )
  with check (
    public.has_course_access(course_id)
    and (public.current_role() = 'admin' or created_by = (select auth.uid()))
  );

create policy "published questions visible" on public.questions
  for select to authenticated
  using (
    exists (
      select 1 from public.tests t join public.courses c on c.id = t.course_id
      where t.id = test_id and t.is_published and not t.is_archived and c.is_published and not c.is_archived
        and (
          t.access_mode <> 'assigned'
          or public.has_test_access(t.id)
          or public.has_test_attempt(t.id)
        )
    )
    or exists (select 1 from public.tests t where t.id = test_id and public.has_course_access(t.course_id))
    or exists (select 1 from public.tests t where t.id = test_id and public.has_test_attempt(t.id))
  );
create policy "assigned test managers write questions" on public.questions
  for all to authenticated using (
    exists (
      select 1 from public.tests t where t.id = test_id and not t.is_published and not t.is_archived
        and public.has_course_access(t.course_id)
      and (public.current_role() = 'admin' or t.created_by = (select auth.uid()))
      and not public.has_test_attempts(t.id)
    )
  ) with check (
    exists (
      select 1 from public.tests t where t.id = test_id and not t.is_published and not t.is_archived
        and public.has_course_access(t.course_id)
      and (public.current_role() = 'admin' or t.created_by = (select auth.uid()))
      and not public.has_test_attempts(t.id)
    )
  );

create policy "manager-only answer key access" on public.answer_keys
  for all to authenticated using (
    exists (
      select 1 from public.questions q join public.tests t on t.id = q.test_id
      where q.id = question_id and not t.is_published and not t.is_archived and public.has_course_access(t.course_id)
        and (public.current_role() = 'admin' or t.created_by = (select auth.uid()))
        and not public.has_test_attempts(t.id)
    )
  ) with check (
    exists (
      select 1 from public.questions q join public.tests t on t.id = q.test_id
      where q.id = question_id and not t.is_published and not t.is_archived and public.has_course_access(t.course_id)
        and (public.current_role() = 'admin' or t.created_by = (select auth.uid()))
        and not public.has_test_attempts(t.id)
    )
  );

create policy "students own attempts and managers assigned attempts" on public.attempts
  for select to authenticated using (
    student_id = (select auth.uid())
    or public.current_role() = 'admin'
  );
create policy "students and admins read responses" on public.responses
  for select to authenticated using (
    exists (
      select 1 from public.attempts a where a.id = attempt_id and (
        a.student_id = (select auth.uid())
        or public.current_role() = 'admin'
      )
    )
  );
create policy "students write active own responses" on public.responses
  for all to authenticated using (
    exists (select 1 from public.attempts a where a.id = attempt_id and a.student_id = (select auth.uid()) and a.status = 'in_progress')
  ) with check (
    exists (select 1 from public.attempts a where a.id = attempt_id and a.student_id = (select auth.uid()) and a.status = 'in_progress')
  );

create policy "upload owners and admins read uploads" on public.upload_records
  for select to authenticated using (uploaded_by = (select auth.uid()) or public.current_role() = 'admin');
create policy "assigned mediators create uploads" on public.upload_records
  for insert to authenticated with check (
    uploaded_by = (select auth.uid())
    and exists (select 1 from public.tests t where t.id = test_id and public.has_course_access(t.course_id))
  );
create policy "admins read audit logs" on public.audit_logs
  for select to authenticated using (public.current_role() = 'admin');
create policy "admins audit inserts" on public.audit_logs
  for insert to authenticated with check (public.current_role() = 'admin' and actor_id = (select auth.uid()));
create policy "mediators audit their own draft creation" on public.audit_logs
  for insert to authenticated with check (
    public.current_role() = 'mediator'
    and actor_id = (select auth.uid())
    and action in ('mediator_test_created', 'mediator_test_updated', 'mediator_review_requested')
    and entity_type = 'test'
    and exists (
      select 1 from public.tests t
      where t.id = entity_id and t.created_by = (select auth.uid()) and not t.is_published
    )
  );

create or replace function public.start_attempt(p_test_code text)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  target public.tests%rowtype;
  new_attempt public.attempts%rowtype;
begin
  if auth.uid() is null then raise exception 'Sign in is required'; end if;
  if coalesce(public.current_role() <> 'student', true) then raise exception 'Only student accounts can start an attempt'; end if;
  select * into target from public.tests
    where test_code = upper(btrim(p_test_code)) and is_published and not is_archived
    for share;
  if not found then raise exception 'No available published test matches this code'; end if;
  if target.starts_at is not null and target.starts_at > now() then raise exception 'This test is not available yet'; end if;
  if target.ends_at is not null and target.ends_at <= now() then raise exception 'This test is no longer available'; end if;
  if not exists (select 1 from public.courses c where c.id = target.course_id and c.is_published and not c.is_archived) then
    raise exception 'The course for this test is not available';
  end if;
  if target.access_mode = 'assigned' and not exists (
    select 1 from public.test_access a where a.test_id = target.id and a.student_id = auth.uid()
  ) then raise exception 'This test is restricted to assigned students'; end if;
  perform pg_advisory_xact_lock(hashtext(target.id::text), hashtext(auth.uid()::text));
  if (select count(*) from public.attempts where test_id = target.id and student_id = auth.uid()) >= target.attempt_limit then
    raise exception 'Attempt limit reached';
  end if;
  insert into public.attempts(test_id, student_id, expires_at)
  values (target.id, auth.uid(), least(now() + make_interval(mins => target.duration_minutes), coalesce(target.ends_at, 'infinity'::timestamptz)))
  returning * into new_attempt;
  return jsonb_build_object('attempt_id', new_attempt.id, 'expires_at', new_attempt.expires_at);
end
$$;

alter table public.test_access enable row level security;
create policy "admins manage test access" on public.test_access
  for all to authenticated using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');

create or replace function public.set_test_access(p_test_id uuid, p_student_ids uuid[])
returns integer
language plpgsql security definer
set search_path = ''
as $$
declare
  target public.tests%rowtype;
  assigned_count integer;
begin
  if coalesce(public.current_role() <> 'admin', true) then raise exception 'Administrator access is required'; end if;
  select * into target from public.tests where id = p_test_id for update;
  if not found then raise exception 'Test not found'; end if;
  if target.access_mode <> 'assigned' then raise exception 'Student assignments apply only to assigned-access tests'; end if;
  if p_student_ids is null then raise exception 'Provide a student list'; end if;
  if exists (
    select 1 from unnest(p_student_ids) as requested(student_id)
    left join public.profiles p on p.id = requested.student_id and p.role = 'student'
    where p.id is null
  ) then raise exception 'Every assigned account must be an existing student'; end if;
  delete from public.test_access where test_id = p_test_id;
  insert into public.test_access(test_id, student_id)
  select p_test_id, requested.student_id from unnest(p_student_ids) as requested(student_id)
  on conflict do nothing;
  get diagnostics assigned_count = row_count;
  insert into public.audit_logs(actor_id, action, entity_type, entity_id, details)
  values ((select auth.uid()), 'test_access_updated', 'test', p_test_id, jsonb_build_object('student_count', assigned_count));
  return assigned_count;
end
$$;

create or replace function public.set_mediator_courses(p_mediator_id uuid, p_course_ids uuid[])
returns integer
language plpgsql security definer
set search_path = ''
as $$
declare
  assigned_count integer;
begin
  if coalesce(public.current_role() <> 'admin', true) then raise exception 'Administrator access is required'; end if;
  if not exists (select 1 from public.profiles where id = p_mediator_id and role = 'mediator') then
    raise exception 'Mediator account not found';
  end if;
  if p_course_ids is null then raise exception 'Provide a course list'; end if;
  if exists (
    select 1 from unnest(p_course_ids) as requested(course_id)
    left join public.courses c on c.id = requested.course_id
    where c.id is null
  ) then raise exception 'Every assignment must reference an existing course'; end if;
  delete from public.mediator_assignments where mediator_id = p_mediator_id;
  insert into public.mediator_assignments(mediator_id, course_id)
  select p_mediator_id, requested.course_id from unnest(p_course_ids) as requested(course_id)
  on conflict do nothing;
  get diagnostics assigned_count = row_count;
  insert into public.audit_logs(actor_id, action, entity_type, entity_id, details)
  values ((select auth.uid()), 'mediator_assignments_updated', 'profile', p_mediator_id, jsonb_build_object('course_count', assigned_count));
  return assigned_count;
end
$$;

create or replace function public.save_response(
  p_attempt_id uuid, p_question_id uuid, p_answer jsonb, p_marked_for_review boolean default false
)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  target_attempt public.attempts%rowtype;
begin
  select * into target_attempt from public.attempts
    where id = p_attempt_id and student_id = auth.uid()
    for update;
  if not found then raise exception 'Attempt not found'; end if;
  if target_attempt.status <> 'in_progress' or target_attempt.expires_at <= now() then
    raise exception 'Attempt is no longer active';
  end if;
  if not exists (select 1 from public.questions where id = p_question_id and test_id = target_attempt.test_id) then
    raise exception 'Question is not part of this test';
  end if;
  insert into public.responses(attempt_id, question_id, answer, marked_for_review)
  values (p_attempt_id, p_question_id, p_answer, coalesce(p_marked_for_review, false))
  on conflict (attempt_id, question_id) do update
    set answer = excluded.answer, marked_for_review = excluded.marked_for_review, updated_at = now();
end
$$;

create or replace function public.submit_attempt(p_attempt_id uuid)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  target_attempt public.attempts%rowtype;
  target_test public.tests%rowtype;
  total_score numeric(10,2);
  max_score numeric(10,2);
  correct_total integer;
  incorrect_total integer;
  unanswered_total integer;
begin
  select * into target_attempt from public.attempts
    where id = p_attempt_id and student_id = auth.uid()
    for update;
  if not found then raise exception 'Attempt not found'; end if;
  if target_attempt.status = 'submitted' then
    return jsonb_build_object('attempt_id', target_attempt.id, 'score', target_attempt.score, 'maximum_score', target_attempt.maximum_score);
  end if;
  select * into target_test from public.tests where id = target_attempt.test_id;

  select
    coalesce(sum(case when public.answer_matches(r.answer, k.answer)
      then coalesce(q.marks, target_test.correct_marks)
      when r.answer is not null then -coalesce(q.negative_marks, target_test.negative_marks)
      else 0 end), 0),
    coalesce(sum(coalesce(q.marks, target_test.correct_marks)), 0),
    count(*) filter (where r.answer is not null and public.answer_matches(r.answer, k.answer))::integer,
    count(*) filter (where r.answer is not null and not public.answer_matches(r.answer, k.answer))::integer,
    count(*) filter (where r.answer is null)::integer
  into total_score, max_score, correct_total, incorrect_total, unanswered_total
  from public.questions q
  join public.answer_keys k on k.question_id = q.id
  left join public.responses r on r.question_id = q.id and r.attempt_id = target_attempt.id
  where q.test_id = target_attempt.test_id;

  update public.attempts set
    status = 'submitted',
    submitted_at = now(),
    score = total_score,
    maximum_score = max_score,
    correct_count = correct_total,
    incorrect_count = incorrect_total,
    unanswered_count = unanswered_total,
    elapsed_seconds = greatest(0, floor(extract(epoch from (least(now(), expires_at) - started_at)))::integer)
  where id = target_attempt.id
  returning * into target_attempt;

  return jsonb_build_object(
    'attempt_id', target_attempt.id,
    'score', target_attempt.score,
    'maximum_score', target_attempt.maximum_score,
    'correct_count', target_attempt.correct_count,
    'incorrect_count', target_attempt.incorrect_count,
    'unanswered_count', target_attempt.unanswered_count,
    'elapsed_seconds', target_attempt.elapsed_seconds
  );
end
$$;

create or replace function public.lookup_test(p_test_code text)
returns table (
  id uuid, title text, course_title text, duration_minutes integer,
  question_count bigint, correct_marks numeric, negative_marks numeric, instructions text
)
language sql stable security definer
set search_path = ''
as $$
  select t.id, t.title, c.title, t.duration_minutes,
    (select count(*) from public.questions q where q.test_id = t.id),
    t.correct_marks, t.negative_marks, t.instructions
  from public.tests t join public.courses c on c.id = t.course_id
  where t.test_code = upper(btrim(p_test_code))
    and t.is_published and not t.is_archived and c.is_published and not c.is_archived
    and (t.starts_at is null or t.starts_at <= now())
    and (t.ends_at is null or t.ends_at > now())
    and (t.access_mode <> 'assigned' or exists (
      select 1 from public.test_access a where a.test_id = t.id and a.student_id = (select auth.uid())
    ))
$$;

create or replace function public.import_questions(p_test_id uuid, p_filename text, p_questions jsonb, p_replace boolean default false)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  target_test public.tests%rowtype;
  item jsonb;
  question_id uuid;
  added integer := 0;
  upload_id uuid;
begin
  if auth.uid() is null then raise exception 'Sign in is required'; end if;
  select * into target_test from public.tests where id = p_test_id for update;
  if not found or not public.has_course_access(target_test.course_id) then
    raise exception 'You do not have access to this test';
  end if;
  if target_test.is_published or target_test.is_archived then raise exception 'Questions can only be changed while a test is a draft'; end if;
  if exists (select 1 from public.attempts where test_id = p_test_id) then
    raise exception 'Questions cannot be changed after an attempt has started';
  end if;
  if public.current_role() = 'mediator' and target_test.created_by <> auth.uid() then
    raise exception 'Mediators may only update their own draft tests';
  end if;
  if jsonb_typeof(p_questions) <> 'array' or jsonb_array_length(p_questions) = 0 then
    raise exception 'A non-empty question list is required';
  end if;
  if p_replace then
    delete from public.questions where test_id = p_test_id;
  end if;
  for item in select value from jsonb_array_elements(p_questions) loop
    if jsonb_typeof(item) <> 'object'
      or nullif(btrim(item->>'question'), '') is null
      or length(item->>'question') > 10000
      or item->>'type' not in ('single_choice', 'multiple_select', 'true_false', 'short_answer')
      or item->'answer' is null
      or jsonb_typeof(item->'answer') = 'null' then
      raise exception 'Every imported question needs valid text, type and answer';
    end if;
    if item->>'type' in ('single_choice', 'multiple_select') and (
      jsonb_typeof(item->'options') <> 'array'
      or jsonb_array_length(item->'options') < 2
      or jsonb_array_length(item->'options') > 20
      or exists (
        select 1 from jsonb_array_elements(item->'options') as option(value)
        where jsonb_typeof(option.value) <> 'string'
          or nullif(btrim(option.value #>> '{}'), '') is null
          or length(option.value #>> '{}') > 500
      )
      or (select count(distinct value) from jsonb_array_elements_text(item->'options') as options(value))
        <> jsonb_array_length(item->'options')
    ) then
      raise exception 'Choice questions need two to twenty unique, non-empty options';
    end if;
    if item->>'type' = 'single_choice' and (
      jsonb_typeof(item->'answer') <> 'string'
      or not exists (select 1 from jsonb_array_elements_text(item->'options') as option(value) where option.value = item->>'answer')
    ) then
      raise exception 'Single-choice answer must match an option';
    end if;
    if item->>'type' = 'multiple_select' and (
      jsonb_typeof(item->'answer') <> 'array'
      or jsonb_array_length(item->'answer') = 0
      or exists (
        select 1 from jsonb_array_elements_text(item->'answer') as selected(value)
        where not exists (select 1 from jsonb_array_elements_text(item->'options') as option(value) where option.value = selected.value)
      )
    ) then
      raise exception 'Multiple-select answers must match one or more options';
    end if;
    if item->>'type' = 'true_false' and lower(item->>'answer') not in ('true', 'false') then
      raise exception 'True-false answer must be true or false';
    end if;
    if item->>'type' = 'short_answer' and (jsonb_typeof(item->'answer') <> 'string' or nullif(btrim(item->>'answer'), '') is null) then
      raise exception 'Short-answer key must be a non-empty string';
    end if;
    if item->>'marks' is not null and (item->>'marks')::numeric < 0 then raise exception 'Marks cannot be negative'; end if;
    if item->>'negative_marks' is not null and (item->>'negative_marks')::numeric < 0 then raise exception 'Negative marks cannot be negative'; end if;
    insert into public.questions (
      test_id, external_id, position, question_text, question_type, options,
      marks, negative_marks, explanation, section, topic
    ) values (
      p_test_id,
      nullif(item->>'external_id', ''),
      (select coalesce(max(position), 0) + 1 from public.questions where test_id = p_test_id),
      btrim(item->>'question'),
      (item->>'type')::public.question_type,
      coalesce(item->'options', '[]'::jsonb),
      nullif(item->>'marks', '')::numeric,
      nullif(item->>'negative_marks', '')::numeric,
      nullif(item->>'explanation', ''),
      nullif(item->>'section', ''),
      nullif(item->>'topic', '')
    ) returning id into question_id;
    insert into public.answer_keys(question_id, answer) values (question_id, item->'answer');
    added := added + 1;
  end loop;
  insert into public.upload_records(test_id, uploaded_by, filename, question_count, status)
  values (p_test_id, auth.uid(), p_filename, added, 'draft')
  returning id into upload_id;
  update public.tests set review_requested_at = null where id = p_test_id;
  insert into public.audit_logs(actor_id, action, entity_type, entity_id, details)
  values (auth.uid(), 'questions_imported', 'test', p_test_id, jsonb_build_object('count', added, 'upload_id', upload_id));
  return jsonb_build_object('upload_id', upload_id, 'question_count', added);
end
$$;

create or replace function public.validate_test_publication()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if public.current_role() = 'mediator' and
      (new.created_by <> (select auth.uid()) or new.is_published or new.is_archived) then
      raise exception 'Mediators can only create their own unpublished draft tests';
    end if;
    if public.current_role() = 'mediator' and (old.is_published or old.is_archived) then
      raise exception 'Mediators can only edit draft tests';
    end if;
    return new;
  end if;
  if public.current_role() = 'mediator' and (
    new.is_published is distinct from old.is_published
    or new.is_archived is distinct from old.is_archived
    or new.test_code is distinct from old.test_code
    or new.course_id is distinct from old.course_id
    or new.created_by is distinct from old.created_by
  ) then
    raise exception 'Only administrators can publish, archive, or change the access code or course for a test';
  end if;
  if public.current_role() = 'mediator' and row(
    new.title, new.instructions, new.duration_minutes, new.correct_marks,
    new.negative_marks, new.attempt_limit, new.access_mode,
    new.starts_at, new.ends_at, new.release_answers
  ) is distinct from row(
    old.title, old.instructions, old.duration_minutes, old.correct_marks,
    old.negative_marks, old.attempt_limit, old.access_mode,
    old.starts_at, old.ends_at, old.release_answers
  ) then
    new.review_requested_at := null;
  end if;
  if new.is_published and not old.is_published and public.current_role() <> 'admin' then
    raise exception 'Only administrators can publish tests';
  end if;
  if public.has_test_attempts(old.id) and
    row(
      new.course_id, new.title, new.instructions, new.duration_minutes,
      new.correct_marks, new.negative_marks, new.attempt_limit,
      new.access_mode, new.starts_at, new.ends_at, new.release_answers
    ) is distinct from row(
      old.course_id, old.title, old.instructions, old.duration_minutes,
      old.correct_marks, old.negative_marks, old.attempt_limit,
      old.access_mode, old.starts_at, old.ends_at, old.release_answers
    ) then
    raise exception 'Test settings cannot change after an attempt has started';
  end if;
  if new.is_published and not old.is_published then
    if new.is_archived then raise exception 'An archived test cannot be published'; end if;
    if not exists (select 1 from public.courses c where c.id = new.course_id and c.is_published and not c.is_archived) then
      raise exception 'Publish the course before publishing its tests';
    end if;
    if not exists (select 1 from public.questions q where q.test_id = new.id) then
      raise exception 'A test needs at least one question before publication';
    end if;
    if new.access_mode = 'assigned' and not exists (select 1 from public.test_access a where a.test_id = new.id) then
      raise exception 'Assign at least one student before publishing an assigned-access test';
    end if;
    if exists (
      select 1 from public.questions q left join public.answer_keys k on k.question_id = q.id
      where q.test_id = new.id and k.question_id is null
    ) then
      raise exception 'Every test question needs a correct answer before publication';
    end if;
  end if;
  return new;
end
$$;

create trigger enforce_test_publication_and_immutability
  before insert or update on public.tests
  for each row execute function public.validate_test_publication();

create or replace function public.get_attempt_review(p_attempt_id uuid)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  target_attempt public.attempts%rowtype;
  may_review boolean;
begin
  select * into target_attempt from public.attempts
    where id = p_attempt_id and student_id = auth.uid();
  if not found or target_attempt.status <> 'submitted' then
    raise exception 'Submitted attempt not found';
  end if;
  select t.release_answers into may_review from public.tests t where t.id = target_attempt.test_id;
  if not coalesce(may_review, false) then
    raise exception 'Answer review is not available for this test';
  end if;
  return (
    select jsonb_agg(jsonb_build_object(
      'id', q.id, 'position', q.position, 'question', q.question_text,
      'type', q.question_type, 'options', q.options, 'answer', k.answer,
      'response', r.answer, 'explanation', q.explanation,
      'correct', public.answer_matches(r.answer, k.answer)
    ) order by q.position)
    from public.questions q
    join public.answer_keys k on k.question_id = q.id
    left join public.responses r on r.question_id = q.id and r.attempt_id = target_attempt.id
    where q.test_id = target_attempt.test_id
  );
end
$$;

create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  insert into public.profiles(id, display_name)
  values (new.id, nullif(new.raw_user_meta_data->>'display_name', ''))
  on conflict (id) do nothing;
  return new;
end
$$;

insert into public.profiles(id, display_name)
select id, nullif(raw_user_meta_data->>'display_name', '')
from auth.users
on conflict (id) do nothing;

create trigger create_profile_after_signup
  after insert on auth.users
  for each row execute function public.create_profile_for_new_user();

revoke all on function public.start_attempt(text) from public, anon;
revoke all on function public.save_response(uuid, uuid, jsonb, boolean) from public, anon;
revoke all on function public.submit_attempt(uuid) from public, anon;
revoke all on function public.import_questions(uuid, text, jsonb, boolean) from public, anon;
revoke all on function public.get_attempt_review(uuid) from public, anon;
revoke all on function public.set_test_access(uuid, uuid[]) from public, anon;
revoke all on function public.set_mediator_courses(uuid, uuid[]) from public, anon;
revoke all on function public.lookup_test(text) from public;
grant execute on function public.current_role() to anon, authenticated;
grant execute on function public.has_course_access(uuid) to anon, authenticated;
grant execute on function public.has_test_access(uuid) to anon, authenticated;
grant execute on function public.has_test_attempt(uuid) to anon, authenticated;
grant execute on function public.has_test_attempts(uuid) to authenticated;
grant execute on function public.start_attempt(text) to authenticated;
grant execute on function public.save_response(uuid, uuid, jsonb, boolean) to authenticated;
grant execute on function public.submit_attempt(uuid) to authenticated;
grant execute on function public.lookup_test(text) to anon, authenticated;
grant execute on function public.import_questions(uuid, text, jsonb, boolean) to authenticated;
grant execute on function public.get_attempt_review(uuid) to authenticated;
grant execute on function public.set_test_access(uuid, uuid[]) to authenticated;
grant execute on function public.set_mediator_courses(uuid, uuid[]) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('question-source-files', 'question-source-files', false, 10485760, array['text/csv', 'application/json', 'application/pdf'])
on conflict (id) do nothing;

create policy "assigned mediators access source files" on storage.objects
  for select to authenticated using (
    bucket_id = 'question-source-files'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.current_role() = 'admin'
    )
  );
create policy "mediators upload own source files" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'question-source-files'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.current_role() in ('admin', 'mediator')
  );
