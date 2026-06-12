# Ember Finance

Ember is a household investment manager and planning tool for the FIRE community.

The core product idea is simple:

- Track all household accounts (banking, brokerage, retirement, debt, and illiquid assets)
- Keep investment holdings and tax lots as first-class data
- Build trustworthy historical records from multiple ingest sources (manual, CSV, API sync)
- Show portfolio and net-worth views without losing auditability

Ember is designed around two primary planning feature sets:

- Accumulation phase
- Drawdown/spending phase

## Current Product State (June 2026)

Implemented:

- Supabase auth + onboarding (create household, invite/accept, member profiles)
- Household settings, profile settings, member management, invite lifecycle
- Account management (list, create, update, account detail with
  overview / transactions / history / settings tabs)
- Household holdings backed by portfolio/tax-lot views, live quotes via Tiingo
- Ingest pipeline: manual normalized payloads + CSV upload with format
  detection (Chase, Fidelity, Vanguard, Schwab, generic)
- Cross-source dedup (auto-hide + review + hide/unhide UI)
- Timeline/history model (`raw_ingest` + `account_event` unified as `account_timeline`)
- Money flow engine: per-member cashflow waterfall, tax estimation
  (federal brackets + state + FICA, joint filing), FI metrics (FIRE
  number, CoastFI, SecurityFI, years to FI), deterministic projections
- Assumptions system: every assumption (returns, inflation, withdrawal
  rate, tax tables, ACA/IRMAA/NIIT/AMT parameters) is a date-stamped,
  user-editable record with shipped dated defaults, layered scenario
  overrides, and append-only edit history; tax outputs carry an
  "effective as of [year]" stamp
- Portfolio composition: cross-account allocation (stock/bond/intl/cash/alt)
  with target bands + drift alerts, per-symbol classification overrides,
  and an asset-location view by tax treatment
- Progressive onboarding: a 3-input quick-start that seeds real records
  and shows a headline FI number from the real metrics engine
- Frontend: dashboard, accounts, holdings, activity, flows (Sankey),
  planning (metrics + projections + assumptions panel), budget, settings;
  responsive down to phone widths

Post-MVP (not yet built):

- Live provider sync (Teller/SnapTrade) — manual + CSV are the supported paths
- Monte Carlo / sequence-of-returns simulation
- Drawdown/withdrawal modeling toolkit

## Architecture

- Frontend: Next.js (App Router), React, Tailwind, SWR
- API: Hono (TypeScript) in `api/`
- DB/Auth: Supabase Postgres + Supabase Auth
- Shared contracts: `shared/types`

The frontend and API are separate services:

- Frontend default: `http://localhost:3000`
- API default: `http://localhost:3001`

## Local Development

This repo is part of the `js/` pnpm workspace (one directory up).

### 1. Install dependencies

```bash
# from the js/ workspace root
pnpm install
```

### 2. Configure environment

Copy `.env.example` to `.env.local` and set the Supabase keys. The API
fails fast on startup if `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, or `SUPABASE_SECRET_KEY` are missing.

### 3. Run services

Terminal 1:

```bash
pnpm run dev        # Next.js on :3000
```

Terminal 2:

```bash
pnpm run dev:api    # Hono API on :3001
```

In development, the login page has a "Dev Login" button that creates a
throwaway account + household (requires "Confirm email" disabled in
Supabase Auth settings).

### 4. (Optional) Run Supabase locally

```bash
pnpm run db:start
pnpm run db:migrate
```

## Testing

- `pnpm run test:web` — frontend unit tests (vitest + testing-library)
- `pnpm --dir api run test` — API tests; `tests/unit` are pure
  (engine math, adapters, middleware) and run anywhere, `tests/integration`
  need a reachable Supabase instance via `.env.local`
- `pnpm test` — both suites

## Deployment

- **Database**: apply `supabase/migrations/*.sql` to a Supabase project
  (`pnpm run db:migrate` with a linked project). Migrations 001+002 are a
  consolidated baseline (Decision 030); 003 adds the assumptions system
  and its seeded defaults.
- **API**: any Node 22+ host. Build with `pnpm --dir api run build`, run
  `node api/dist/index.js`. Set the three Supabase vars plus
  `CORS_ORIGIN=<frontend origin>` and optionally `TIINGO_API_KEY` / `API_PORT`.
- **Frontend**: standard Next.js deploy (e.g. Vercel). Set
  `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and
  `NEXT_PUBLIC_API_URL=<API origin>`.

## Useful Scripts

- `pnpm run lint` - lint frontend + API
- `pnpm test` - run frontend + API tests
- `pnpm run build` - build frontend
- `pnpm run db:reset` - reset local Supabase database

## Documentation

- `docs/vision.md` - product vision and product boundaries
- `docs/roadmap.md` - implementation order and milestone plan
- `docs/architecture.md` - system architecture and boundaries
- `docs/schema.md` - database model and views
- `docs/api.md` - API routes and behavior
- `docs/ingest-pipeline.md` - ingest normalization/dedup flow
- `docs/ui.md` - frontend UI system and implementation notes
- `docs/decisions.md` - append-only architecture decision log
