-- 003: Security prices, tax lots, lot dispositions, position views
-- Adds decoupled price cache, per-account lot tracking, and position views

-- ── security_price: Global price cache (not per-household) ──

create table security_price (
  symbol          text primary key,
  name            text,
  price           numeric(14,4) not null,
  prev_close      numeric(14,4),
  day_change_pct  numeric(8,4),
  currency        text not null default 'USD',
  source          text not null,  -- yahoo | polygon | snaptrade | manual
  updated_at      timestamptz not null default now(),
  created_at      timestamptz not null default now()
);

comment on table security_price is 'Global security price cache. No RLS — prices are public market data.';

-- ── tax_lot: Per-account lot tracking ──

create table tax_lot (
  id                    uuid primary key default gen_random_uuid(),
  household_id          uuid not null references household(id),
  account_id            uuid not null references account(id),
  symbol                text not null,
  acquired_date         date not null,
  quantity              numeric(16,6) not null,          -- remaining (undepleted) shares
  original_quantity     numeric(16,6) not null,          -- shares at acquisition
  cost_basis_per_share  numeric(14,4) not null,
  cost_basis_total      numeric(14,2) not null,          -- original_quantity * cost_basis_per_share
  source                text not null,                   -- provider_lot | computed_fifo | manual
  provider_lot_id       text,                            -- maps to investment_activity.lot_id
  origin_activity_id    uuid references investment_activity(id),
  is_closed             boolean not null default false,
  closed_date           date,
  realized_gain_loss    numeric(14,2),
  wash_sale_adjustment  numeric(14,2) default 0,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  constraint chk_tax_lot_source
    check (source in ('provider_lot', 'computed_fifo', 'manual')),
  constraint chk_tax_lot_quantity_non_negative
    check (quantity >= 0),
  constraint chk_tax_lot_original_quantity_positive
    check (original_quantity > 0),
  constraint chk_tax_lot_closed_consistency
    check (
      (is_closed = false and closed_date is null)
      or (is_closed = true and closed_date is not null)
    )
);

create index idx_tax_lot_account_symbol on tax_lot(account_id, symbol);
create index idx_tax_lot_household on tax_lot(household_id);
create index idx_tax_lot_open on tax_lot(account_id, symbol, acquired_date)
  where is_closed = false;
create index idx_tax_lot_provider_lot on tax_lot(account_id, provider_lot_id)
  where provider_lot_id is not null;
create index idx_tax_lot_symbol on tax_lot(symbol);

-- ── lot_disposition: Junction mapping sells to lots ──

create table lot_disposition (
  id                uuid primary key default gen_random_uuid(),
  household_id      uuid not null references household(id),
  tax_lot_id        uuid not null references tax_lot(id),
  sell_activity_id  uuid not null references investment_activity(id),
  quantity          numeric(16,6) not null,    -- shares consumed from this lot
  proceeds          numeric(14,2) not null,    -- portion of sell proceeds for this slice
  cost_basis        numeric(14,2) not null,    -- cost basis for the consumed shares
  gain_loss         numeric(14,2) not null,    -- proceeds - cost_basis
  is_short_term     boolean not null,          -- acquired_date to sell date < 1 year
  created_at        timestamptz not null default now(),

  constraint chk_lot_disposition_quantity_positive
    check (quantity > 0),
  unique(tax_lot_id, sell_activity_id)
);

create index idx_lot_disp_lot on lot_disposition(tax_lot_id);
create index idx_lot_disp_sell on lot_disposition(sell_activity_id);
create index idx_lot_disp_household on lot_disposition(household_id);

-- ── RLS ──

alter table tax_lot enable row level security;
alter table lot_disposition enable row level security;

create policy "household_isolation" on tax_lot
  for all using (
    household_id in (select household_id from member where auth_user_id = auth.uid())
  );

create policy "household_isolation" on lot_disposition
  for all using (
    household_id in (select household_id from member where auth_user_id = auth.uid())
  );

-- security_price: no RLS — public market data, backend writes via service role

-- ── View: current_positions ──
-- Latest holding per (account, symbol) joined with live prices.

create or replace view current_positions as
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
    else null
  end as unrealized_gain_loss,
  case
    when h.cost_basis is not null and h.cost_basis > 0
    then ((h.quantity * coalesce(sp.price, h.price)) - h.cost_basis) / h.cost_basis * 100
    else null
  end as unrealized_gain_loss_pct
from (
  select distinct on (account_id, symbol)
    *
  from holding
  order by account_id, symbol, as_of desc
) h
left join security_price sp on sp.symbol = h.symbol;

-- ── View: household_positions_summary ──
-- Aggregated holdings across all accounts for a household.

create or replace view household_positions_summary as
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
  cp.household_id,
  cp.symbol,
  cp.name,
  cp.asset_class,
  cp.currency,
  cp.live_price,
  cp.day_change_pct,
  cp.price_updated_at;

-- ── View: open_tax_lots ──
-- Open lots with live prices and computed holding period.

create or replace view open_tax_lots as
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

-- ── Function: compute_net_worth_snapshot ──
-- Investments valued via holdings × security_price.
-- Cash/debt/illiquid use balance_snapshot.

create or replace function compute_net_worth_snapshot(
  p_household_id uuid,
  p_date date default current_date
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_snapshot_id uuid;
  v_cash numeric(14,2) := 0;
  v_investments numeric(14,2) := 0;
  v_debt numeric(14,2) := 0;
  v_illiquid numeric(14,2) := 0;
  v_total_assets numeric(14,2);
  v_total_liabilities numeric(14,2);
  v_net_worth numeric(14,2);
begin
  -- Cash accounts: latest balance on or before p_date
  select coalesce(sum(b.balance), 0) into v_cash
  from (
    select distinct on (a.id)
      bs.balance
    from account a
    join balance_snapshot bs on bs.account_id = a.id
    where a.household_id = p_household_id
      and a.is_active = true
      and a.account_type in ('checking', 'savings')
      and bs.date <= p_date
    order by a.id, bs.date desc
  ) b;

  -- Investment accounts: holdings × security_price
  select coalesce(sum(
    h.quantity * coalesce(sp.price, h.price)
  ), 0) into v_investments
  from (
    select distinct on (hld.account_id, hld.symbol)
      hld.account_id, hld.symbol, hld.quantity, hld.price
    from holding hld
    join account a on a.id = hld.account_id
    where a.household_id = p_household_id
      and a.is_active = true
      and a.account_type in ('brokerage', 'retirement', 'hsa')
      and hld.as_of <= p_date
    order by hld.account_id, hld.symbol, hld.as_of desc
  ) h
  left join security_price sp on sp.symbol = h.symbol;

  -- Debt accounts: latest balance as liability
  select coalesce(sum(abs(b.balance)), 0) into v_debt
  from (
    select distinct on (a.id)
      bs.balance
    from account a
    join balance_snapshot bs on bs.account_id = a.id
    where a.household_id = p_household_id
      and a.is_active = true
      and a.account_type in ('credit', 'loan', 'mortgage')
      and bs.date <= p_date
    order by a.id, bs.date desc
  ) b;

  -- Illiquid accounts: latest balance
  select coalesce(sum(b.balance), 0) into v_illiquid
  from (
    select distinct on (a.id)
      bs.balance
    from account a
    join balance_snapshot bs on bs.account_id = a.id
    where a.household_id = p_household_id
      and a.is_active = true
      and a.account_type in ('property', 'vehicle', 'other')
      and bs.date <= p_date
    order by a.id, bs.date desc
  ) b;

  v_total_assets := v_cash + v_investments + v_illiquid;
  v_total_liabilities := v_debt;
  v_net_worth := v_total_assets - v_total_liabilities;

  insert into net_worth_snapshot (household_id, date, total_assets, total_liabilities, net_worth, breakdown)
  values (
    p_household_id,
    p_date,
    v_total_assets,
    v_total_liabilities,
    v_net_worth,
    jsonb_build_object(
      'cash', v_cash,
      'investments', v_investments,
      'debt', v_debt,
      'illiquid', v_illiquid
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

comment on function compute_net_worth_snapshot is
  'Computes and upserts a net_worth_snapshot for a household. Investments valued using holdings × security_price.';
