# FIRE App — Architecture

## Philosophy

Investment-first personal finance app. Portfolio construction, historical performance, allocation, and Monte Carlo projections are the core. Net worth tracking across all account types (banking, debt, illiquid assets) is important but secondary.

## Design Principles

- **Investments first.** Investment activity (buys, sells, dividends, splits) is a first-class data type, not a subtype of bank transactions.
- **Append-only where possible.** Raw ingestion is never mutated. Canonical records are written once.
- **Accounts are concepts, sources are pipes.** An account ("my Fidelity 401k") is a single entity that can receive data from multiple sources. The account exists independently of how data gets into it.
- **Normalize once, read many.** Every data source passes through an adapter that emits the same canonical shape. The core app is source-agnostic.
- **Compute lazily, cache aggressively.** Net worth snapshots are materialized on a schedule or on-ingest, never on page load.
- **Tenant-ready without tenant complexity.** `household_id` is on every table. RLS enforces isolation.
- **Minimize API calls.** Use webhooks over polling. Cache provider responses. Batch operations.

## Stack

| Layer                 | Choice                             | Notes                                            |
| --------------------- | ---------------------------------- | ------------------------------------------------ |
| Frontend              | Next.js 16 / React 19 / Tailwind 4 | Separate from API                                |
| Backend API           | Hono (TypeScript)                  | Standalone server, portable across Node/Bun/Deno |
| Database              | Supabase Postgres                  | RLS on household_id, pg_cron for scheduled jobs  |
| Auth                  | Supabase Auth                      | Email/password, OAuth, magic links for invites   |
| Bank sync             | Teller                             | Checking, savings, credit cards (mTLS cert)      |
| Brokerage sync        | SnapTrade                          | Holdings, positions, balances, trade history     |
| CSV parsing           | Papa Parse                         | In-process, institution-specific adapters        |
| PDF parsing           | TBD — Phase 2                      | Likely Python sidecar or LLM extraction          |
| Credential encryption | AES-256-GCM                        | Provider tokens encrypted before DB storage      |

## Project Structure

```
FIreApp/
├── api/                        # Hono backend API
│   ├── src/
│   │   ├── index.ts            # App setup, middleware, route registration
│   │   ├── middleware/auth.ts   # JWT auth (Supabase Bearer token)
│   │   ├── routes/             # HTTP route handlers
│   │   ├── services/           # Business logic (ingest pipeline, dedup)
│   │   ├── adapters/           # Provider-specific data adapters
│   │   ├── lib/                # Utilities (supabase, crypto, env, validation)
│   │   └── types/index.ts      # API type definitions
│   └── tests/
│       ├── unit/               # Adapter, crypto, fingerprint, validation tests
│       └── integration/        # Full pipeline & route tests
├── src/                        # Next.js frontend (in progress)
│   └── app/
├── shared/
│   └── types/index.ts          # Types shared between frontend & API
├── supabase/
│   ├── config.toml
│   └── migrations/             # Schema migrations (001_schema, 002_onboarding)
├── docs/                       # This documentation
├── .env.local                  # Secrets (gitignored)
├── certificate.pem             # Teller mTLS cert (gitignored)
└── private_key.pem             # Teller mTLS key (gitignored)
```

## Multi-User Model

- **Household** — top-level tenant. All financial data belongs to a household.
- **Member** — a user within a household. Linked to Supabase Auth via `auth_user_id`.
- **Roles** — `owner` (full access, can invite/remove) or `viewer` (read-only).
- **Isolation** — RLS on every table uses `household_id IN (SELECT household_id FROM member WHERE auth_user_id = auth.uid())`.
- **Constraint** — one household per auth user, enforced by unique constraint + DB trigger.

## Cost Model

| Operation               | Trigger               | Cost                                          |
| ----------------------- | --------------------- | --------------------------------------------- |
| Teller balance/txn sync | Webhook (push)        | Free — no polling                             |
| SnapTrade holdings sync | Webhook or daily pull | Free tier, 5 connections                      |
| CSV import              | User upload           | Zero — local parsing                          |
| Net worth snapshot      | pg_cron daily         | ~1 DB write per day                           |
| Dashboard load          | User visit            | Single table read                             |
| Historical reprocessing | Manual trigger        | Reads raw_ingest only — no provider API calls |
