-- Lesson progress feeds mastery, so students may read it but only the server
-- (service role, after verifying the session and grading answers) may write it.
drop policy "own rows" on public.lesson_progress;

create policy "own rows read" on public.lesson_progress for select to authenticated
  using ((select auth.uid()) = user_id);
