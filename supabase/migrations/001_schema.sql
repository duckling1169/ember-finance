-- Ember Finance — schema
-- Tables, indexes, RLS policies

-- ══════════════════════════════════════════════════════════════
-- Layer 1: Identity
-- ══════════════════════════════════════════════════════════════

create table household (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  tax_filing_status   text,
  currency            text not null default 'USD',
  created_at          timestamptz default now(),

  constraint chk_household_tax_filing_status
    check (tax_filing_status is null or tax_filing_status in (
      'single', 'married_jointly', 'married_separately', 'head_of_household'
    ))
);

create table member (
  id                            uuid primary key default gen_random_uuid(),
  household_id                  uuid not null references household(id) on delete cascade,
  auth_user_id                  uuid unique references auth.users(id) on delete cascade,
  display_name                  text not null,
  role                          text not null default 'owner',
  birthday                      date,
  target_retirement_age         int,
  employment_type               text,
  risk_tolerance                text,
  state                         text,
  tax_mode                      text not null default 'auto',
  effective_tax_rate_override   numeric(5,4),
  created_at                    timestamptz default now(),

  constraint chk_member_birthday
    check (birthday is null or birthday < current_date),
  constraint chk_member_retirement_age
    check (target_retirement_age is null or target_retirement_age > 0),
  constraint chk_member_employment_type
    check (employment_type is null or employment_type in ('w2', '1099', 'mixed')),
  constraint chk_member_risk_tolerance
    check (risk_tolerance is null or risk_tolerance in ('conservative', 'moderate', 'aggressive')),
  constraint chk_member_state
    check (state is null or length(state) = 2),
  constraint chk_member_tax_mode
    check (tax_mode in ('auto', 'manual')),
  constraint chk_member_tax_rate_override
    check (effective_tax_rate_override is null or (effective_tax_rate_override >= 0 and effective_tax_rate_override <= 1))
);

create index idx_member_household_auth on member(household_id, auth_user_id);

-- ══════════════════════════════════════════════════════════════
-- Layer 1b: Invites
-- ══════════════════════════════════════════════════════════════

create table household_invite (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references household(id) on delete cascade,
  email         text not null,
  invited_by    uuid not null references member(id) on delete cascade,
  role          text not null default 'owner',
  expires_at    timestamptz not null default (now() + interval '24 hours'),
  accepted_at   timestamptz,
  created_at    timestamptz default now()
);

create index idx_invite_household on household_invite(household_id);
create index idx_invite_email on household_invite(email);
create index idx_invite_pending on household_invite(household_id, email)
  where accepted_at is null;

-- ══════════════════════════════════════════════════════════════
-- Layer 2: Accounts & Sources
-- ══════════════════════════════════════════════════════════════

create table account (
  id                      uuid primary key default gen_random_uuid(),
  household_id            uuid not null references household(id) on delete cascade,
  member_id               uuid references member(id) on delete set null,
  name                    text not null,
  institution             text,
  account_type            text not null,
  currency                text not null default 'USD',
  meta                    jsonb default '{}',
  is_active               boolean default true,
  is_liability            boolean default false,
  include_in_fi_portfolio boolean not null default false,
  tax_treatment           text not null default 'none',
  created_at              timestamptz default now(),

  constraint chk_account_type
    check (account_type in (
      'checking', 'savings', 'credit', 'brokerage', 'retirement',
      'hsa', 'loan', 'mortgage', 'other'
    )),
  constraint chk_account_tax_treatment
    check (tax_treatment in ('pre_tax', 'after_tax', 'tax_free', 'none'))
);

create index idx_account_household on account(household_id, is_active);

create table account_source (
  id                  uuid primary key default gen_random_uuid(),
  account_id          uuid not null references account(id) on delete cascade,
  household_id        uuid not null references household(id) on delete cascade,
  provider            text not null,
  provider_account_id text,
  provider_meta       bytea,
  is_active           boolean default true,
  last_synced         timestamptz,
  created_at          timestamptz default now(),
  unique(account_id, provider, provider_account_id)
);

create index idx_account_source_account on account_source(account_id);
create index idx_account_source_provider on account_source(account_id, household_id, provider);

-- ══════════════════════════════════════════════════════════════
-- Layer 2b: Assets (non-account items tracked for net worth)
-- ══════════════════════════════════════════════════════════════

create table asset (
  id              uuid primary key default gen_random_uuid(),
  household_id    uuid not null references household(id) on delete cascade,
  name            text not null,
  category        text not null,
  estimated_value numeric(14,2) not null default 0,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now(),

  constraint chk_asset_category
    check (category in ('real_estate', 'vehicle', 'other')),
  constraint chk_asset_value_non_negative
    check (estimated_value >= 0)
);

create index idx_asset_household on asset(household_id);

-- ══════════════════════════════════════════════════════════════
-- Layer 3: Raw Ingestion (immutable audit trail)
-- ══════════════════════════════════════════════════════════════

create table raw_ingest (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references household(id) on delete cascade,
  account_id    uuid references account(id) on delete set null,
  source_id     uuid references account_source(id) on delete set null,
  source_type   text not null,
  source_ref    text,
  payload       jsonb not null,
  record_count  int,
  status        text not null default 'pending',
  error         text,
  triggered_by  uuid references member(id) on delete set null,
  processed_at  timestamptz,
  created_at    timestamptz default now()
);

create index idx_raw_ingest_status on raw_ingest(status) where status = 'pending';
create index idx_raw_ingest_account on raw_ingest(account_id);
create index idx_raw_ingest_triggered_by on raw_ingest(triggered_by);
create index idx_raw_ingest_account_created on raw_ingest(household_id, account_id, created_at desc);

-- ══════════════════════════════════════════════════════════════
-- Layer 3b: Account Events (non-ingestion lifecycle events)
-- ══════════════════════════════════════════════════════════════

create table account_event (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references household(id) on delete cascade,
  account_id    uuid not null references account(id) on delete cascade,
  event_type    text not null,
  triggered_by  uuid references member(id) on delete set null,
  detail        jsonb default '{}',
  created_at    timestamptz default now()
);

create index idx_account_event_account on account_event(account_id, created_at desc);
create index idx_account_event_household on account_event(household_id, created_at desc);

-- ══════════════════════════════════════════════════════════════
-- Layer 4a: Cash Transactions
-- ══════════════════════════════════════════════════════════════

create table transaction (
  id              uuid primary key default gen_random_uuid(),
  household_id    uuid not null references household(id) on delete cascade,
  account_id      uuid not null references account(id) on delete cascade,
  raw_ingest_id   uuid references raw_ingest(id) on delete set null,
  date            date not null,
  amount          numeric(14,2) not null,
  description     text not null,
  category        text,
  is_transfer     boolean default false,
  provider_txn_id text,
  fingerprint     text,
  is_hidden       boolean not null default false,
  hidden_reason   text,
  created_at      timestamptz default now(),
  unique(account_id, provider_txn_id),
  unique(account_id, fingerprint)
);

create index idx_txn_household_date on transaction(household_id, date desc);
create index idx_txn_account_date on transaction(account_id, date desc);
create index idx_txn_not_hidden on transaction(account_id, date desc) where is_hidden = false;
create index idx_txn_dedup_lookup on transaction(account_id, date, amount);

-- ══════════════════════════════════════════════════════════════
-- Layer 4b: Investment Activity
-- ══════════════════════════════════════════════════════════════

create table investment_activity (
  id              uuid primary key default gen_random_uuid(),
  household_id    uuid not null references household(id) on delete cascade,
  account_id      uuid not null references account(id) on delete cascade,
  raw_ingest_id   uuid references raw_ingest(id) on delete set null,
  date            date not null,
  activity_type   text not null,
  symbol          text,
  description     text,
  quantity        numeric(16,6),
  price           numeric(14,4),
  amount          numeric(14,2) not null,
  commission      numeric(10,2) default 0,
  currency        text default 'USD',
  lot_id          text,
  provider_txn_id text,
  fingerprint     text,
  is_hidden       boolean not null default false,
  hidden_reason   text,
  created_at      timestamptz default now(),
  unique(account_id, provider_txn_id),
  unique(account_id, fingerprint)
);

create index idx_inv_activity_household_date on investment_activity(household_id, date desc);
create index idx_inv_activity_account_symbol on investment_activity(account_id, symbol, date desc);
create index idx_inv_activity_type on investment_activity(activity_type);
create index idx_inv_activity_not_hidden on investment_activity(account_id, date desc) where is_hidden = false;
create index idx_inv_activity_dedup_lookup on investment_activity(account_id, date, amount);

-- ══════════════════════════════════════════════════════════════
-- Layer 4c: Holdings (point-in-time snapshots)
-- ══════════════════════════════════════════════════════════════

create table holding (
  id              uuid primary key default gen_random_uuid(),
  household_id    uuid not null references household(id) on delete cascade,
  account_id      uuid not null references account(id) on delete cascade,
  raw_ingest_id   uuid references raw_ingest(id) on delete set null,
  as_of           date not null,
  symbol          text not null,
  name            text,
  quantity        numeric(16,6) not null,
  price           numeric(14,4),
  market_value    numeric(14,2) not null,
  cost_basis      numeric(14,2),
  currency        text default 'USD',
  asset_class     text,
  created_at      timestamptz default now(),
  unique(account_id, as_of, symbol)
);

create index idx_holding_household_date on holding(household_id, as_of desc);
create index idx_holding_symbol on holding(symbol, as_of desc);

-- ══════════════════════════════════════════════════════════════
-- Layer 4d: Balance Snapshots
-- ══════════════════════════════════════════════════════════════

create table balance_snapshot (
  id              uuid primary key default gen_random_uuid(),
  household_id    uuid not null references household(id) on delete cascade,
  account_id      uuid not null references account(id) on delete cascade,
  raw_ingest_id   uuid references raw_ingest(id) on delete set null,
  date            date not null,
  balance         numeric(14,2) not null,
  available       numeric(14,2),
  source          text not null,
  created_at      timestamptz default now(),
  unique(account_id, date, source)
);

create index idx_balance_household_date on balance_snapshot(household_id, date desc);
create index idx_balance_account_date on balance_snapshot(account_id, date desc);

-- ══════════════════════════════════════════════════════════════
-- Layer 4e: Security Prices (global, no RLS)
-- ══════════════════════════════════════════════════════════════

create table security_price (
  symbol          text primary key,
  name            text,
  price           numeric(14,4) not null,
  prev_close      numeric(14,4),
  day_change_pct  numeric(8,4),
  currency        text not null default 'USD',
  source          text not null,
  updated_at      timestamptz not null default now(),
  created_at      timestamptz not null default now()
);

comment on table security_price is 'Global price cache. No RLS — public market data.';

-- ══════════════════════════════════════════════════════════════
-- Layer 4f: Tax Lots & Dispositions
-- ══════════════════════════════════════════════════════════════

create table tax_lot (
  id                    uuid primary key default gen_random_uuid(),
  household_id          uuid not null references household(id) on delete cascade,
  account_id            uuid not null references account(id) on delete cascade,
  symbol                text not null,
  acquired_date         date not null,
  quantity              numeric(16,6) not null,
  original_quantity     numeric(16,6) not null,
  cost_basis_per_share  numeric(14,4) not null,
  cost_basis_total      numeric(14,2) not null,
  source                text not null,
  provider_lot_id       text,
  origin_activity_id    uuid references investment_activity(id) on delete set null,
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

create table lot_disposition (
  id                uuid primary key default gen_random_uuid(),
  household_id      uuid not null references household(id) on delete cascade,
  tax_lot_id        uuid not null references tax_lot(id) on delete cascade,
  sell_activity_id  uuid not null references investment_activity(id) on delete cascade,
  quantity          numeric(16,6) not null,
  proceeds          numeric(14,2) not null,
  cost_basis        numeric(14,2) not null,
  gain_loss         numeric(14,2) not null,
  is_short_term     boolean not null,
  created_at        timestamptz not null default now(),

  constraint chk_lot_disposition_quantity_positive
    check (quantity > 0),
  unique(tax_lot_id, sell_activity_id)
);

create index idx_lot_disp_lot on lot_disposition(tax_lot_id);
create index idx_lot_disp_sell on lot_disposition(sell_activity_id);
create index idx_lot_disp_household on lot_disposition(household_id);

-- ══════════════════════════════════════════════════════════════
-- Layer 5: Derived / Materialized
-- ══════════════════════════════════════════════════════════════

create table net_worth_snapshot (
  id                uuid primary key default gen_random_uuid(),
  household_id      uuid not null references household(id) on delete cascade,
  date              date not null,
  total_assets      numeric(14,2) not null,
  total_liabilities numeric(14,2) not null,
  net_worth         numeric(14,2) not null,
  breakdown         jsonb not null default '{}',
  created_at        timestamptz default now(),
  unique(household_id, date)
);

create index idx_nw_household_date on net_worth_snapshot(household_id, date desc);

-- ══════════════════════════════════════════════════════════════
-- Layer 6: Planning
-- ══════════════════════════════════════════════════════════════

create table income_source (
  id              uuid primary key default gen_random_uuid(),
  household_id    uuid not null references household(id) on delete cascade,
  member_id       uuid not null references member(id) on delete cascade,
  name            text not null,
  type            text not null,
  gross_amount    numeric(14,2) not null,
  frequency       text not null,
  is_active       boolean not null default true,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now(),

  constraint chk_income_source_type
    check (type in ('employment', 'self_employment', 'passive', 'other')),
  constraint chk_income_source_amount_positive
    check (gross_amount > 0),
  constraint chk_income_source_frequency
    check (frequency in ('monthly', 'biweekly', 'annual', 'one_time'))
);

create index idx_income_source_household on income_source(household_id);
create index idx_income_source_member on income_source(member_id);

create table cashflow_item (
  id                      uuid primary key default gen_random_uuid(),
  household_id            uuid not null references household(id) on delete cascade,
  member_id               uuid references member(id) on delete set null,
  income_source_id        uuid references income_source(id) on delete set null,
  source_account_id       uuid references account(id) on delete set null,
  destination_account_id  uuid references account(id) on delete set null,
  name                    text not null,
  direction               text not null,
  bucket                  text not null,
  amount                  numeric(14,2) not null,
  amount_type             text not null default 'fixed',
  frequency               text not null,
  is_recurring            boolean not null default true,
  is_essential            boolean not null default true,
  category                text,
  include_in_projection   boolean not null default true,
  start_date              date not null,
  end_date                date,
  created_at              timestamptz default now(),
  updated_at              timestamptz default now(),

  constraint chk_cashflow_direction
    check (direction in ('inflow', 'outflow')),
  constraint chk_cashflow_bucket
    check (bucket in ('savings', 'employer_match', 'expense')),
  constraint chk_cashflow_amount_positive
    check (amount > 0),
  constraint chk_cashflow_frequency
    check (frequency in ('monthly', 'biweekly', 'annual', 'one_time')),
  constraint chk_cashflow_amount_type
    check (amount_type in ('fixed', 'percent')),
  constraint chk_cashflow_percent_requires_income
    check (amount_type != 'percent' or income_source_id is not null),
  constraint chk_cashflow_percent_range
    check (amount_type != 'percent' or amount <= 100),
  constraint chk_cashflow_date_range
    check (end_date is null or end_date >= start_date)
);

create index idx_cashflow_item_household on cashflow_item(household_id);
create index idx_cashflow_item_member on cashflow_item(member_id) where member_id is not null;
create index idx_cashflow_item_income_source on cashflow_item(income_source_id)
  where income_source_id is not null;
create index idx_cashflow_item_source_account on cashflow_item(source_account_id)
  where source_account_id is not null;
create index idx_cashflow_item_destination on cashflow_item(destination_account_id)
  where destination_account_id is not null;

create table planning_scenario (
  id              uuid primary key default gen_random_uuid(),
  household_id    uuid not null references household(id) on delete cascade,
  name            text not null,
  is_base         boolean not null default false,
  assumptions     jsonb not null default '{}',
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

create index idx_planning_scenario_household on planning_scenario(household_id);

create table expense_category (
  id              uuid primary key default gen_random_uuid(),
  household_id    uuid not null references household(id) on delete cascade,
  name            text not null,
  is_essential    boolean not null default true,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now(),

  constraint uq_expense_category_name unique (household_id, name)
);

create index idx_expense_category_household on expense_category(household_id);

-- ══════════════════════════════════════════════════════════════
-- RLS: household isolation via security definer helper
-- ══════════════════════════════════════════════════════════════

create or replace function get_my_household_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select household_id from public.member where auth_user_id = auth.uid() limit 1;
$$;

alter table household enable row level security;
create policy "household_isolation" on household
  for all using (id = get_my_household_id());

alter table member enable row level security;
create policy "household_isolation" on member
  for all using (household_id = get_my_household_id());

alter table household_invite enable row level security;
create policy "household_isolation" on household_invite
  for all using (
    household_id = get_my_household_id()
    or email = (auth.jwt() ->> 'email')
  );

alter table account enable row level security;
create policy "household_isolation" on account
  for all using (household_id = get_my_household_id());

alter table account_source enable row level security;
create policy "household_isolation" on account_source
  for all using (household_id = get_my_household_id());

alter table asset enable row level security;
create policy "household_isolation" on asset
  for all using (household_id = get_my_household_id());

alter table raw_ingest enable row level security;
create policy "household_isolation" on raw_ingest
  for all using (household_id = get_my_household_id());

alter table account_event enable row level security;
create policy "household_isolation" on account_event
  for all using (household_id = get_my_household_id());

alter table transaction enable row level security;
create policy "household_isolation" on transaction
  for all using (household_id = get_my_household_id());

alter table investment_activity enable row level security;
create policy "household_isolation" on investment_activity
  for all using (household_id = get_my_household_id());

alter table holding enable row level security;
create policy "household_isolation" on holding
  for all using (household_id = get_my_household_id());

alter table balance_snapshot enable row level security;
create policy "household_isolation" on balance_snapshot
  for all using (household_id = get_my_household_id());

alter table tax_lot enable row level security;
create policy "household_isolation" on tax_lot
  for all using (household_id = get_my_household_id());

alter table lot_disposition enable row level security;
create policy "household_isolation" on lot_disposition
  for all using (household_id = get_my_household_id());

alter table net_worth_snapshot enable row level security;
create policy "household_isolation" on net_worth_snapshot
  for all using (household_id = get_my_household_id());

alter table income_source enable row level security;
create policy "household_isolation" on income_source
  for all using (household_id = get_my_household_id());

alter table cashflow_item enable row level security;
create policy "household_isolation" on cashflow_item
  for all using (household_id = get_my_household_id());

alter table planning_scenario enable row level security;
create policy "household_isolation" on planning_scenario
  for all using (household_id = get_my_household_id());

alter table expense_category enable row level security;
create policy "household_isolation" on expense_category
  for all using (household_id = get_my_household_id());
