# Ember — Architecture

## Product Framing

Ember is a household investment manager and planning platform for the FIRE community.

The architecture is designed to support two primary planning feature sets:

- Accumulation planning
- Drawdown/spending planning

Both feature sets require the same foundation: trustworthy, auditable household investment data.

## System Model

Ember is split into three layers:

1. Frontend app (`src/`) for user workflows and visualization
2. Backend API (`api/`) for auth-scoped business logic and ingest orchestration
3. Supabase (`supabase/`) for storage, auth, RLS, views, and DB functions

The frontend and API run as separate services:

- Frontend: Next.js on port `3000`
- API: Hono on port `3001`

## Core Architecture Principles

- **Household-first tenancy.** `household_id` scopes all private financial records.
- **Accounts are durable entities.** Data sources can change without redefining an account.
- **Ingestion is append-only.** Every payload is written to `raw_ingest` before normalization.
- **Canonical schema over source variance.** Adapters map all inputs to common record shapes.
- **Portfolio + tax-lot depth is first-class.** Holdings, prices, and lots are modeled directly.
- **Planning quality depends on data trust.** Auditability and dedup are mandatory, not optional.

## Stack

| Layer            | Implementation                         |
| ---------------- | -------------------------------------- |
| Frontend         | Next.js 16, React 19, Tailwind 4, SWR  |
| API              | Hono (TypeScript)                      |
| Database/Auth    | Supabase Postgres + Supabase Auth      |
| Shared contracts | `shared/types`                         |
| CSV ingest       | Papa Parse adapter in API              |
| Charts           | Nivo (`@nivo/line`, `@nivo/pie`) in UI |
| Encryption       | AES-256-GCM for provider credentials   |

## Current Capability Boundary (March 2026)

Implemented:

- Onboarding and household/member/invite lifecycle
- Accounts + sources model
- Manual and CSV ingest routes
- Dedup and duplicate-review routes
- Holdings/tax-lot-backed account and household portfolio views
- Frontend pages: dashboard, accounts, account detail, holdings, settings

Not yet implemented end-to-end:

- Live provider sync execution (`POST /api/ingest/sync/:householdId/:sourceId` returns `501`)
- Provider link/disconnect workflows in UI
- Full production dashboard history pipeline (some time-series remain mock-backed)
- Drawdown-specific modeling engines and workflows

## Data Ownership Model

- **Household**: top-level tenant
- **Member**: auth user within a household
- **Role**: `owner` or `viewer` (invite flow currently creates `owner`)
- **Isolation**: RLS policies enforce household scoping
- **Constraint**: one household per auth user

## Repository Structure

```text
ember-finance/
├── src/                    # Next.js frontend
├── api/                    # Hono API server
├── shared/types/           # Shared TypeScript contracts
├── supabase/migrations/    # Postgres schema and view/function evolution
└── docs/                   # Product + technical docs
```
