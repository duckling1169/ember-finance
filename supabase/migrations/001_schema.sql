-- Ember schema — consolidated
-- All tables, indexes, RLS policies, views, and functions

-- ── Layer 1: Identity ──

create table household (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  tax_filing_status   text,  -- single | married_jointly | married_separately | head_of_household
  state               text,  -- US state abbreviation
  currency            text not null default 'USD',
  created_at          timestamptz default now(),

  constraint chk_household_tax_filing_status
    check (tax_filing_status is null or tax_filing_status in (
      'single', 'married_jointly', 'married_separately', 'head_of_household'
    )),
  constraint chk_household_state
    check (state is null or length(state) = 2)
);

create table member (
  id                    uuid primary key default gen_random_uuid(),
  household_id          uuid not null references household(id),
  auth_user_id          uuid unique references auth.users(id),
  display_name          text not null,
  role                  text not null default 'owner',  -- owner | viewer
  birthday              date,
  target_retirement_age int,
  annual_income         numeric(14,2),
  employment_type       text,  -- w2 | 1099 | mixed
  risk_tolerance        text,  -- conservative | moderate | aggressive
  created_at            timestamptz default now(),

  constraint chk_member_birthday
    check (birthday is null or birthday < current_date),
  constraint chk_member_retirement_age
    check (target_retirement_age is null or target_retirement_age > 0),
  constraint chk_member_income
    check (annual_income is null or annual_income > 0),
  constraint chk_member_employment_type
    check (employment_type is null or employment_type in ('w2', '1099', 'mixed')),
  constraint chk_member_risk_tolerance
    check (risk_tolerance is null or risk_tolerance in ('conservative', 'moderate', 'aggressive'))
);

-- Auth middleware: (household_id, auth_user_id) on every authenticated request
-- auth_user_id has a unique constraint (implicit index) but the compound lookup needs this
create index idx_member_household_auth on member(household_id, auth_user_id);

-- ── Layer 2: Accounts & Sources ──

create table account (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references household(id),
  member_id     uuid references member(id),
  name          text not null,
  institution   text,
  account_type  text not null,  -- checking | savings | credit | brokerage | retirement | hsa | loan | mortgage | property | vehicle | other
  currency      text not null default 'USD',
  meta          jsonb default '{}',
  is_active     boolean default true,
  is_liability  boolean default false,
  created_at    timestamptz default now()
);

create index idx_account_household on account(household_id, is_active);

create table account_source (
  id                  uuid primary key default gen_random_uuid(),
  account_id          uuid not null references account(id),
  household_id        uuid not null references household(id),
  provider            text not null,            -- teller | snaptrade | csv | pdf | manual
  provider_account_id text,
  provider_meta       bytea,                    -- encrypted with libsodium
  is_active           boolean default true,
  last_synced         timestamptz,
  created_at          timestamptz default now(),
  unique(account_id, provider, provider_account_id)
);

create index idx_account_source_account on account_source(account_id);
create index idx_account_source_provider on account_source(account_id, household_id, provider);

-- ── Layer 3: Raw Ingestion (Immutable Audit Trail) ──

create table raw_ingest (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references household(id),
  account_id    uuid references account(id),
  source_id     uuid references account_source(id),
  source_type   text not null,  -- teller_sync | snaptrade_sync | csv_upload | pdf_parse | manual_entry
  source_ref    text,
  payload       jsonb not null,
  record_count  int,
  status        text not null default 'pending',  -- pending | processed | failed | skipped
  error         text,
  triggered_by  uuid references member(id),
  processed_at  timestamptz,
  created_at    timestamptz default now()
);

create index idx_raw_ingest_status on raw_ingest(status) where status = 'pending';
create index idx_raw_ingest_account on raw_ingest(account_id);
create index idx_raw_ingest_triggered_by on raw_ingest(triggered_by);
create index idx_raw_ingest_account_created on raw_ingest(household_id, account_id, created_at desc);

-- ── Layer 3b: Account Events (Non-Ingestion Lifecycle Events) ──

create table account_event (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references household(id),
  account_id    uuid not null references account(id),
  event_type    text not null,  -- account_created | account_updated | account_deactivated | link_connected | link_disconnected | source_added | source_removed
  triggered_by  uuid references member(id),
  detail        jsonb default '{}',  -- flexible payload: { provider, fields_changed, old_value, new_value, etc. }
  created_at    timestamptz default now()
);

create index idx_account_event_account on account_event(account_id, created_at desc);
create index idx_account_event_household on account_event(household_id, created_at desc);

-- ── Layer 4a: Cash Transactions ──

create table transaction (
  id              uuid primary key default gen_random_uuid(),
  household_id    uuid not null references household(id),
  account_id      uuid not null references account(id),
  raw_ingest_id   uuid references raw_ingest(id),
  date            date not null,
  amount          numeric(14,2) not null,
  description     text not null,
  category        text,
  is_transfer     boolean default false,
  provider_txn_id text,
  fingerprint     text,
  is_hidden       boolean not null default false,
  hidden_reason   text,  -- auto:cross_source_duplicate | auto:near_duplicate | manual
  created_at      timestamptz default now(),
  unique(account_id, provider_txn_id),
  unique(account_id, fingerprint)
);

create index idx_txn_household_date on transaction(household_id, date desc);
create index idx_txn_account_date on transaction(account_id, date desc);
create index idx_txn_not_hidden on transaction(account_id, date desc) where is_hidden = false;
create index idx_txn_dedup_lookup on transaction(account_id, date, amount);

-- ── Layer 4b: Investment Activity ──

create table investment_activity (
  id              uuid primary key default gen_random_uuid(),
  household_id    uuid not null references household(id),
  account_id      uuid not null references account(id),
  raw_ingest_id   uuid references raw_ingest(id),
  date            date not null,
  activity_type   text not null,  -- buy | sell | dividend | reinvestment | split | transfer_in | transfer_out | fee | interest | return_of_capital
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

-- ── Layer 4c: Holdings (point-in-time snapshots) ──

create table holding (
  id              uuid primary key default gen_random_uuid(),
  household_id    uuid not null references household(id),
  account_id      uuid not null references account(id),
  raw_ingest_id   uuid references raw_ingest(id),
  as_of           date not null,
  symbol          text not null,
  name            text,
  quantity        numeric(16,6) not null,
  price           numeric(14,4),
  market_value    numeric(14,2) not null,
  cost_basis      numeric(14,2),
  currency        text default 'USD',
  asset_class     text,  -- equity | fixed_income | cash | crypto | real_estate | commodity | other
  created_at      timestamptz default now(),
  unique(account_id, as_of, symbol)
);

create index idx_holding_household_date on holding(household_id, as_of desc);
create index idx_holding_symbol on holding(symbol, as_of desc);

-- ── Layer 4d: Balance Snapshots ──

create table balance_snapshot (
  id              uuid primary key default gen_random_uuid(),
  household_id    uuid not null references household(id),
  account_id      uuid not null references account(id),
  raw_ingest_id   uuid references raw_ingest(id),
  date            date not null,
  balance         numeric(14,2) not null,
  available       numeric(14,2),
  source          text not null,  -- provider_sync | csv_derived | manual
  created_at      timestamptz default now(),
  unique(account_id, date, source)
);

create index idx_balance_household_date on balance_snapshot(household_id, date desc);
create index idx_balance_account_date on balance_snapshot(account_id, date desc);

-- ── Layer 5: Derived / Materialized ──

create table net_worth_snapshot (
  id                uuid primary key default gen_random_uuid(),
  household_id      uuid not null references household(id),
  date              date not null,
  total_assets      numeric(14,2) not null,
  total_liabilities numeric(14,2) not null,
  net_worth         numeric(14,2) not null,
  breakdown         jsonb not null default '{}',
  created_at        timestamptz default now(),
  unique(household_id, date)
);

create index idx_nw_household_date on net_worth_snapshot(household_id, date desc);

-- ── RLS ──

alter table household enable row level security;
alter table member enable row level security;
alter table account enable row level security;
alter table account_source enable row level security;
alter table raw_ingest enable row level security;
alter table account_event enable row level security;
alter table transaction enable row level security;
alter table investment_activity enable row level security;
alter table holding enable row level security;
alter table balance_snapshot enable row level security;
alter table net_worth_snapshot enable row level security;

create policy "household_isolation" on household
  for all using (id in (select household_id from member where auth_user_id = auth.uid()));

create policy "household_isolation" on member
  for all using (household_id in (select household_id from member where auth_user_id = auth.uid()));

create policy "household_isolation" on account
  for all using (household_id in (select household_id from member where auth_user_id = auth.uid()));

create policy "household_isolation" on account_source
  for all using (household_id in (select household_id from member where auth_user_id = auth.uid()));

create policy "household_isolation" on raw_ingest
  for all using (household_id in (select household_id from member where auth_user_id = auth.uid()));

create policy "household_isolation" on account_event
  for all using (household_id in (select household_id from member where auth_user_id = auth.uid()));

create policy "household_isolation" on transaction
  for all using (household_id in (select household_id from member where auth_user_id = auth.uid()));

create policy "household_isolation" on investment_activity
  for all using (household_id in (select household_id from member where auth_user_id = auth.uid()));

create policy "household_isolation" on holding
  for all using (household_id in (select household_id from member where auth_user_id = auth.uid()));

create policy "household_isolation" on balance_snapshot
  for all using (household_id in (select household_id from member where auth_user_id = auth.uid()));

create policy "household_isolation" on net_worth_snapshot
  for all using (household_id in (select household_id from member where auth_user_id = auth.uid()));

-- ── Views ──

-- Unified timeline: merges raw_ingest + account_event into a single sortable stream
create or replace view account_timeline as
  select
    id,
    household_id,
    account_id,
    'ingest' as kind,
    source_type as event_type,
    jsonb_build_object(
      'source_ref', source_ref,
      'record_count', record_count,
      'status', status,
      'error', error
    ) as detail,
    triggered_by,
    created_at
  from raw_ingest
union all
  select
    id,
    household_id,
    account_id,
    'event' as kind,
    event_type,
    detail,
    triggered_by,
    created_at
  from account_event;

-- Duplicate candidates: visible transactions sharing (account, date, amount)
create or replace view duplicate_candidates_txn as
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

-- ── Functions ──

-- Check record ownership in a single query (used by duplicate hide/unhide middleware)
create or replace function check_record_ownership(
  p_table text,
  p_record_id uuid,
  p_auth_user_id uuid
)
returns table(household_id uuid, member_id uuid)
language plpgsql security definer as $$
begin
  if p_table = 'transaction' then
    return query
      select t.household_id, m.id as member_id
      from transaction t
      join member m on m.household_id = t.household_id and m.auth_user_id = p_auth_user_id
      where t.id = p_record_id;
  elsif p_table = 'investment_activity' then
    return query
      select ia.household_id, m.id as member_id
      from investment_activity ia
      join member m on m.household_id = ia.household_id and m.auth_user_id = p_auth_user_id
      where ia.id = p_record_id;
  end if;
end;
$$;
