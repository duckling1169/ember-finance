-- Ember Finance — views, functions, triggers
-- All views use security_invoker = true so RLS applies to the caller.
-- All security definer functions use set search_path = '' for safety.

-- ══════════════════════════════════════════════════════════════
-- Views
-- ══════════════════════════════════════════════════════════════

-- Unified timeline: raw_ingest + account_event in a single stream
create or replace view account_timeline
  with (security_invoker = true)
as
  select
    id, household_id, account_id,
    'ingest' as kind,
    source_type as event_type,
    jsonb_build_object(
      'source_ref', source_ref,
      'record_count', record_count,
      'status', status,
      'error', error
    ) as detail,
    triggered_by, created_at
  from raw_ingest
union all
  select
    id, household_id, account_id,
    'event' as kind,
    event_type, detail,
    triggered_by, created_at
  from account_event;

-- Duplicate candidates: visible transactions sharing (account, date, amount)
create or replace view duplicate_candidates_txn
  with (security_invoker = true)
as
  select t.*
  from transaction t
  inner join (
    select account_id, date, amount
    from transaction
    where is_hidden = false
    group by account_id, date, amount
    having count(*) > 1
  ) dups on t.account_id = dups.account_id
       and t.date = dups.date
       and t.amount = dups.amount
  where t.is_hidden = false;

-- Latest holding per (account, symbol) joined with live prices
create or replace view current_positions
  with (security_invoker = true)
as
select
  h.id              as holding_id,
  h.household_id,
  h.account_id,
  h.as_of,
  h.symbol,
  h.name,
  h.quantity,
  h.price           as snapshot_price,
  h.market_value    as snapshot_market_value,
  h.cost_basis,
  h.currency,
  h.asset_class,
  sp.price          as live_price,
  sp.prev_close,
  sp.day_change_pct,
  sp.updated_at     as price_updated_at,
  coalesce(sp.price, h.price) as effective_price,
  h.quantity * coalesce(sp.price, h.price) as live_market_value,
  case
    when h.cost_basis is not null and h.cost_basis > 0
    then (h.quantity * coalesce(sp.price, h.price)) - h.cost_basis
  end as unrealized_gain_loss,
  case
    when h.cost_basis is not null and h.cost_basis > 0
    then ((h.quantity * coalesce(sp.price, h.price)) - h.cost_basis) / h.cost_basis * 100
  end as unrealized_gain_loss_pct
from (
  select distinct on (account_id, symbol) *
  from holding
  order by account_id, symbol, as_of desc
) h
left join security_price sp on sp.symbol = h.symbol;

-- Aggregated holdings across all accounts for a household
create or replace view household_positions_summary
  with (security_invoker = true)
as
select
  cp.household_id,
  cp.symbol,
  cp.name,
  cp.asset_class,
  cp.currency,
  sum(cp.quantity)              as total_quantity,
  cp.live_price,
  cp.day_change_pct,
  sum(cp.live_market_value)    as total_market_value,
  sum(cp.cost_basis)           as total_cost_basis,
  sum(cp.unrealized_gain_loss) as total_unrealized_gain_loss,
  count(distinct cp.account_id) as account_count,
  cp.price_updated_at
from current_positions cp
group by
  cp.household_id, cp.symbol, cp.name, cp.asset_class,
  cp.currency, cp.live_price, cp.day_change_pct, cp.price_updated_at;

-- Open lots with live prices and computed holding period
create or replace view open_tax_lots
  with (security_invoker = true)
as
select
  tl.*,
  sp.price as live_price,
  tl.quantity * coalesce(sp.price, 0) as live_market_value,
  (tl.quantity * coalesce(sp.price, 0)) - (tl.quantity * tl.cost_basis_per_share) as unrealized_gain_loss,
  case
    when current_date - tl.acquired_date >= 365 then 'long_term'
    else 'short_term'
  end as holding_period
from tax_lot tl
left join security_price sp on sp.symbol = tl.symbol
where tl.is_closed = false;

-- Latest balance snapshot per account
create or replace view latest_account_balances
  with (security_invoker = true)
as
select distinct on (account_id)
  household_id, account_id, date, balance, available, source
from balance_snapshot
order by account_id, date desc;

-- ══════════════════════════════════════════════════════════════
-- Safety Triggers
-- ══════════════════════════════════════════════════════════════

-- Prevent one auth user from being in multiple households
create or replace function prevent_multi_household()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.member
    where auth_user_id = new.auth_user_id
      and household_id != new.household_id
  ) then
    raise exception 'User already belongs to a household';
  end if;
  return new;
end;
$$;

create trigger trg_prevent_multi_household
  before insert on member
  for each row
  when (new.auth_user_id is not null)
  execute function prevent_multi_household();

-- Prevent removing the last owner from a household
create or replace function prevent_last_owner_removal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.role = 'owner' then
    if not exists (
      select 1 from public.member
      where household_id = old.household_id
        and role = 'owner'
        and id != old.id
    ) then
      raise exception 'Cannot remove the last owner from a household';
    end if;
  end if;
  return old;
end;
$$;

create trigger trg_prevent_last_owner_removal
  before delete on member
  for each row
  execute function prevent_last_owner_removal();

-- ══════════════════════════════════════════════════════════════
-- RPC Functions
-- ══════════════════════════════════════════════════════════════

-- Atomic onboarding: creates household + owner member in one transaction
create or replace function create_household_with_owner(
  p_household_name     text,
  p_tax_filing_status  text default null,
  p_currency           text default 'USD',
  p_auth_user_id       uuid default null,
  p_display_name       text default null,
  p_birthday           date default null,
  p_target_retirement_age int default null,
  p_employment_type    text default null,
  p_risk_tolerance     text default null,
  p_state              text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_household_id uuid;
  v_member_id uuid;
  v_household jsonb;
  v_member jsonb;
begin
  if exists (select 1 from public.member where auth_user_id = p_auth_user_id) then
    raise exception 'User already belongs to a household'
      using errcode = '23505';
  end if;

  insert into public.household (name, tax_filing_status, currency)
  values (p_household_name, p_tax_filing_status, p_currency)
  returning id into v_household_id;

  select to_jsonb(h) into v_household
  from public.household h where h.id = v_household_id;

  insert into public.member (
    household_id, auth_user_id, display_name, role,
    birthday, target_retirement_age,
    employment_type, risk_tolerance, state
  )
  values (
    v_household_id, p_auth_user_id, p_display_name, 'owner',
    p_birthday, p_target_retirement_age,
    p_employment_type, p_risk_tolerance, p_state
  )
  returning id into v_member_id;

  select to_jsonb(m) into v_member
  from public.member m where m.id = v_member_id;

  return jsonb_build_object('household', v_household, 'member', v_member);
end;
$$;

-- Check if an email already belongs to a household (cross-household lookup)
create or replace function check_email_has_household(p_email text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from auth.users u
    join public.member m on m.auth_user_id = u.id
    where lower(u.email) = lower(p_email)
  );
$$;

-- Check record ownership (used by duplicate hide/unhide middleware)
create or replace function check_record_ownership(
  p_table text,
  p_record_id uuid,
  p_auth_user_id uuid
)
returns table(household_id uuid, member_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_table = 'transaction' then
    return query
      select t.household_id, m.id as member_id
      from public.transaction t
      join public.member m on m.household_id = t.household_id
        and m.auth_user_id = p_auth_user_id
      where t.id = p_record_id;
  elsif p_table = 'investment_activity' then
    return query
      select ia.household_id, m.id as member_id
      from public.investment_activity ia
      join public.member m on m.household_id = ia.household_id
        and m.auth_user_id = p_auth_user_id
      where ia.id = p_record_id;
  end if;
end;
$$;

-- Compute and upsert a net_worth_snapshot for a household
create or replace function compute_net_worth_snapshot(
  p_household_id uuid,
  p_date date default current_date
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_snapshot_id uuid;
  v_cash numeric(14,2) := 0;
  v_investments numeric(14,2) := 0;
  v_debt numeric(14,2) := 0;
  v_assets numeric(14,2) := 0;
  v_total_assets numeric(14,2);
  v_total_liabilities numeric(14,2);
  v_net_worth numeric(14,2);
begin
  -- Cash accounts
  select coalesce(sum(b.balance), 0) into v_cash
  from (
    select distinct on (a.id) bs.balance
    from public.account a
    join public.balance_snapshot bs on bs.account_id = a.id
    where a.household_id = p_household_id
      and a.is_active = true
      and a.account_type in ('checking', 'savings')
      and bs.date <= p_date
    order by a.id, bs.date desc
  ) b;

  -- Investment accounts: holdings x security_price
  select coalesce(sum(h.quantity * coalesce(sp.price, h.price)), 0) into v_investments
  from (
    select distinct on (hld.account_id, hld.symbol)
      hld.account_id, hld.symbol, hld.quantity, hld.price
    from public.holding hld
    join public.account a on a.id = hld.account_id
    where a.household_id = p_household_id
      and a.is_active = true
      and a.account_type in ('brokerage', 'retirement', 'hsa')
      and hld.as_of <= p_date
    order by hld.account_id, hld.symbol, hld.as_of desc
  ) h
  left join public.security_price sp on sp.symbol = h.symbol;

  -- Debt accounts
  select coalesce(sum(abs(b.balance)), 0) into v_debt
  from (
    select distinct on (a.id) bs.balance
    from public.account a
    join public.balance_snapshot bs on bs.account_id = a.id
    where a.household_id = p_household_id
      and a.is_active = true
      and a.account_type in ('credit', 'loan', 'mortgage')
      and bs.date <= p_date
    order by a.id, bs.date desc
  ) b;

  -- Assets (real estate, vehicles, etc.)
  select coalesce(sum(estimated_value), 0) into v_assets
  from public.asset
  where household_id = p_household_id;

  v_total_assets := v_cash + v_investments + v_assets;
  v_total_liabilities := v_debt;
  v_net_worth := v_total_assets - v_total_liabilities;

  insert into public.net_worth_snapshot (
    household_id, date, total_assets, total_liabilities, net_worth, breakdown
  )
  values (
    p_household_id, p_date, v_total_assets, v_total_liabilities, v_net_worth,
    jsonb_build_object(
      'cash', v_cash, 'investments', v_investments,
      'debt', v_debt, 'assets', v_assets
    )
  )
  on conflict (household_id, date)
  do update set
    total_assets = excluded.total_assets,
    total_liabilities = excluded.total_liabilities,
    net_worth = excluded.net_worth,
    breakdown = excluded.breakdown,
    created_at = now()
  returning id into v_snapshot_id;

  return v_snapshot_id;
end;
$$;
