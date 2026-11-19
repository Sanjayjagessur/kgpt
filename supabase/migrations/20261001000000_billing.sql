-- Phase 7: paid plans. A 14-day trial for every student, then a plan bought
-- by a parent (who also gives consent) through Paddle. Billing rows are only
-- written by the server (service role, from the Paddle webhook).

-- ---------------------------------------------------------------------------
-- Trial
-- ---------------------------------------------------------------------------
-- Existing students get the same 14 days from today. Not in the column grant,
-- so students cannot change it.
alter table public.profiles
  add column trial_ends_at timestamptz not null default (now() + interval '14 days');

-- ---------------------------------------------------------------------------
-- Parent invites: a one-time link a student shares with a parent.
-- Only the sha256 of the token is stored.
-- ---------------------------------------------------------------------------
create table public.parent_invites (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles (id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null default (now() + interval '7 days'),
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index parent_invites_student_idx on public.parent_invites (student_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Parent consents: written when a parent agrees on the invite page.
-- ---------------------------------------------------------------------------
create table public.parent_consents (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles (id) on delete cascade,
  invite_id uuid references public.parent_invites (id) on delete set null,
  parent_name text not null check (char_length(parent_name) between 1 and 80),
  terms_version text not null,
  consented_at timestamptz not null default now()
);
create index parent_consents_student_idx on public.parent_consents (student_id, consented_at desc);
create index parent_consents_invite_idx on public.parent_consents (invite_id);

-- ---------------------------------------------------------------------------
-- Subscriptions: one per student, mirrored from Paddle.
-- ---------------------------------------------------------------------------
create type public.subscription_status as enum ('trialing', 'active', 'past_due', 'paused', 'canceled');
create type public.billing_plan as enum ('monthly', 'yearly');

create table public.subscriptions (
  student_id uuid primary key references public.profiles (id) on delete cascade,
  provider text not null default 'paddle',
  provider_subscription_id text not null unique,
  provider_customer_id text,
  status public.subscription_status not null,
  plan public.billing_plan,
  current_period_end timestamptz,
  cancel_at timestamptz,
  consent_id uuid references public.parent_consents (id) on delete set null,
  last_event_at timestamptz not null,
  updated_at timestamptz not null default now()
);
create index subscriptions_consent_idx on public.subscriptions (consent_id);
create trigger subscriptions_updated_at before update on public.subscriptions
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS: students read their own rows; only invites can be created by them.
-- ---------------------------------------------------------------------------
alter table public.parent_invites enable row level security;
alter table public.parent_consents enable row level security;
alter table public.subscriptions enable row level security;

create policy "own rows read" on public.parent_invites for select to authenticated
  using (student_id = (select auth.uid()));
create policy "own rows insert" on public.parent_invites for insert to authenticated
  with check (student_id = (select auth.uid()));
revoke insert on public.parent_invites from authenticated, anon;
grant insert (student_id, token_hash) on public.parent_invites to authenticated;

create policy "own rows read" on public.parent_consents for select to authenticated
  using (student_id = (select auth.uid()));
create policy "own rows read" on public.subscriptions for select to authenticated
  using (student_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Access check used by the AI routes.
-- Trial still running, or a paid plan that is active or in payment retry.
-- ---------------------------------------------------------------------------
create or replace function public.has_ai_access()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.trial_ends_at > now()
  ) or exists (
    select 1 from public.subscriptions s
    where s.student_id = (select auth.uid())
      and s.status in ('active', 'trialing', 'past_due')
  );
$$;
revoke execute on function public.has_ai_access() from public, anon;
grant execute on function public.has_ai_access() to authenticated;

-- ---------------------------------------------------------------------------
-- Applies one Paddle subscription event. Called by the webhook (service role).
-- Ignores events older than the last one applied (Paddle may deliver out of
-- order or retry). Requires a recorded parent consent for the student.
-- Returns false when the event was ignored.
-- ---------------------------------------------------------------------------
create or replace function public.apply_subscription_event(
  p_student_id uuid,
  p_consent_id uuid,
  p_subscription_id text,
  p_customer_id text,
  p_status public.subscription_status,
  p_plan public.billing_plan,
  p_period_end timestamptz,
  p_cancel_at timestamptz,
  p_occurred_at timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invite uuid;
begin
  select c.invite_id into v_invite
  from public.parent_consents c
  where c.id = p_consent_id and c.student_id = p_student_id;
  if not found then
    raise exception 'no parent consent for this student' using errcode = '23503';
  end if;

  insert into public.subscriptions as s (
    student_id, provider_subscription_id, provider_customer_id, status, plan,
    current_period_end, cancel_at, consent_id, last_event_at
  )
  values (
    p_student_id, p_subscription_id, p_customer_id, p_status, p_plan,
    p_period_end, p_cancel_at, p_consent_id, p_occurred_at
  )
  on conflict (student_id) do update set
    provider_subscription_id = excluded.provider_subscription_id,
    provider_customer_id = excluded.provider_customer_id,
    status = excluded.status,
    plan = coalesce(excluded.plan, s.plan),
    current_period_end = excluded.current_period_end,
    cancel_at = excluded.cancel_at,
    consent_id = excluded.consent_id,
    last_event_at = excluded.last_event_at
  where s.last_event_at < excluded.last_event_at;

  if not found then
    return false;
  end if;

  if v_invite is not null then
    update public.parent_invites set used_at = coalesce(used_at, now()) where id = v_invite;
  end if;
  return true;
end;
$$;
revoke execute on function public.apply_subscription_event(
  uuid, uuid, text, text, public.subscription_status, public.billing_plan, timestamptz, timestamptz, timestamptz
) from public, anon, authenticated;
grant execute on function public.apply_subscription_event(
  uuid, uuid, text, text, public.subscription_status, public.billing_plan, timestamptz, timestamptz, timestamptz
) to service_role;
