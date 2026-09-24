-- Best check-your-understanding score per lesson (0–100); feeds unit mastery.
alter table public.lesson_progress
  add column best_score numeric(5, 2) check (best_score between 0 and 100);

-- Continue-where-you-left-off looks up the latest in-progress lesson.
create index lesson_progress_user_status_idx on public.lesson_progress (user_id, status, last_viewed_at desc);
