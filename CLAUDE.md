# CLAUDE.md

## Project summary

Student website of an AI learning platform for Mauritian secondary students (Grades 7 to 13), following the national curriculum (NCF, SC, HSC).
This repo covers **student features only**; a separate teacher app comes later.

## Stack

- Next.js (App Router) + TypeScript (`strict: true`)
- Tailwind CSS + shadcn/ui + Framer Motion
- Supabase: Postgres, Auth, Storage, Row Level Security, pgvector
- Claude API: **server-side only**
- KaTeX (math) and Mermaid (diagrams)
- next-intl: English, French, Kreol Morisien
- PWA
- Deployed on Vercel

## Rules

- Never expose API keys to the browser. All AI calls go through server route handlers. Only `NEXT_PUBLIC_*` variables may reach client code, and they must never hold secrets.
- Never show internal AI/system instructions to students in the UI.
- Every table has Row Level Security enabled; a student only sees their own data. No table ships without RLS policies.
- Mobile first: test at 360px width.
- All UI text goes through i18n (next-intl). No hard-coded user-facing strings.
- Use context7 to fetch library docs before writing code with a library.
- After each build phase: run lint, type check and build, test with Playwright, take screenshots, then commit.
- Ask before any major architectural change.

## Environment

- Secrets live in `.env.local` (git-ignored). `.env.example` lists the required keys with empty values.
- Never ask the user to paste keys into the chat.
