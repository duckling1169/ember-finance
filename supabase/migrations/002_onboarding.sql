-- Onboarding: invites, RPC functions, and safety triggers

-- ── Household Invites ──

create table household_invite (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references household(id),
  email         text not null,
  invited_by    uuid not null references member(id),
  role          text not null default 'owner',  -- owner | viewer
  expires_at    timestamptz not null default (now() + interval '24 hours'),
  accepted_at   timestamptz,
  created_at    timestamptz default now()
);

create index idx_invite_household on household_invite(household_id);
create index idx_invite_email on household_invite(email);
create index idx_invite_pending on household_invite(household_id, email)
  where accepted_at is null;

-- RLS: invites visible to household members + the invited email user
alter table household_invite enable row level security;

create policy "household_isolation" on household_invite
  for all using (
    household_id in (select household_id from member where auth_user_id = auth.uid())
    or email = (select email from auth.users where id = auth.uid())
  );

-- ── Atomic onboarding RPC ──
-- Creates household + owner member in a single transaction

create or replace function create_household_with_owner(
  p_household_name     text,
  p_tax_filing_status  text default null,
  p_state              text default null,
  p_currency           text default 'USD',
  p_auth_user_id       uuid default null,
  p_display_name       text default null,
  p_birthday           date default null,
  p_target_retirement_age int default null,
  p_annual_income      numeric(14,2) default null,
  p_employment_type    text default null,
  p_risk_tolerance     text default null
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_household_id uuid;
  v_member_id uuid;
  v_household jsonb;
  v_member jsonb;
begin
  -- Check user doesn't already belong to a household
  if exists (select 1 from member where auth_user_id = p_auth_user_id) then
    raise exception 'User already belongs to a household'
      using errcode = '23505'; -- unique_violation
  end if;

  -- Create household
  insert into household (name, tax_filing_status, state, currency)
  values (p_household_name, p_tax_filing_status, p_state, p_currency)
  returning id into v_household_id;

  select to_jsonb(h) into v_household
  from household h where h.id = v_household_id;

  -- Create owner member
  insert into member (
    household_id, auth_user_id, display_name, role,
    birthday, target_retirement_age, annual_income,
    employment_type, risk_tolerance
  )
  values (
    v_household_id, p_auth_user_id, p_display_name, 'owner',
    p_birthday, p_target_retirement_age, p_annual_income,
    p_employment_type, p_risk_tolerance
  )
  returning id into v_member_id;

  select to_jsonb(m) into v_member
  from member m where m.id = v_member_id;

  return jsonb_build_object('household', v_household, 'member', v_member);
end;
$$;

-- ── Check if an email already belongs to a household ──
-- Used by invite flow to reject invites to users who already have a household.
-- Queries auth.users by email, then checks member table. Avoids listUsers() full scan.

create or replace function check_email_has_household(p_email text)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1
    from auth.users u
    join member m on m.auth_user_id = u.id
    where lower(u.email) = lower(p_email)
  );
$$;

-- ── Safety Triggers ──

-- Prevent one auth user from being in multiple households
create or replace function prevent_multi_household()
returns trigger as $$
begin
  if exists (select 1 from member where auth_user_id = new.auth_user_id and household_id != new.household_id) then
    raise exception 'User already belongs to a household';
  end if;
  return new;
end;
$$ language plpgsql;

create trigger trg_prevent_multi_household
  before insert on member
  for each row
  when (new.auth_user_id is not null)
  execute function prevent_multi_household();

-- Prevent removing the last owner from a household
create or replace function prevent_last_owner_removal()
returns trigger as $$
begin
  if old.role = 'owner' then
    if not exists (
      select 1 from member
      where household_id = old.household_id
        and role = 'owner'
        and id != old.id
    ) then
      raise exception 'Cannot remove the last owner from a household';
    end if;
  end if;
  return old;
end;
$$ language plpgsql;

create trigger trg_prevent_last_owner_removal
  before delete on member
  for each row
  execute function prevent_last_owner_removal();
