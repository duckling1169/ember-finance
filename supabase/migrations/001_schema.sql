-- FIRE App schema — consolidated
-- All tables, indexes, and RLS policies

-- ── Layer 1: Identity ──

create table household (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  created_at    timestamptz default now()
);

create table member (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references household(id),
  auth_user_id  uuid unique references auth.users(id),
  display_name  text not null,
  role          text not null default 'owner',  -- owner | viewer
  created_at    timestamptz default now()
);

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

create index idx_account_household on account(household_id);

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

-- ── Layer 3: Raw Ingestion (Immutable) ──

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
  processed_at  timestamptz,
  created_at    timestamptz default now()
);

create index idx_raw_ingest_status on raw_ingest(status) where status = 'pending';
create index idx_raw_ingest_account on raw_ingest(account_id);

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
