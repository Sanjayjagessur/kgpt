-- myKPT initial schema
-- Every table has RLS enabled. Students only ever see their own rows.
-- Shared curriculum tables are read-only to signed-in users; writes to them
-- happen server-side with the service role (which bypasses RLS).

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
create type public.user_role as enum ('student', 'teacher');
create type public.locale_code as enum ('en', 'fr', 'mfe');
create type public.lesson_status as enum ('not_started', 'in_progress', 'completed');
create type public.mastery_level as enum ('not_started', 'learning', 'mastered');
create type public.chat_mode as enum ('auto', 'explain', 'practice', 'homework', 'writing');
create type public.chat_role as enum ('user', 'assistant');
create type public.bookmark_kind as enum ('lesson', 'unit', 'message');

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Curriculum (shared, read-only)
-- ---------------------------------------------------------------------------
create table public.subjects (
  id text primary key check (id ~ '^[a-z0-9-]+$'),
  sort smallint not null default 0
);

create table public.subject_grades (
  subject_id text not null references public.subjects (id) on delete cascade,
  grade smallint not null check (grade between 7 and 13),
  primary key (subject_id, grade)
);
create index subject_grades_grade_idx on public.subject_grades (grade);

create table public.units (
  id uuid primary key default gen_random_uuid(),
  subject_id text not null references public.subjects (id) on delete cascade,
  grade smallint not null check (grade between 7 and 13),
  position smallint not null,
  title jsonb not null,        -- {"en": "...", "fr": "..."}
  summary jsonb not null default '{}'::jsonb,
  unique (subject_id, grade, position)
);
create index units_subject_grade_idx on public.units (subject_id, grade, position);

create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units (id) on delete cascade,
  position smallint not null,
  title jsonb not null,
  objectives jsonb not null default '[]'::jsonb,
  unique (unit_id, position)
);
create index lessons_unit_idx on public.lessons (unit_id, position);

-- AI-generated lesson body, cached per locale.
create table public.lesson_content (
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  locale public.locale_code not null,
  content jsonb not null,
  model text not null,
  generated_at timestamptz not null default now(),
  primary key (lesson_id, locale)
);

-- AI-generated revision summary, cached per locale.
create table public.unit_summaries (
  unit_id uuid not null references public.units (id) on delete cascade,
  locale public.locale_code not null,
  content jsonb not null,
  model text not null,
  generated_at timestamptz not null default now(),
  primary key (unit_id, locale)
);

create table public.exam_questions (
  id bigint generated always as identity primary key,
  unit_id uuid not null references public.units (id) on delete cascade,
  locale public.locale_code not null,
  prompt text not null,
  marks smallint not null check (marks between 1 and 20),
  mark_scheme jsonb not null,  -- [{ "point": "...", "marks": 1 }]
  created_at timestamptz not null default now()
);
create index exam_questions_unit_idx on public.exam_questions (unit_id, locale);

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) between 1 and 40),
  grade smallint check (grade between 7 and 13),
  ui_locale public.locale_code not null default 'en',
  tutor_locale public.locale_code not null default 'en',
  role public.user_role not null default 'student',
  -- Reserved for the future teacher app (schools / classes). Not used yet.
  school_id uuid,
  onboarded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_updated_at before update on public.profiles
  for each row execute function private.set_updated_at();

-- Create a profile row for every new auth user. No personal data is copied.
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id) on conflict do nothing;
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();

create table public.student_subjects (
  user_id uuid not null references public.profiles (id) on delete cascade,
  subject_id text not null references public.subjects (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, subject_id)
);
create index student_subjects_subject_idx on public.student_subjects (subject_id);

-- ---------------------------------------------------------------------------
-- Learning progress
-- ---------------------------------------------------------------------------
create table public.lesson_progress (
  user_id uuid not null references public.profiles (id) on delete cascade,
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  status public.lesson_status not null default 'in_progress',
  last_viewed_at timestamptz not null default now(),
  completed_at timestamptz,
  primary key (user_id, lesson_id)
);
create index lesson_progress_lesson_idx on public.lesson_progress (lesson_id);
create index lesson_progress_recent_idx on public.lesson_progress (user_id, last_viewed_at desc);

create table public.topic_mastery (
  user_id uuid not null references public.profiles (id) on delete cascade,
  unit_id uuid not null references public.units (id) on delete cascade,
  level public.mastery_level not null default 'learning',
  score numeric(5, 2) not null default 0 check (score between 0 and 100),
  updated_at timestamptz not null default now(),
  primary key (user_id, unit_id)
);
create index topic_mastery_unit_idx on public.topic_mastery (unit_id);
create trigger topic_mastery_updated_at before update on public.topic_mastery
  for each row execute function private.set_updated_at();

-- One row per student per day; drives streaks and time studied.
create table public.study_days (
  user_id uuid not null references public.profiles (id) on delete cascade,
  day date not null,
  seconds integer not null default 0 check (seconds between 0 and 86400),
  primary key (user_id, day)
);

-- ---------------------------------------------------------------------------
-- Chat
-- ---------------------------------------------------------------------------
create table public.chats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null default '' check (char_length(title) <= 120),
  subject_id text references public.subjects (id) on delete set null,
  mode public.chat_mode not null default 'auto',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index chats_user_recent_idx on public.chats (user_id, updated_at desc);
create index chats_subject_idx on public.chats (subject_id);
create trigger chats_updated_at before update on public.chats
  for each row execute function private.set_updated_at();

create table public.chat_messages (
  id bigint generated always as identity primary key,
  chat_id uuid not null references public.chats (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.chat_role not null,
  content text not null check (char_length(content) <= 40000),
  mode public.chat_mode not null default 'auto',
  attachments jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index chat_messages_chat_idx on public.chat_messages (chat_id, id);
create index chat_messages_user_idx on public.chat_messages (user_id);

-- ---------------------------------------------------------------------------
-- Notes and bookmarks
-- ---------------------------------------------------------------------------
create table public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null default '' check (char_length(title) <= 160),
  body text not null default '' check (char_length(body) <= 40000),
  subject_id text references public.subjects (id) on delete set null,
  source jsonb not null default '{}'::jsonb,  -- e.g. {"chat_id": "...", "message_id": 1}
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index notes_user_recent_idx on public.notes (user_id, updated_at desc);
create index notes_subject_idx on public.notes (subject_id);
create trigger notes_updated_at before update on public.notes
  for each row execute function private.set_updated_at();

create table public.bookmarks (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind public.bookmark_kind not null,
  ref_id text not null,
  label text not null default '' check (char_length(label) <= 200),
  created_at timestamptz not null default now(),
  unique (user_id, kind, ref_id)
);

-- ---------------------------------------------------------------------------
-- Revision
-- ---------------------------------------------------------------------------
create table public.flashcards (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  unit_id uuid not null references public.units (id) on delete cascade,
  front text not null check (char_length(front) <= 1000),
  back text not null check (char_length(back) <= 2000),
  -- SM-2 state
  ease numeric(4, 2) not null default 2.5 check (ease >= 1.3),
  interval_days integer not null default 0 check (interval_days >= 0),
  repetitions integer not null default 0 check (repetitions >= 0),
  due_on date not null default current_date,
  last_reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index flashcards_due_idx on public.flashcards (user_id, due_on);
create index flashcards_unit_idx on public.flashcards (unit_id);

create table public.quiz_attempts (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  unit_id uuid not null references public.units (id) on delete cascade,
  questions jsonb not null,
  answers jsonb not null default '[]'::jsonb,
  score numeric(5, 2) check (score between 0 and 100),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index quiz_attempts_user_idx on public.quiz_attempts (user_id, created_at desc);
create index quiz_attempts_unit_idx on public.quiz_attempts (unit_id);

create table public.exam_attempts (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  question_id bigint not null references public.exam_questions (id) on delete cascade,
  answer text not null check (char_length(answer) <= 8000),
  awarded_marks smallint not null check (awarded_marks >= 0),
  feedback jsonb not null,
  created_at timestamptz not null default now()
);
create index exam_attempts_user_idx on public.exam_attempts (user_id, created_at desc);
create index exam_attempts_question_idx on public.exam_attempts (question_id);

-- ---------------------------------------------------------------------------
-- AI usage (rate limiting) and moderation log
-- ---------------------------------------------------------------------------
create table public.ai_usage (
  user_id uuid not null references public.profiles (id) on delete cascade,
  window_start timestamptz not null,
  requests integer not null default 0,
  primary key (user_id, window_start)
);

-- No message content is stored here, only the category.
create table public.moderation_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  category text not null,
  direction text not null check (direction in ('input', 'output')),
  created_at timestamptz not null default now()
);
create index moderation_events_user_idx on public.moderation_events (user_id, created_at desc);

-- Atomically count one AI request for the calling student.
-- Returns remaining requests in the current window, or -1 when over the limit.
create or replace function public.consume_ai_quota(
  p_window_seconds integer default 3600,
  p_limit integer default 60
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_window timestamptz;
  v_count integer;
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if p_window_seconds not between 60 and 86400 or p_limit not between 1 and 1000 then
    raise exception 'invalid quota arguments' using errcode = '22023';
  end if;

  v_window := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);

  insert into public.ai_usage as u (user_id, window_start, requests)
  values (v_user, v_window, 1)
  on conflict (user_id, window_start)
  do update set requests = u.requests + 1
  returning requests into v_count;

  if v_count > p_limit then
    return -1;
  end if;
  return p_limit - v_count;
end;
$$;
revoke execute on function public.consume_ai_quota(integer, integer) from public, anon;
grant execute on function public.consume_ai_quota(integer, integer) to authenticated;

-- Add seconds to today's study total (Mauritius time) for the calling student.
create or replace function public.log_study_time(p_seconds integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_day date := (now() at time zone 'Indian/Mauritius')::date;
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  insert into public.study_days as d (user_id, day, seconds)
  values (v_user, v_day, least(greatest(p_seconds, 0), 900))
  on conflict (user_id, day)
  do update set seconds = least(d.seconds + least(greatest(p_seconds, 0), 900), 86400);
end;
$$;
revoke execute on function public.log_study_time(integer) from public, anon;
grant execute on function public.log_study_time(integer) to authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.subjects enable row level security;
alter table public.subject_grades enable row level security;
alter table public.units enable row level security;
alter table public.lessons enable row level security;
alter table public.lesson_content enable row level security;
alter table public.unit_summaries enable row level security;
alter table public.exam_questions enable row level security;
alter table public.profiles enable row level security;
alter table public.student_subjects enable row level security;
alter table public.lesson_progress enable row level security;
alter table public.topic_mastery enable row level security;
alter table public.study_days enable row level security;
alter table public.chats enable row level security;
alter table public.chat_messages enable row level security;
alter table public.notes enable row level security;
alter table public.bookmarks enable row level security;
alter table public.flashcards enable row level security;
alter table public.quiz_attempts enable row level security;
alter table public.exam_attempts enable row level security;
alter table public.ai_usage enable row level security;
alter table public.moderation_events enable row level security;

-- Shared curriculum: read for signed-in users only.
create policy "curriculum readable" on public.subjects for select to authenticated using (true);
create policy "curriculum readable" on public.subject_grades for select to authenticated using (true);
create policy "curriculum readable" on public.units for select to authenticated using (true);
create policy "curriculum readable" on public.lessons for select to authenticated using (true);
create policy "curriculum readable" on public.lesson_content for select to authenticated using (true);
create policy "curriculum readable" on public.unit_summaries for select to authenticated using (true);
create policy "curriculum readable" on public.exam_questions for select to authenticated using (true);

-- Profiles: read and update own row. Role and school are not updatable by students.
create policy "own profile read" on public.profiles for select to authenticated
  using ((select auth.uid()) = id);
create policy "own profile update" on public.profiles for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
revoke update on public.profiles from authenticated, anon;
grant update (display_name, grade, ui_locale, tutor_locale, onboarded_at)
  on public.profiles to authenticated;

-- Generic own-rows policies.
create policy "own rows" on public.student_subjects for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own rows" on public.lesson_progress for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own rows read" on public.topic_mastery for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "own rows read" on public.study_days for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "own rows" on public.chats for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own rows read" on public.chat_messages for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "own rows delete" on public.chat_messages for delete to authenticated
  using ((select auth.uid()) = user_id);
create policy "own rows insert" on public.chat_messages for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and role = 'user'
    and exists (
      select 1 from public.chats c
      where c.id = chat_id and c.user_id = (select auth.uid())
    )
  );
create policy "own rows" on public.notes for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own rows" on public.bookmarks for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own rows" on public.flashcards for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own rows read" on public.quiz_attempts for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "own rows read" on public.exam_attempts for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "own rows read" on public.ai_usage for select to authenticated
  using ((select auth.uid()) = user_id);
-- moderation_events: no student access; written by the server with the service role.
-- topic_mastery, study_days, quiz_attempts, exam_attempts, chat assistant messages:
-- written server-side (service role or security definer functions) so scores
-- and marks can't be forged from the browser.

-- ---------------------------------------------------------------------------
-- Storage: private attachments bucket, files under <user_id>/...
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'attachments', 'attachments', false, 10485760,
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'application/pdf']
)
on conflict (id) do nothing;

create policy "own attachments read" on storage.objects for select to authenticated
  using (bucket_id = 'attachments' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "own attachments insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'attachments' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "own attachments delete" on storage.objects for delete to authenticated
  using (bucket_id = 'attachments' and (storage.foldername(name))[1] = (select auth.uid())::text);
