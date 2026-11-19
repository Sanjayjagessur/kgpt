-- Nullable arguments of apply_subscription_event get defaults (so generated
-- types mark them optional). Same behaviour as before.
drop function public.apply_subscription_event(
  uuid, uuid, text, text, public.subscription_status, public.billing_plan, timestamptz, timestamptz, timestamptz
);

create or replace function public.apply_subscription_event(
  p_student_id uuid,
  p_consent_id uuid,
  p_subscription_id text,
  p_status public.subscription_status,
  p_occurred_at timestamptz,
  p_customer_id text default null,
  p_plan public.billing_plan default null,
  p_period_end timestamptz default null,
  p_cancel_at timestamptz default null
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
  uuid, uuid, text, public.subscription_status, timestamptz, text, public.billing_plan, timestamptz, timestamptz
) from public, anon, authenticated;
grant execute on function public.apply_subscription_event(
  uuid, uuid, text, public.subscription_status, timestamptz, text, public.billing_plan, timestamptz, timestamptz
) to service_role;
