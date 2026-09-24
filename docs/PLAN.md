# myKPT: architecture and build plan

Working name **myKPT** (one constant in `src/config/site.ts`; rename freely).
Student-only AI learning platform for Mauritian secondary students (Grades 7–13, NCF / SC / HSC).

## 1. Architecture

```
Browser (PWA, mobile first)
  │  React Server Components + small client islands
  ▼
Next.js 16 on Vercel
  ├─ proxy.ts                → refreshes the Supabase session, guards routes, onboarding redirect
  ├─ app/(auth)              → sign in / sign up / magic link callback
  ├─ app/(app)               → Learning, Chat, Revision, Progress, Notes (auth required)
  ├─ app/api/ai/*            → ALL Claude calls (route handlers, Node runtime, streaming)
  │     ├─ moderation (input + output), age-appropriate system prompts, off-topic redirect
  │     └─ per-student rate limit (Postgres function `consume_ai_quota`)
  └─ server actions          → plain mutations (progress, notes, bookmarks, flashcard reviews)
        │
        ▼
Supabase
  ├─ Auth (email magic link + password)
  ├─ Postgres with RLS on every table
  ├─ Storage bucket `attachments` (private, path = <user_id>/…)
  └─ pgvector (later: curriculum retrieval for grounding)
Anthropic API (server only): Sonnet for tutoring/generation, Haiku for moderation and classification.
```

Principles
- Secrets are server-only. `ANTHROPIC_API_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are only imported from `src/server/**` (guarded by `import "server-only"`).
- The Supabase **anon** client runs with the user's session, so RLS is the security boundary. The service-role client is used only for writing shared AI-generated content caches (lesson content, unit summaries).
- System prompts live in `src/server/ai/prompts/` and never reach the browser.
- i18n: next-intl **without** locale in the URL. Locale comes from the profile, then a cookie, then `Accept-Language`. UI: `en`, `fr`, `mfe` (Kreol Morisien). Tutor reply language is a separate setting (en / fr / mfe).

## 2. Data model (Postgres)

Shared curriculum (read-only to signed-in students)
| table | key columns |
|---|---|
| `subjects` | `id text pk (slug)`, `name jsonb {en,fr,mfe}`, `color text`, `sort int` |
| `subject_grades` | `subject_id`, `grade smallint 7–13` |
| `units` | `id uuid`, `subject_id`, `grade`, `position`, `title jsonb`, `summary jsonb` |
| `lessons` | `id uuid`, `unit_id`, `position`, `title jsonb`, `objectives jsonb` |
| `lesson_content` | `lesson_id`, `locale`, `content jsonb` (sections, worked examples, checks), `model`, `generated_at` — AI-generated once, cached |
| `unit_summaries` | `unit_id`, `locale`, `content jsonb` — cached revision summary |
| `exam_questions` | `id`, `unit_id`, `prompt`, `marks`, `mark_scheme jsonb` |

Student-owned (RLS: `user_id = auth.uid()`)
| table | purpose |
|---|---|
| `profiles` | `id = auth.users.id`, `display_name`, `grade`, `ui_locale`, `tutor_locale`, `onboarded_at`, `role` (`student` now; `teacher` later), `school_id` nullable (teacher app later) |
| `student_subjects` | chosen subjects |
| `lesson_progress` | `status` (not_started / in_progress / completed), `last_viewed_at`, `completed_at` |
| `topic_mastery` | per unit: `level` (not_started / learning / mastered), `score` |
| `study_days` | `day date`, `seconds int` → streaks and time studied |
| `chats`, `chat_messages` | tutor conversations; messages keep `mode`, `attachments jsonb` |
| `notes`, `bookmarks` | saved answers and bookmarked lessons/messages |
| `flashcards` | SM-2 state: `ease`, `interval_days`, `repetitions`, `due_on` |
| `quiz_attempts` | questions, answers, score |
| `exam_attempts` | answer, awarded marks, feedback |
| `ai_usage` | rolling usage counter for rate limiting |
| `moderation_events` | category + timestamp only (no content kept) |

Teacher-ready without teacher features: `profiles.role`, nullable `school_id`, and all student data keyed by `user_id` so a future `class_members` table plus teacher read policies can be added without migrations to existing rows.

## 3. Folder structure

```
src/
  app/
    (auth)/sign-in, sign-up, auth/callback
    (app)/layout.tsx          ← top nav + mobile tab bar + Cmd/Ctrl+K
    (app)/onboarding
    (app)/learn               ← Learning home, /learn/[subject], /learn/[subject]/[unit]/[lesson]
    (app)/chat                ← /chat, /chat/[id]
    (app)/revision            ← /revision/[subject]/[unit] (summary, flashcards, quiz, exam)
    (app)/progress, notes, settings
    api/ai/{chat,lesson,summary,flashcards,quiz,mark}/route.ts
  components/ui               ← shadcn primitives (Base UI)
  components/{shell,learning,chat,revision,progress,common}
  config/site.ts, subjects.ts ← subject colours + illustrations
  i18n/request.ts
  lib/                        ← client-safe helpers (sm2, streaks, utils)
  lib/supabase/{client,server,proxy}.ts
  server/                     ← server-only: ai/, db queries, rate limit, moderation
messages/{en,fr,mfe}.json
supabase/migrations, supabase/seed.sql
tests/e2e (Playwright)
```

## 4. Phases

1. **Design system, shell, auth, onboarding**: tokens, fonts, light/dark, subject palette and art, nav shell, Supabase auth, profile + onboarding (grade, subjects, languages), schema + RLS migration.
2. **Learning**: home hero, continue card, weekly streak, subject grid (search/sort), subject → unit → lesson, AI lesson content (cached), check-your-understanding, mark complete.
3. **Chat tutor**: modes (Auto/Explain/Practice/Homework-Socratic/Writing), streaming, KaTeX, fx equation input, image/PDF attachments, history sidebar (rename/delete/search), explain differently / simpler / more detailed, save to notes, moderation, rate limit.
4. **Revision**: subject sidebar, continue, per-unit summary, SM-2 flashcards with a daily "due today" queue, quizzes, exam-style questions marked against a mark scheme.
5. **Progress, streaks, search, notes**: mastery dashboard, time studied, weak areas, bookmarks, notes, global Cmd/Ctrl+K search.
6. **Polish**: accessibility audit, Lighthouse, Playwright suite, PWA, Vercel deployment.

Each phase: lint, typecheck, build, Playwright at 360px and 1280px, screenshots, commit.
