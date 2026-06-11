# Ember — Database Schema (Current)

Source of truth: `supabase/migrations/*.sql`.
This doc is an implementation summary of the current schema.

## Identity and Household

### `household`

- tenant root (`id`, `name`, `tax_filing_status`, `currency`)

### `member`

- household membership and profile fields
- role: `owner | viewer`
- planning fields: `state` (of residence), `tax_mode`, `effective_tax_rate_override` (0–1 decimal)
- constraint: one household per auth user (`auth_user_id` unique + trigger)

### `household_invite`

- pending invites with `expires_at`, `accepted_at`, and invited email

## Accounts and Sources

### `account`

- canonical account entity (`checking`, `savings`, `credit`, `brokerage`, `retirement`, `hsa`, `loan`, `mortgage`, `other`)
- `meta` JSON for extensible account attributes
- `is_active` for soft deactivation
- `include_in_fi_portfolio` for FI portfolio tracking
- `tax_treatment` (`pre_tax`, `after_tax`, `tax_free`, `none`)

### `account_source`

- ingestion/source pipes attached to account (`teller`, `snaptrade`, `csv`, `manual`)
- tracks `last_synced`

## Ingest and Event Timeline

### `raw_ingest`

- immutable ingest audit log with original payload
- status lifecycle: `pending | processed | failed | skipped`
- links to account/source/member trigger context

### `account_event`

- non-ingest lifecycle events (`account_created`, `account_updated`, `account_deactivated`, etc.)

### `account_timeline` (view)

- union of `raw_ingest` + `account_event` into one sortable event stream

## Canonical Financial Records

### `transaction`

- cash account activity
- duplicate controls (`provider_txn_id`, `fingerprint`, `is_hidden`, `hidden_reason`)

### `investment_activity`

- trade/dividend/fee/split/transfer records
- duplicate controls mirroring `transaction`

### `holding`

- point-in-time holding snapshots per account/symbol/date

### `balance_snapshot`

- account balance points with source marker (`provider_sync`, `csv_derived`, `manual`)

## Pricing and Tax Lots

### `security_price`

- global market price cache (no household scoping, no RLS)

### `tax_lot`

- per-account lot inventory with remaining quantity and cost basis

### `lot_disposition`

- sell-to-lot consumption mapping with gain/loss and short/long-term classification

## Planning

### `income_source`

- per-member income streams (`employment`, `self_employment`, `passive`, `other`)
- `gross_amount` with `frequency`

### `cashflow_item`

- income/expense entries with routing (`source_account_id`, `destination_account_id`)
- direction: `inflow | outflow`
- bucket: `savings | employer_match | expense`
- linked to `income_source` and accounts

### `planning_scenario`

- household-level scenarios with `assumptions` JSONB

### `expense_category`

- household lookup table for categorizing expenses

## Portfolio and Analytics Views

### `latest_account_balances`

- latest balance row per account

### `current_positions`

- latest holding per account/symbol joined with live price and unrealized metrics

### `household_positions_summary`

- household aggregate by symbol across accounts

### `open_tax_lots`

- open lots with live valuation and holding-period classification

### `duplicate_candidates_txn`

- visible transactions with duplicate `(account_id, date, amount)` signatures

## Functions

### `create_household_with_owner(...)`

- atomic onboarding RPC (household + member)

### `check_email_has_household(...)`

- helper for invite checks

### `check_record_ownership(...)`

- validates ownership for hide/unhide duplicate mutations

## RLS

- Enabled on all household-scoped private tables
- Policy model: household membership via `member.auth_user_id = auth.uid()`
- `security_price` intentionally has no RLS (public market data)
