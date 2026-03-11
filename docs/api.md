# Ember — API Reference

Base URL (local): `http://localhost:3001`

## Authentication

- `GET /health` is public
- All `/api/*` routes require `Authorization: Bearer <supabase_access_token>`
- Auth middleware resolves user and enforces household membership/record ownership where applicable

## Auth and Authorization Middleware

- `requireAuth`: all `/api/*`
- `requireMember`: all `/api/settings/*` (injects `householdId`, `memberId`, `memberRole`)
- `requireHouseholdMember`: household-scoped routes with `:householdId`
- `requireRecordOwnership`: duplicate hide/unhide routes with record IDs

## Health

### `GET /health`

Returns status and DB connectivity signal.

## Onboarding

### `POST /api/onboarding`

Create household + owner member profile. Uses RPC (`create_household_with_owner`) with fallback insert path.

### `POST /api/onboarding/accept-invite`

Accept invite and create member profile in target household.

## Settings

All settings routes require authenticated member context.

### Household

- `GET /api/settings/household`
- `PATCH /api/settings/household` (owner only)

### Profile

- `GET /api/settings/profile`
- `PATCH /api/settings/profile`

### Members

- `GET /api/settings/members`
- `DELETE /api/settings/members/:memberId` (owner only)

### Invites

- `GET /api/settings/invites` (owner only)
- `POST /api/settings/invites` (owner only)
- `DELETE /api/settings/invites/:inviteId` (owner only)

## Accounts

### `GET /api/accounts/:householdId`

List active accounts enriched with latest balance (`latest_account_balances`) and source link/sync metadata.

### `GET /api/accounts/:householdId/:accountId`

Account detail response including:

- account
- latest balance
- balance history (default last 1 year)
- current holdings
- open tax lots
- sources
- account timeline history

### `GET /api/accounts/:householdId/:accountId/holdings`

Current holdings for one account (from `current_positions`).

### `GET /api/accounts/:householdId/:accountId/lots`

Open lots for one account (from `open_tax_lots`).

### `GET /api/accounts/:householdId/:accountId/balances`

Balance snapshots for one account. Optional query params:

- `from=YYYY-MM-DD`
- `to=YYYY-MM-DD`

### `GET /api/accounts/:householdId/:accountId/history`

Timeline events for one account. Optional query params:

- `limit` (default `50`)
- `offset` (default `0`)
- `from=YYYY-MM-DD`
- `to=YYYY-MM-DD`

### `POST /api/accounts/:householdId`

Create account.

### `PATCH /api/accounts/:householdId/:accountId`

Update account fields (allowlist enforced).

### `DELETE /api/accounts/:householdId/:accountId`

Soft-delete account (`is_active = false`) and record `account_event`.

## Holdings

### `GET /api/holdings/:householdId`

Returns cross-account holdings payload:

- `positions` (`current_positions`)
- `summary` (`household_positions_summary`)
- `lots` (`open_tax_lots`)

## Ingest

### `POST /api/ingest/manual/:householdId/:accountId`

Manual ingest expects normalized payload sections:

- `transactions[]`
- `investmentActivity[]`
- `balances[]`
- `holdings[]`

Writes `raw_ingest`, upserts canonical tables, runs dedup, updates `account_source.last_synced`.

### `POST /api/ingest/csv/:householdId/:accountId`

Multipart upload:

- `file` (required)
- `format` (optional, auto-detected if omitted)

Notes:

- max file size `10MB`
- account-scoped source is created if needed
- parsed records flow through same ingest pipeline

### `POST /api/ingest/sync/:householdId/:sourceId`

Provider sync placeholder (currently returns `501`).

## Duplicates

### Listing

- `GET /api/duplicates/transactions/:householdId/:accountId`
- `GET /api/duplicates/activity/:householdId/:accountId`
- `GET /api/duplicates/review/:householdId/:accountId`

### Mutations

- `POST /api/duplicates/hide/transaction/:id`
- `POST /api/duplicates/unhide/transaction/:id`
- `POST /api/duplicates/hide/activity/:id`
- `POST /api/duplicates/unhide/activity/:id`

`hide` endpoints accept optional body `{ "reason": "manual" }`.

## Validation Highlights

- `birthday`: valid past date
- `targetRetirementAge`: positive and cross-validated with birthday
- `taxFilingStatus`: enum-constrained
- `employmentType`: enum-constrained
- `riskTolerance`: enum-constrained
- `state`: 2-char US state code
- `annualIncome`: positive if set
- `account_type`: must be in shared enum
