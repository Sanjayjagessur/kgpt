@AGENTS.md

# CLAUDE.md

## Project summary

Student website of an AI learning platform for Mauritian secondary students (Grades 7 to 13), following the national curriculum (NCF, SC, HSC). Working name **myKPT** (`src/config/site.ts`).
This repo covers **student features only**; a separate teacher app comes later (schema keeps `profiles.role` and `school_id` for it).
Architecture, data model and phase plan: `docs/PLAN.md`.

## Stack

- Next.js 16 (App Router, `src/proxy.ts` not middleware, async request APIs) + TypeScript (`strict: true`)
- Tailwind CSS v4 + shadcn/ui (base-nova style, built on **Base UI**, not Radix) + Motion (`motion/react`)
- Supabase: Postgres, Auth, Storage, Row Level Security, pgvector
- Claude API (`@anthropic-ai/sdk`): **server-side only**
- KaTeX (math) and Mermaid (diagrams)
- next-intl without locale routing (cookie `NEXT_LOCALE`, then Accept-Language): `en`, `fr`, `mfe`
- PWA (`src/app/manifest.ts`, icons from `src/app/icons/[file]`)
- Deployed on Vercel

## Rules

- Never expose API keys to the browser. All AI calls go through server route handlers. Only `NEXT_PUBLIC_*` variables may reach client code, and they must never hold secrets.
- Server-only code lives in `src/server/**` and starts with `import "server-only"` (server actions use `"use server"`).
- Never show internal AI/system instructions to students in the UI.
- Every table has Row Level Security enabled; a student only sees their own data. No table ships without RLS policies. Wrap `auth.uid()` as `(select auth.uid())` in policies; index every FK and policy column.
- Scores, marks, mastery and assistant messages are written server-side (service role or security definer functions), never trusted from the browser.
- Mobile first: test at 360px width.
- All UI text goes through i18n (next-intl). No hard-coded user-facing strings. Add every key to `messages/en.json`, `fr.json` and `mfe.json` (Kreol wording needs native review).
- Use context7 (or `node_modules/next/dist/docs/` for Next.js) to fetch library docs before writing code with a library.
- After each build phase: run lint, type check and build, test with Playwright, take screenshots, then commit.
- Ask before any major architectural change.

## Conventions

- Routes: `(auth)` public auth pages; `(app)` requires a session; `(app)/(shell)` also requires finished onboarding and renders the nav shell.
- `getStudent()` / `requireStudent()` in `src/server/session.ts` for the current student (cached per request).
- Links that look like buttons use `ButtonLink` (keeps link semantics). Don't use `Button render={<Link/>}`.
- Subject colour: set `style={subjectStyle(id)}` on a wrapper, then use `bg-subject-tint`, `bg-subject-soft`, `bg-subject`, `text-subject`, `text-subject-ink`, `border-subject`. Illustration: `<SubjectArt subject={id} />`.
- Motion: one meaningful animation per interaction; `MotionConfig reducedMotion="user"` is global, and CSS respects `prefers-reduced-motion`.
- Copy: sentence case, plain verbs, buttons say what happens, errors say how to fix it.

## Design tokens (`src/app/globals.css`)

| Token | Light | Dark | Use |
|---|---|---|---|
| `background` (shore) | `#f5f7f9` | `#0c141d` | page |
| `card` | `#ffffff` | `#121c27` | surfaces |
| `sunken` | `#edf1f4` | `#081018` | wells, empty day dots |
| `foreground` (basalt) | `#16202c` | `#e6ecf2` | text |
| `muted-foreground` | `#556275` | `#97a5b6` | secondary text |
| `primary` (lagoon) | `#0a6875` | `#47c4d0` | actions, progress |
| `flame` (flamboyant) | `#de4a2c` | `#ff6d4d` | streaks only |
| `pollen` | `#e9ac1c` | `#f5c451` | mastery |
| `destructive` (coral) | `#c2362b` | `#ff7a6b` | errors |

- Type: Schibsted Grotesk (headings, `font-heading`, weight 700–800, tight tracking), Atkinson Hyperlegible Next (body), Atkinson Hyperlegible Mono (equations/code). Scale is a 1.2 ratio from 16px (`text-2xs` … `text-5xl`).
- Radius: controls `md` 10px, cards `lg` 14px / `xl` 20px, panels `2xl` 28px.
- Shadows: `shadow-xs|sm|md|lg` built from `--shadow-color` + `--shadow-ring` (theme-aware).
- Motion: `ease-out-soft` (0.22,1,0.36,1) for UI, springs (stiffness 500, damping 38) for indicators; 150–250ms.
- Signature accent: `<ReefLine />` under the main page heading, once per screen.
- Touch targets ≥ 40px (buttons `h-10`, inputs `h-11`).

## Commands

- `npm run dev`: dev server on :3000
- `npm run lint`, `npm run typecheck`, `npm run build`
- `npm test`: Playwright (projects `mobile-360` and `desktop`, includes axe WCAG 2.1 AA checks)
- `npx supabase db push`: apply `supabase/migrations` to the linked project
- `npx supabase gen types typescript --linked > src/lib/supabase/database.types.ts`

## Environment

- Secrets live in `.env.local` (git-ignored). `.env.example` lists the required keys with empty values.
- Never ask the user to paste keys into the chat.
