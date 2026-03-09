# FIRE App — Data Model & Architecture Design

## Philosophy

This is an **investment-first** personal finance app. Portfolio construction, historical performance, allocation, and eventually Monte Carlo projections are the core. Net worth tracking across all account types (banking, debt, illiquid assets) is important but secondary. The data model reflects this priority.

## Design Principles

- **Investments first.** Investment activity (buys, sells, dividends, splits) is a first-class data type, not a subtype of bank transactions. Holdings, lot tracking, and performance attribution are core to the model.
- **Append-only where possible.** Financial data is immutable history. Raw ingestion is never mutated. Canonical records are written once.
- **Accounts are concepts, sources are pipes.** An account ("my Fidelity 401k") is a single entity that can receive data from multiple sources — live sync, CSV upload, manual entry. The account exists independently of how data gets into it.
- **Normalize once, read many.** Every data source passes through an adapter that emits the same canonical shape. The core app is source-agnostic.
- **Compute lazily, cache aggressively.** Net worth snapshots and rollups are materialized on a schedule or on-ingest, never on page load.
- **Tenant-ready without tenant complexity.** `household_id` is on every table. RLS enforces isolation. Today it's one household; extending is a config change, not a rewrite.
- **Minimize API calls.** Use webhooks over polling. Cache provider responses. Batch operations.

---

## Stack

| Layer | Choice | Notes |
|-------|--------|-------|
| Backend | Hono (TypeScript) | Standalone API server, portable across runtimes (Node/Bun/Deno). Separate from frontend for future iOS portability. |
| Database | Supabase Postgres | RLS on household_id, free tier, pg_cron for scheduled jobs |
| Auth | Supabase Auth | Household members share a tenant |
| Frontend | Next.js / React | Separate from API, communicates over REST or tRPC |
| Bank sync | Teller (free, 100 connections) | Checking, savings, credit cards |
| Brokerage sync | SnapTrade (free, 5 connections) | Holdings, positions, balances, trade history |
| CSV parsing | Papa Parse (TS) | In-process, no external service |
| PDF parsing | TBD — Phase 2 | Likely Python sidecar or LLM extraction |
| Credential encryption | Application-level (libsodium) | Provider tokens encrypted before DB storage |

---

## Account Types & Behaviors

Each account type determines what data is relevant, what UI surfaces it gets, and how it contributes to net worth.

| Type | Primary Data | Net Worth Role | Typical Sources |
|------|-------------|----------------|-----------------|
| `checking` | Transactions, balances | Asset | Teller, CSV, manual |
| `savings` | Transactions, balances | Asset | Teller, CSV, manual |
| `credit` | Transactions, balances | Liability | Teller, CSV, manual |
| `brokerage` | Holdings, investment activity, balances | Asset | SnapTrade, CSV, manual |
| `retirement` | Holdings, investment activity, balances | Asset | SnapTrade, CSV, manual |
| `hsa` | Holdings, investment activity, balances | Asset | SnapTrade, CSV, manual |
| `loan` | Balances (principal remaining) | Liability | Manual, CSV |
| `mortgage` | Balances (principal remaining) | Liability | Manual, CSV |
| `property` | Balances (estimated value) | Asset | Manual |
| `vehicle` | Balances (estimated value) | Asset | Manual |
| `other` | Balances | Asset or Liability | Manual |

**Groupings for net worth rollup:** Cash (checking, savings) · Investments (brokerage, retirement, hsa) · Debt (credit, loan, mortgage) · Illiquid (property, vehicle, other)

---

## Schema

### Layer 1: Identity

```sql
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
```

### Layer 2: Accounts & Sources

An account is the canonical entity. Sources are the pipes that feed data into it. One account can have multiple sources (e.g., SnapTrade for live sync + CSV for historical backfill).

```sql
create table account (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references household(id),
  member_id     uuid references member(id),     -- nullable for joint/household-level

  -- Classification
  name          text not null,                  -- "Fidelity 401k", "Chase Checking"
  institution   text,                           -- "Fidelity", "Chase"
  account_type  text not null,                  -- checking | savings | credit | brokerage | retirement | hsa | loan | mortgage | property | vehicle | other
  currency      text not null default 'USD',

  -- Account-type-specific metadata
  meta          jsonb default '{}',             -- interest_rate, loan_term, etc. Shape varies by type.

  -- State
  is_active     boolean default true,
  is_liability  boolean default false,          -- true for credit, loan, mortgage
  created_at    timestamptz default now()
);

create index idx_account_household on account(household_id);


-- Data sources attached to an account
create table account_source (
  id                  uuid primary key default gen_random_uuid(),
  account_id          uuid not null references account(id),
  household_id        uuid not null references household(id),

  provider            text not null,            -- teller | snaptrade | csv | pdf | manual
  provider_account_id text,                     -- external ID from the provider (null for file/manual)
  provider_meta       bytea,                    -- encrypted: access tokens, enrollment IDs, cursors

  is_active           boolean default true,     -- false if connection broke / was removed
  last_synced         timestamptz,
  created_at          timestamptz default now(),

  unique(account_id, provider, provider_account_id)
);

create index idx_account_source_account on account_source(account_id);
```

**Key decisions:**
- Provider link lives on `account_source`, not `account`. An account can have Teller live sync AND CSV historical imports simultaneously.
- `provider_meta` is `bytea` (encrypted at application level with libsodium) rather than plaintext JSONB. A DB dump doesn't leak credentials.
- `account.meta` (JSONB) holds type-specific fields — interest rate for a mortgage, nothing for a checking account. Avoids nullable columns.
- `last_synced` is on `account_source` since each source syncs independently.

### Layer 3: Raw Ingestion (Immutable)

```sql
create table raw_ingest (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references household(id),
  account_id    uuid references account(id),
  source_id     uuid references account_source(id),

  source_type   text not null,                  -- teller_webhook | snaptrade_sync | csv_upload | pdf_parse | manual_entry
  source_ref    text,                           -- webhook ID, filename, etc
  payload       jsonb not null,                 -- raw data exactly as received
  record_count  int,

  status        text not null default 'pending', -- pending | processed | failed | skipped
  error         text,
  processed_at  timestamptz,
  created_at    timestamptz default now()
);

create index idx_raw_ingest_status on raw_ingest(status) where status = 'pending';
create index idx_raw_ingest_account on raw_ingest(account_id);
```

Immutable audit trail. Enables reprocessing without provider API calls.

### Layer 4: Canonical Data

#### 4a. Cash Transactions (banking accounts)

```sql
create table transaction (
  id              uuid primary key default gen_random_uuid(),
  household_id    uuid not null references household(id),
  account_id      uuid not null references account(id),
  raw_ingest_id   uuid references raw_ingest(id),

  date            date not null,
  amount          numeric(14,2) not null,       -- positive = inflow, negative = outflow
  description     text not null,
  category        text,                         -- simple flat text, no enforced taxonomy
  is_transfer     boolean default false,        -- internal transfers excluded from spending calcs

  -- Dedup
  provider_txn_id text,                         -- from live providers
  fingerprint     text,                         -- hash(account_id, date, amount, description) for file imports

  created_at      timestamptz default now(),

  unique(account_id, provider_txn_id),
  unique(account_id, fingerprint)
);

create index idx_txn_household_date on transaction(household_id, date desc);
create index idx_txn_account_date on transaction(account_id, date desc);
```

#### 4b. Investment Activity (brokerage/retirement/hsa accounts)

```sql
create table investment_activity (
  id              uuid primary key default gen_random_uuid(),
  household_id    uuid not null references household(id),
  account_id      uuid not null references account(id),
  raw_ingest_id   uuid references raw_ingest(id),

  date            date not null,
  activity_type   text not null,                -- buy | sell | dividend | reinvestment | split | transfer_in | transfer_out | fee | interest | return_of_capital
  symbol          text,                         -- AAPL, VTI, etc. Null for account-level fees/interest.
  description     text,

  quantity        numeric(16,6),                -- shares/units. Null for dividends received as cash.
  price           numeric(14,4),                -- price per unit at execution
  amount          numeric(14,2) not null,       -- total dollar amount (positive = into account, negative = out)
  commission      numeric(10,2) default 0,
  currency        text default 'USD',

  -- Lot tracking (optional, for cost basis / tax-loss harvesting)
  lot_id          text,                         -- provider-assigned lot ID if available

  -- Dedup
  provider_txn_id text,
  fingerprint     text,

  created_at      timestamptz default now(),

  unique(account_id, provider_txn_id),
  unique(account_id, fingerprint)
);

create index idx_inv_activity_household_date on investment_activity(household_id, date desc);
create index idx_inv_activity_account_symbol on investment_activity(account_id, symbol, date desc);
create index idx_inv_activity_type on investment_activity(activity_type);
```

**Why separate from `transaction`?** Investment activity has fundamentally different fields (symbol, quantity, price, lot_id, activity_type) and different query patterns (performance by symbol, dividend history, cost basis per lot). Separate tables, clean queries, clear intent.

#### 4c. Holdings (point-in-time snapshots)

```sql
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
  asset_class     text,                         -- equity | fixed_income | cash | crypto | real_estate | commodity | other

  created_at      timestamptz default now(),

  unique(account_id, as_of, symbol)
);

create index idx_holding_household_date on holding(household_id, as_of desc);
create index idx_holding_symbol on holding(symbol, as_of desc);
```

Holdings are snapshots from providers, not derived from investment_activity. Provider snapshots are ground truth. Activity explains *how* you got there.

#### 4d. Balance Snapshots

```sql
create table balance_snapshot (
  id              uuid primary key default gen_random_uuid(),
  household_id    uuid not null references household(id),
  account_id      uuid not null references account(id),
  raw_ingest_id   uuid references raw_ingest(id),

  date            date not null,
  balance         numeric(14,2) not null,       -- for investment accounts, total market value
  available       numeric(14,2),

  source          text not null,                -- provider_sync | csv_derived | manual
  created_at      timestamptz default now(),

  unique(account_id, date, source)
);

create index idx_balance_household_date on balance_snapshot(household_id, date desc);
```

Provider balances are always authoritative when available. For historical dates before a provider was linked, CSV-derived or manual balances fill the gap.

### Layer 5: Derived / Materialized

```sql
create table net_worth_snapshot (
  id              uuid primary key default gen_random_uuid(),
  household_id    uuid not null references household(id),
  date            date not null,

  total_assets    numeric(14,2) not null,
  total_liabilities numeric(14,2) not null,
  net_worth       numeric(14,2) not null,

  -- Breakdown by group for stacked area chart
  breakdown       jsonb not null default '{}',
  -- e.g. { "cash": 25000, "investments": 230000, "debt": -3000, "illiquid": 350000 }

  created_at      timestamptz default now(),

  unique(household_id, date)
);

create index idx_nw_household_date on net_worth_snapshot(household_id, date desc);
```

Materialized daily by a scheduled job. Dashboard reads this single table.

---

## Adapter Interface

```typescript
interface IngestResult {
  transactions: NormalizedTransaction[];
  investmentActivity: NormalizedInvestmentActivity[];
  balances: NormalizedBalance[];
  holdings: NormalizedHolding[];
}

interface ProviderAdapter {
  sync(account: Account, source: AccountSource): Promise<IngestResult>;
  parse?(file: Buffer, format: string): Promise<IngestResult>;
  handleWebhook?(payload: unknown): Promise<IngestResult>;
}

// --- Normalized shapes ---

interface NormalizedTransaction {
  providerTxnId?: string;
  date: string;
  amount: number;
  description: string;
  category?: string;
  isTransfer?: boolean;
}

interface NormalizedInvestmentActivity {
  providerTxnId?: string;
  date: string;
  activityType: 'buy' | 'sell' | 'dividend' | 'reinvestment' | 'split'
    | 'transfer_in' | 'transfer_out' | 'fee' | 'interest' | 'return_of_capital';
  symbol?: string;
  description?: string;
  quantity?: number;
  price?: number;
  amount: number;
  commission?: number;
  lotId?: string;
}

interface NormalizedBalance {
  date: string;
  balance: number;
  available?: number;
}

interface NormalizedHolding {
  asOf: string;
  symbol: string;
  name?: string;
  quantity: number;
  price?: number;
  marketValue: number;
  costBasis?: number;
  assetClass?: string;
}
```

### Ingest Pipeline

```
Source (webhook / sync / file upload / manual entry)
  → Adapter.sync() or Adapter.parse() or Adapter.handleWebhook()
  → Write raw payload to raw_ingest (immutable)
  → Normalize into IngestResult
  → UPSERT into canonical tables (dedup via unique constraints)
  → If balances changed → refresh net_worth_snapshot for affected dates
```

Same codepath for every source. One pipeline, one set of tests.

---

## Account Linking Flow

1. User creates an **account** — gives it a name, picks a type, optionally assigns to a household member.
2. User attaches **sources** to the account:
   - "Link via Teller" → OAuth flow → creates `account_source` with `provider = 'teller'`
   - "Link via SnapTrade" → connection portal → creates `account_source` with `provider = 'snaptrade'`
   - "Upload CSV" → file upload → creates `account_source` with `provider = 'csv'`, processes immediately
   - "Enter manually" → form → creates `account_source` with `provider = 'manual'`
3. Each source writes to `raw_ingest` → canonical tables under the same `account_id`.
4. Multiple sources for the same account coexist. Dedup handles overlap.

**Overlap handling:** When a live provider and a CSV import cover the same date range, duplicates are prevented by unique constraints on `provider_txn_id` (live) and `fingerprint` (file). Near-matches (same transaction, slightly different description from different sources) are accepted as separate records — minor duplication is preferable to data loss for a personal tool.

---

## Pipeline Cost Analysis

| Operation | Trigger | Cost |
|-----------|---------|------|
| Teller balance/txn sync | Webhook (push) | Free — no polling |
| SnapTrade holdings sync | Webhook or daily pull | Free tier, 5 connections |
| CSV import | User upload | Zero — local parsing |
| Net worth snapshot | pg_cron daily | ~1 DB write per day |
| Dashboard load | User visit | Single table read |
| Historical reprocessing | Manual trigger | Reads raw_ingest only — no provider API calls |

---

## RLS Policy

```sql
alter table account enable row level security;

create policy "household_isolation" on account
  for all using (
    household_id in (
      select household_id from member where auth_user_id = auth.uid()
    )
  );

-- Apply identical policy to:
-- account_source, raw_ingest, transaction, investment_activity,
-- holding, balance_snapshot, net_worth_snapshot
```

---

## Resolved Decisions

| Decision | Answer |
|----------|--------|
| App focus | Investment-first. Portfolio construction, performance, allocation are primary. Net worth is secondary. |
| Application-level credential encryption | Yes — libsodium, `provider_meta` stored as `bytea` |
| Category taxonomy | Simple flat text, no enforced schema |
| Balance reconciliation | Provider balance is always authoritative. Transactions explain movement only. |
| Multi-source accounts | Yes — `account_source` table, one account can have many sources |
| Investment vs cash transactions | Separate tables (`transaction` vs `investment_activity`) |
| Holdings derivation | Snapshots from providers are ground truth, not derived from activity |
| Dedup strategy | Provider IDs for live sync, content fingerprint for file imports, DB-level unique constraints |
| Multi-user model | Single household now, `household_id` everywhere for clean extension later |
