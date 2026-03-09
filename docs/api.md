# FIRE App — API Reference

Base URL: `http://localhost:3001`

## Authentication

Routes under `/api/onboarding` and `/api/settings` require a Supabase JWT in the `Authorization` header:

```
Authorization: Bearer <supabase_access_token>
```

The middleware extracts the user via `supabase.auth.getUser(token)` and sets `authUser` (id, email) on the request context.

Routes under `/api/accounts`, `/api/sources`, `/api/ingest`, and `/api/duplicates` currently accept a `householdId` path parameter without JWT auth (to be migrated).

---

## Health

### GET /health

Returns DB connection status.

```json
{ "status": "ok", "db": "connected", "timestamp": "2026-03-09T..." }
```

---

## Onboarding

### POST /api/onboarding

Create a new household and owner member profile. Atomic via Postgres RPC.

**Request:**

```json
{
  "householdName": "Smith Family",
  "taxFilingStatus": "married_jointly",
  "state": "CA",
  "currency": "USD",
  "displayName": "Adam",
  "birthday": "1990-05-15",
  "targetRetirementAge": 55,
  "annualIncome": 150000,
  "employmentType": "w2",
  "riskTolerance": "aggressive"
}
```

Required: `householdName`, `displayName`, `birthday`, `targetRetirementAge`.

**Response (201):**

```json
{
  "household": { "id": "...", "name": "Smith Family", ... },
  "member": { "id": "...", "display_name": "Adam", "role": "owner", ... }
}
```

**Errors:** 400 (validation), 409 (user already has a household).

### POST /api/onboarding/accept-invite

Partner accepts an invite and creates their member profile.

**Request:**

```json
{
  "inviteId": "uuid",
  "displayName": "Partner",
  "birthday": "1988-06-15",
  "targetRetirementAge": 50,
  "annualIncome": 90000,
  "employmentType": "1099",
  "riskTolerance": "moderate"
}
```

Required: `inviteId`, `displayName`, `birthday`, `targetRetirementAge`.

**Response (201):**

```json
{ "member": { ... }, "householdId": "uuid" }
```

**Errors:** 400 (validation), 403 (email mismatch), 404 (invite not found/accepted), 409 (already has household), 410 (expired).

---

## Settings

All settings routes require auth. Owner-only routes noted.

### GET /api/settings/household

Returns the authenticated user's household.

### PATCH /api/settings/household _(owner only)_

**Request:** `{ "name?", "taxFilingStatus?", "state?", "currency?" }`

Send `null` for `taxFilingStatus` or `state` to clear them.

### GET /api/settings/profile

Returns the authenticated user's member profile.

### PATCH /api/settings/profile

**Request:** `{ "displayName?", "birthday?", "targetRetirementAge?", "annualIncome?", "employmentType?", "riskTolerance?" }`

Send `null` for optional fields to clear them. Retirement age is cross-validated against birthday.

### GET /api/settings/members

List all members in the household (id, household_id, display_name, role, created_at).

### DELETE /api/settings/members/:memberId _(owner only)_

Remove a member. Cannot remove yourself or the last owner (enforced by DB trigger).

### GET /api/settings/invites _(owner only)_

List pending (non-expired, non-accepted) invites.

### POST /api/settings/invites _(owner only)_

**Request:** `{ "email": "partner@example.com" }`

Role is always `owner`. Checks if email already has a household via `check_email_has_household` RPC. Sends a Supabase Auth magic link to the email.

**Response (201):**

```json
{ "id": "...", "email": "...", "role": "owner", "emailSent": true, ... }
```

If the email fails to send, `emailSent: false` with `emailError`.

**Errors:** 400 (invalid email), 403 (not owner), 409 (email already has household, or pending invite exists).

### DELETE /api/settings/invites/:inviteId _(owner only)_

Cancel a pending invite.

---

## Accounts

### GET /api/accounts/:householdId

List active accounts, ordered by created_at.

### POST /api/accounts/:householdId

**Request:**

```json
{
  "name": "Chase Checking",
  "institution": "Chase",
  "account_type": "checking",
  "member_id": "uuid (optional)",
  "currency": "USD",
  "meta": {}
}
```

`is_liability` is auto-set for credit, loan, mortgage.

**Errors:** 400 (invalid account_type).

### PATCH /api/accounts/:householdId/:accountId

Update account fields. Cannot change `household_id`.

---

## Sources

### GET /api/sources/:householdId/:accountId

List sources for an account (excludes encrypted `provider_meta`).

### POST /api/sources/:householdId/:accountId

**Request:** `{ "provider": "manual", "provider_account_id?": "..." }`

---

## Ingest

### POST /api/ingest/manual/:householdId/:accountId

Submit normalized data. Auto-creates a manual source if none exists.

**Request:**

```json
{
  "transactions": [{ "date": "2025-06-01", "amount": -25.0, "description": "Grocery" }],
  "investmentActivity": [],
  "balances": [{ "date": "2025-06-01", "balance": 1000.0 }],
  "holdings": []
}
```

**Response (201):**

```json
{
  "rawIngestId": "uuid",
  "recordCount": 2,
  "dedup": {
    "transactionsAutoHidden": 0,
    "transactionsPotentialDupes": 0,
    "activityAutoHidden": 0,
    "activityPotentialDupes": 0
  }
}
```

### POST /api/ingest/sync/:householdId/:sourceId

Provider sync — not yet implemented (returns 501).

---

## Duplicates

### GET /api/duplicates/transactions/:householdId/:accountId

List hidden transactions (is_hidden = true).

### GET /api/duplicates/activity/:householdId/:accountId

List hidden investment activity.

### GET /api/duplicates/review/:householdId/:accountId

Potential duplicates flagged for manual review (visible records grouped by date+amount with >1 match).

### POST /api/duplicates/hide/transaction/:id

**Request:** `{ "reason?": "manual" }`

### POST /api/duplicates/unhide/transaction/:id

### POST /api/duplicates/hide/activity/:id

**Request:** `{ "reason?": "manual" }`

### POST /api/duplicates/unhide/activity/:id

---

## Validation Rules

| Field               | Rule                                                                 |
| ------------------- | -------------------------------------------------------------------- |
| birthday            | Must be a valid past date                                            |
| targetRetirementAge | Must be > current age (cross-validated with birthday)                |
| taxFilingStatus     | single \| married_jointly \| married_separately \| head_of_household |
| employmentType      | w2 \| 1099 \| mixed                                                  |
| riskTolerance       | conservative \| moderate \| aggressive                               |
| state               | Valid US state abbreviation (2 chars)                                |
| annualIncome        | Positive number if provided                                          |
| account_type        | Must be in ACCOUNT_TYPES enum                                        |
