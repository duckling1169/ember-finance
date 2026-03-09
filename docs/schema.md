# FIRE App — Database Schema

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

## Layer 5: Derived / Materialized

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

Unique: (household_id, date). Materialized daily by scheduled job.

## RLS

All tables have RLS enabled with identical policy:

```sql
create policy "household_isolation" on <table>
  for all using (
    household_id in (
      select household_id from member where auth_user_id = auth.uid()
    )
  );
```

`household_invite` additionally allows access for the invited email user.

## RPC Functions

| Function                             | Returns | Purpose                                                               |
| ------------------------------------ | ------- | --------------------------------------------------------------------- |
| `create_household_with_owner(...)`   | jsonb   | Atomic household + owner member creation in single transaction        |
| `check_email_has_household(p_email)` | boolean | Checks if email is already in a household (joins auth.users + member) |
