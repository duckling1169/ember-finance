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

## Current Product State (March 2026)

Implemented:

- Supabase auth + onboarding (create household, invite/accept, member profiles)
- Household settings, profile settings, member management, invite lifecycle
- Account management (list, create, update, account detail)
- Household holdings endpoint backed by portfolio/tax-lot views
- Ingest pipeline for:
  - manual normalized payloads
  - CSV upload with format detection + normalization
- Dedup tooling (auto-hide + review endpoints)
- Timeline/history model (`raw_ingest` + `account_event` unified as `account_timeline`)
- Frontend app shell and pages:
  - Dashboard
  - Accounts + account detail
  - Holdings
  - Settings

In progress / not yet shipped:

- Live provider sync (`/api/ingest/sync/:householdId/:sourceId` currently returns `501`)
- Link/disconnect provider UX flows in frontend
- Production dashboard time-series from persisted snapshots (some dashboard series still use dev mocks)
- PDF ingest adapter
- Advanced drawdown/withdrawal modeling toolkit

## Architecture

- Frontend: Next.js (App Router), React, Tailwind, SWR
- API: Hono (TypeScript) in `api/`
- DB/Auth: Supabase Postgres + Supabase Auth
- Shared contracts: `shared/types`

The frontend and API are separate services:

- Frontend default: `http://localhost:3000`
- API default: `http://localhost:3001`

## Local Development

### 1. Install dependencies

```bash
npm install
npm install --prefix api
```

### 2. Configure environment

Copy `.env.example` to `.env.local` and set required keys for Supabase/API integrations.

### 3. Run services

Terminal 1:

```bash
npm run dev
```

Terminal 2:

```bash
npm run dev:api
```

### 4. (Optional) Run Supabase locally

```bash
npm run db:start
npm run db:migrate
```

## Useful Scripts

- `npm run lint` - lint frontend + API
- `npm test` - run API tests
- `npm run build` - build frontend
- `npm run db:reset` - reset local Supabase database

## Documentation

- `docs/vision.md` - product vision and product boundaries
- `docs/roadmap.md` - implementation order and milestone plan
- `docs/architecture.md` - system architecture and boundaries
- `docs/schema.md` - database model and views
- `docs/api.md` - API routes and behavior
- `docs/ingest-pipeline.md` - ingest normalization/dedup flow
- `docs/ui.md` - frontend UI system and implementation notes
- `docs/decisions.md` - append-only architecture decision log
