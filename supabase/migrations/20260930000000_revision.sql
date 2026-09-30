-- Phase 4: revision (summaries, flashcards, quizzes, exam practice).

-- Shared AI-generated revision material, cached per unit and language
-- (like lesson_content). Written only by the server with the service role.
create type public.revision_kind as enum ('flashcards', 'quiz');

create table public.unit_revision_content (
  unit_id uuid not null references public.units (id) on delete cascade,
  locale public.locale_code not null,
  kind public.revision_kind not null,
  content jsonb not null,
  model text not null,
  generated_at timestamptz not null default now(),
  primary key (unit_id, locale, kind)
);
alter table public.unit_revision_content enable row level security;
create policy "curriculum readable" on public.unit_revision_content for select to authenticated using (true);

-- Exam questions: a stable position per unit and language (so a set is only
-- generated once) and a model answer shown after marking.
alter table public.exam_questions
  add column position smallint not null default 1 check (position between 1 and 20),
  add column model_answer text not null default '';
create unique index exam_questions_unit_locale_position_key
  on public.exam_questions (unit_id, locale, position);
drop index public.exam_questions_unit_idx;

-- Flashcards copied from a unit's deck keep their deck position, so a deck
-- can only be added once. Cards a student writes themselves leave it null.
alter table public.flashcards
  add column deck_position smallint check (deck_position between 1 and 50);
create unique index flashcards_deck_card_key on public.flashcards (user_id, unit_id, deck_position);
-- "Continue revising" looks up the most recently reviewed card.
create index flashcards_recent_idx on public.flashcards (user_id, last_reviewed_at desc nulls last);

-- Most recent attempt per unit (best score, continue revising).
create index quiz_attempts_user_unit_idx on public.quiz_attempts (user_id, unit_id, created_at desc);
