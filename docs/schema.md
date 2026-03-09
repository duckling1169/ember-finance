# Ember — Database Schema

> Source of truth: `supabase/migrations/001_schema.sql` and `002_onboarding.sql`.
> This doc summarizes the schema with annotations. If it diverges from the migrations, the migrations win.

## Layer 1: Identity

### household

| Column            | Type          | Notes                                                                |
| ----------------- | ------------- | -------------------------------------------------------------------- |
| id                | uuid PK       | `gen_random_uuid()`                                                  |
| name              | text NOT NULL | e.g. "Smith Family"                                                  |
| tax_filing_status | text          | single \| married_jointly \| married_separately \| head_of_household |
| state             | text          | US state abbreviation (2 chars)                                      |
| currency          | text NOT NULL | Default 'USD'                                                        |
| created_at        | timestamptz   |                                                                      |

Check constraints: `chk_household_tax_filing_status`, `chk_household_state` (length = 2).

### member

| Column                | Type                        | Notes                                        |
| --------------------- | --------------------------- | -------------------------------------------- |
| id                    | uuid PK                     |                                              |
| household_id          | uuid FK → household         |                                              |
| auth_user_id          | uuid UNIQUE FK → auth.users | One household per auth user                  |
| display_name          | text NOT NULL               |                                              |
| role                  | text NOT NULL               | 'owner' \| 'viewer' (default 'owner')        |
| birthday              | date                        | Must be past date                            |
| target_retirement_age | int                         | Must be > 0 (and > current age at API level) |
| annual_income         | numeric(14,2)               | Must be > 0 if set                           |
| employment_type       | text                        | w2 \| 1099 \| mixed                          |
| risk_tolerance        | text                        | conservative \| moderate \| aggressive       |
| created_at            | timestamptz                 |                                              |

Check constraints on birthday, retirement_age, income, employment_type, risk_tolerance.

**Triggers:**

- `trg_prevent_multi_household` — blocks insert if auth_user_id already belongs to another household.
- `trg_prevent_last_owner_removal` — blocks delete if member is the last owner.

### household_invite

| Column       | Type                | Notes                    |
| ------------ | ------------------- | ------------------------ |
| id           | uuid PK             |                          |
| household_id | uuid FK → household |                          |
| email        | text NOT NULL       | Lowercase, trimmed       |
| invited_by   | uuid FK → member    |                          |
| role         | text NOT NULL       | Always 'owner' per spec  |
| expires_at   | timestamptz         | Default now() + 24 hours |
| accepted_at  | timestamptz         | NULL until accepted      |
| created_at   | timestamptz         |                          |

Indexes: household_id, email. RLS: visible to household members OR the invited email user.

## Layer 2: Accounts & Sources

### account

| Column       | Type                | Notes                                                                                                               |
| ------------ | ------------------- | ------------------------------------------------------------------------------------------------------------------- |
| id           | uuid PK             |                                                                                                                     |
| household_id | uuid FK → household | Indexed                                                                                                             |
| member_id    | uuid FK → member    | Nullable (joint/household-level)                                                                                    |
| name         | text NOT NULL       | "Fidelity 401k", "Chase Checking"                                                                                   |
| institution  | text                | "Fidelity", "Chase"                                                                                                 |
| account_type | text NOT NULL       | checking \| savings \| credit \| brokerage \| retirement \| hsa \| loan \| mortgage \| property \| vehicle \| other |
| currency     | text NOT NULL       | Default 'USD'                                                                                                       |
| meta         | jsonb               | Type-specific fields (interest_rate, loan_term, etc.)                                                               |
| is_active    | boolean             | Default true                                                                                                        |
| is_liability | boolean             | Auto-set for credit, loan, mortgage                                                                                 |
| created_at   | timestamptz         |                                                                                                                     |

**Type groupings:**

- Cash: checking, savings
- Investments: brokerage, retirement, hsa
- Debt: credit, loan, mortgage
- Illiquid: property, vehicle, other

### account_source

| Column              | Type                | Notes                                       |
| ------------------- | ------------------- | ------------------------------------------- |
| id                  | uuid PK             |                                             |
| account_id          | uuid FK → account   | Indexed                                     |
| household_id        | uuid FK → household |                                             |
| provider            | text NOT NULL       | teller \| snaptrade \| csv \| pdf \| manual |
| provider_account_id | text                | External ID from provider                   |
| provider_meta       | bytea               | AES-256-GCM encrypted credentials           |
| is_active           | boolean             | Default true                                |
| last_synced         | timestamptz         | Updated after each ingest                   |
| created_at          | timestamptz         |                                             |

Unique: (account_id, provider, provider_account_id).

## Layer 3: Raw Ingestion (Immutable)

### raw_ingest

| Column       | Type                     | Notes                                                                    |
| ------------ | ------------------------ | ------------------------------------------------------------------------ |
| id           | uuid PK                  |                                                                          |
| household_id | uuid FK                  |                                                                          |
| account_id   | uuid FK                  |                                                                          |
| source_id    | uuid FK → account_source |                                                                          |
| source_type  | text NOT NULL            | teller_sync \| snaptrade_sync \| csv_upload \| pdf_parse \| manual_entry |
| source_ref   | text                     | Webhook ID, filename, etc.                                               |
| payload      | jsonb NOT NULL           | Raw data exactly as received                                             |
| record_count | int                      |                                                                          |
| status       | text NOT NULL            | pending \| processed \| failed \| skipped                                |
| error        | text                     |                                                                          |
| processed_at | timestamptz              |                                                                          |
| created_at   | timestamptz              |                                                                          |

Append-only audit trail. Enables reprocessing without provider API calls.

## Layer 4: Canonical Data

### transaction (cash accounts)

| Column          | Type                   | Notes                                                        |
| --------------- | ---------------------- | ------------------------------------------------------------ |
| id              | uuid PK                |                                                              |
| household_id    | uuid FK                |                                                              |
| account_id      | uuid FK                |                                                              |
| raw_ingest_id   | uuid FK                |                                                              |
| date            | date NOT NULL          |                                                              |
| amount          | numeric(14,2) NOT NULL | Positive = inflow, negative = outflow                        |
| description     | text NOT NULL          |                                                              |
| category        | text                   | Flat text, no enforced taxonomy                              |
| is_transfer     | boolean                | Excluded from spending calcs                                 |
| provider_txn_id | text                   | From live providers                                          |
| fingerprint     | text                   | SHA-256 hash for file imports                                |
| is_hidden       | boolean NOT NULL       | Default false                                                |
| hidden_reason   | text                   | auto:cross_source_duplicate \| auto:near_duplicate \| manual |
| created_at      | timestamptz            |                                                              |

Unique: (account_id, provider_txn_id), (account_id, fingerprint).

### investment_activity (brokerage/retirement/hsa)

| Column          | Type                   | Notes                                                                                                                   |
| --------------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| id              | uuid PK                |                                                                                                                         |
| household_id    | uuid FK                |                                                                                                                         |
| account_id      | uuid FK                |                                                                                                                         |
| raw_ingest_id   | uuid FK                |                                                                                                                         |
| date            | date NOT NULL          |                                                                                                                         |
| activity_type   | text NOT NULL          | buy \| sell \| dividend \| reinvestment \| split \| transfer_in \| transfer_out \| fee \| interest \| return_of_capital |
| symbol          | text                   | Null for account-level fees/interest                                                                                    |
| description     | text                   |                                                                                                                         |
| quantity        | numeric(16,6)          |                                                                                                                         |
| price           | numeric(14,4)          | Per unit at execution                                                                                                   |
| amount          | numeric(14,2) NOT NULL | Positive = into account                                                                                                 |
| commission      | numeric(10,2)          | Default 0                                                                                                               |
| currency        | text                   | Default 'USD'                                                                                                           |
| lot_id          | text                   | Provider-assigned, for cost basis                                                                                       |
| provider_txn_id | text                   |                                                                                                                         |
| fingerprint     | text                   |                                                                                                                         |
| is_hidden       | boolean NOT NULL       | Default false                                                                                                           |
| hidden_reason   | text                   |                                                                                                                         |
| created_at      | timestamptz            |                                                                                                                         |

Unique: (account_id, provider_txn_id), (account_id, fingerprint).

### holding (point-in-time snapshots)

| Column        | Type                   | Notes                                                                         |
| ------------- | ---------------------- | ----------------------------------------------------------------------------- |
| id            | uuid PK                |                                                                               |
| household_id  | uuid FK                |                                                                               |
| account_id    | uuid FK                |                                                                               |
| raw_ingest_id | uuid FK                |                                                                               |
| as_of         | date NOT NULL          |                                                                               |
| symbol        | text NOT NULL          |                                                                               |
| name          | text                   |                                                                               |
| quantity      | numeric(16,6) NOT NULL |                                                                               |
| price         | numeric(14,4)          |                                                                               |
| market_value  | numeric(14,2) NOT NULL |                                                                               |
| cost_basis    | numeric(14,2)          |                                                                               |
| currency      | text                   | Default 'USD'                                                                 |
| asset_class   | text                   | equity \| fixed_income \| cash \| crypto \| real_estate \| commodity \| other |
| created_at    | timestamptz            |                                                                               |

Unique: (account_id, as_of, symbol). Holdings are snapshots from providers, not derived from activity.

### balance_snapshot

| Column        | Type                   | Notes                                  |
| ------------- | ---------------------- | -------------------------------------- |
| id            | uuid PK                |                                        |
| household_id  | uuid FK                |                                        |
| account_id    | uuid FK                |                                        |
| raw_ingest_id | uuid FK                |                                        |
| date          | date NOT NULL          |                                        |
| balance       | numeric(14,2) NOT NULL |                                        |
| available     | numeric(14,2)          |                                        |
| source        | text NOT NULL          | provider_sync \| csv_derived \| manual |
| created_at    | timestamptz            |                                        |

Unique: (account_id, date, source). Provider balances are authoritative.

## Layer 5: Pricing & Tax Lots

### security_price

| Column         | Type                   | Notes                                   |
| -------------- | ---------------------- | --------------------------------------- |
| symbol         | text PK                | Ticker symbol (e.g. AAPL, VTI)          |
| name           | text                   | Security name                           |
| price          | numeric(14,4) NOT NULL | Current/latest price                    |
| prev_close     | numeric(14,4)          | Previous closing price                  |
| day_change_pct | numeric(8,4)           | Daily percentage change                 |
| currency       | text NOT NULL          | Default 'USD'                           |
| source         | text NOT NULL          | yahoo \| polygon \| snaptrade \| manual |
| updated_at     | timestamptz            |                                         |
| created_at     | timestamptz            |                                         |

Global table — no `household_id`, no RLS. Prices are public market data. Backend writes via service role.

### tax_lot

| Column               | Type                          | Notes                                      |
| -------------------- | ----------------------------- | ------------------------------------------ |
| id                   | uuid PK                       |                                            |
| household_id         | uuid FK → household           |                                            |
| account_id           | uuid FK → account             |                                            |
| symbol               | text NOT NULL                 |                                            |
| acquired_date        | date NOT NULL                 | For short/long-term determination          |
| quantity             | numeric(16,6) NOT NULL        | Remaining (undepleted) shares              |
| original_quantity    | numeric(16,6) NOT NULL        | Shares at acquisition                      |
| cost_basis_per_share | numeric(14,4) NOT NULL        |                                            |
| cost_basis_total     | numeric(14,2) NOT NULL        | original_quantity × cost_basis_per_share   |
| source               | text NOT NULL                 | provider_lot \| computed_fifo \| manual    |
| provider_lot_id      | text                          | Maps to investment_activity.lot_id         |
| origin_activity_id   | uuid FK → investment_activity | The buy/reinvestment that created this lot |
| is_closed            | boolean NOT NULL              | Default false                              |
| closed_date          | date                          | Must be set when is_closed = true          |
| realized_gain_loss   | numeric(14,2)                 | Populated when fully closed                |
| wash_sale_adjustment | numeric(14,2)                 | Added to basis if wash sale                |
| created_at           | timestamptz                   |                                            |
| updated_at           | timestamptz                   |                                            |

Check constraints: source enum, quantity ≥ 0, original_quantity > 0, closed consistency.

Indexes: (account_id, symbol), household_id, open lots partial index, provider_lot_id partial index.

### lot_disposition

| Column           | Type                          | Notes                                   |
| ---------------- | ----------------------------- | --------------------------------------- |
| id               | uuid PK                       |                                         |
| household_id     | uuid FK → household           |                                         |
| tax_lot_id       | uuid FK → tax_lot             |                                         |
| sell_activity_id | uuid FK → investment_activity | The sell that consumed shares           |
| quantity         | numeric(16,6) NOT NULL        | Shares consumed from this lot           |
| proceeds         | numeric(14,2) NOT NULL        | Portion of sell proceeds for this slice |
| cost_basis       | numeric(14,2) NOT NULL        | Cost basis for consumed shares          |
| gain_loss        | numeric(14,2) NOT NULL        | proceeds - cost_basis                   |
| is_short_term    | boolean NOT NULL              | Acquired to sell date < 1 year          |
| created_at       | timestamptz                   |                                         |

Unique: (tax_lot_id, sell_activity_id). A sell can consume multiple lots; a lot can be consumed by multiple sells.

## Layer 6: Derived / Materialized

### net_worth_snapshot

| Column            | Type                   | Notes                                   |
| ----------------- | ---------------------- | --------------------------------------- |
| id                | uuid PK                |                                         |
| household_id      | uuid FK                |                                         |
| date              | date NOT NULL          |                                         |
| total_assets      | numeric(14,2) NOT NULL |                                         |
| total_liabilities | numeric(14,2) NOT NULL |                                         |
| net_worth         | numeric(14,2) NOT NULL |                                         |
| breakdown         | jsonb NOT NULL         | `{ cash, investments, debt, illiquid }` |
| created_at        | timestamptz            |                                         |

Unique: (household_id, date). Investments valued via holdings × security_price.

## Views

### current_positions

Latest holding per (account, symbol) joined with `security_price`. Computes `live_market_value`, `unrealized_gain_loss`, and `unrealized_gain_loss_pct`. Falls back to snapshot price when no live price exists.

### household_positions_summary

Aggregates `current_positions` across all accounts by symbol for a household-level view. Includes total quantity, total market value, total cost basis, and total unrealized gain/loss.

### open_tax_lots

Open (unclosed) tax lots joined with `security_price`. Computes `live_market_value`, `unrealized_gain_loss`, and `holding_period` (short_term/long_term based on days held).

## RLS

All tables with `household_id` have RLS enabled with identical policy:

```sql
create policy "household_isolation" on <table>
  for all using (
    household_id in (
      select household_id from member where auth_user_id = auth.uid()
    )
  );
```

`household_invite` additionally allows access for the invited email user.

`security_price` has no RLS — it's public market data.

## RPC Functions

| Function                             | Returns | Purpose                                                               |
| ------------------------------------ | ------- | --------------------------------------------------------------------- |
| `create_household_with_owner(...)`   | jsonb   | Atomic household + owner member creation in single transaction        |
| `check_email_has_household(p_email)` | boolean | Checks if email is already in a household (joins auth.users + member) |
| `compute_net_worth_snapshot(...)`    | uuid    | Computes and upserts net worth using holdings × security_price        |
