-- 1. The unit a tutor reply was matched to (shown as a chip linking to the unit).
--    Set server-side only, and only ever on assistant rows: students insert their
--    own rows with role = 'user', and the check below keeps those free of a unit.
alter table public.chat_messages
  add column unit_id uuid references public.units (id) on delete set null;
alter table public.chat_messages
  add constraint chat_messages_unit_assistant_only check (unit_id is null or role = 'assistant');
create index chat_messages_unit_idx on public.chat_messages (unit_id);

-- 2. Exams a student is preparing for (drives the countdown on the Today page).
--    The student types the name and date; nothing is assumed about exam calendars.
create table public.student_exams (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  label text not null check (length(btrim(label)) between 1 and 80),
  exam_date date not null,
  created_at timestamptz not null default now()
);
create index student_exams_user_date_idx on public.student_exams (user_id, exam_date);

alter table public.student_exams enable row level security;

create policy "own rows read" on public.student_exams for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "own rows insert" on public.student_exams for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "own rows update" on public.student_exams for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "own rows delete" on public.student_exams for delete to authenticated
  using ((select auth.uid()) = user_id);
