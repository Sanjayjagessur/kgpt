# Deploying myKPT (Vercel + Supabase)

## 1. Vercel project

1. Import the Git repository in Vercel (framework: Next.js, root: this folder). Or from the CLI: `npm i -g vercel`, `vercel login`, `vercel link`.
2. Set the **Function region** close to the Supabase project's region (Project Settings → Functions). Every page talks to Postgres, so this matters more than the user's location.
3. Environment variables (Production and Preview). Values live in `.env.local`; never commit them.

| Variable | Scope | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | all | Public |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | all | Public (RLS protects the data) |
| `SUPABASE_SERVICE_ROLE_KEY` | server | **Secret.** Mark as sensitive |
| `ANTHROPIC_API_KEY` | server | **Secret.** Mark as sensitive |
| `NEXT_PUBLIC_SITE_URL` | Production | e.g. `https://mykpt.mu`. Used in sign-in email links. Leave unset for Preview (the request host is used) |

Route durations: `/api/chat` needs up to 300 s, revision generation 180 s, lesson generation 120 s. These are set per route with `maxDuration` and fit the default limits.

## 2. Supabase

1. Apply migrations: `npx supabase db push`.
2. Authentication → URL configuration:
   - **Site URL**: the production URL.
   - **Redirect URLs**: `https://<production-domain>/auth/callback` and, for previews, `https://*-<team>.vercel.app/auth/callback`.
3. Authentication → Email: set up a custom SMTP sender before launch (the built-in sender is rate limited and meant for testing).
4. Check Database → Advisors (security and performance) shows no warnings.

## 3. Before going live

- `npm run lint && npm run typecheck && npm run build`
- `npm run build && npm start`, then `npm test` against it (the service worker and offline tests only run on a production build).
- Sign up with a real email, finish onboarding, open a lesson, send a chat message, take a quiz.
- Confirm the helpline number in the tutor's safety reply and the exam marking support message.
- Have French and Kreol Morisien wording reviewed by native speakers.

## 4. After deploying

- Visit `/manifest.webmanifest`, `/robots.txt` and `/sw.js`, and install the app on an Android phone and an iPhone.
- Watch the Anthropic usage dashboard for the first days. Each student has a limit of 60 AI requests per hour (`src/server/ai/quota.ts`).
