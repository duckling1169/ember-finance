# Ember — Decision Log

Architectural decisions, recorded when made. Append-only.

---

### 001 — App Focus: Investment-First

Portfolio construction, performance tracking, and allocation are primary. Net worth tracking is secondary. The data model, table structure, and query patterns all reflect this priority.

---

### 002 — Separate Tables for Transactions vs Investment Activity

Investment activity has fundamentally different fields (symbol, quantity, price, lot_id, activity_type) and different query patterns (performance by symbol, dividend history, cost basis per lot). Separate tables mean clean queries and clear intent. No polymorphic type column.

---

### 003 — Holdings as Provider Snapshots, Not Derived

Holdings are point-in-time snapshots from providers, not computed from investment*activity. Provider snapshots are ground truth. Activity explains \_how* you got there, but reconciling activity into positions is error-prone and unnecessary when the provider gives you the answer.

---

### 004 — Accounts Are Concepts, Sources Are Pipes

An account ("my Fidelity 401k") is a single entity. `account_source` represents data pipes (Teller, CSV, manual). One account can have multiple sources — e.g., SnapTrade for live sync + CSV for historical backfill. Dedup handles overlap.

---

### 005 — Application-Level Credential Encryption

Provider tokens encrypted with AES-256-GCM before storage in `account_source.provider_meta` (bytea). A database dump does not expose credentials. Key managed via environment variable.

---

### 006 — Append-Only Raw Ingestion

`raw_ingest` stores every payload exactly as received. Never mutated. Enables reprocessing without provider API calls. Status transitions: pending → processed/failed/skipped.

---

### 007 — Cross-Source Dedup with Authority Ranking

When the same transaction appears from multiple sources, the system auto-hides the less authoritative copy. Ranking: teller > snaptrade > pdf > csv > manual. Groups of 3+ are flagged for manual review rather than auto-resolved.

---

### 008 — Flat Category Taxonomy

Transaction categories are simple flat text with no enforced schema. Users can categorize however they want. No category tree, no predefined list. Keeps the model simple for a personal tool.

---

### 009 — Materialized Net Worth Snapshots

Net worth is computed daily (or on-ingest) and written to `net_worth_snapshot`. Dashboard reads this single table. Never computed on page load.

---

### 010 — One Household Per Auth User

Enforced by unique constraint on `member.auth_user_id` and a DB trigger (`trg_prevent_multi_household`). Simplifies the model — a user sees exactly one household's data.

---

### 011 — Partner Role is Always Owner

Per onboarding spec, invited partners join as `owner` role. The `viewer` role exists in the schema for future use but is not exposed in the invite flow.

---

### 012 — Invite Flow: 24-Hour TTL + Supabase Magic Link

Invites expire after 24 hours. The system sends a Supabase Auth magic link via `inviteUserByEmail`. If the user doesn't have an account, Supabase creates one. Expired invites require a re-invite. Duplicate pending invites to the same email are blocked.

---

### 013 — Onboarding Atomicity via Postgres RPC

`create_household_with_owner()` creates household + member in a single Postgres transaction. If member creation fails, the household is also rolled back. The API has a fallback path (sequential inserts with manual rollback) for environments where the RPC isn't available.

---

### 014 — Hono Backend Separate from Next.js Frontend

The API runs as a standalone Hono server (port 3001), separate from the Next.js frontend (port 3000). This keeps the API portable across runtimes and simplifies future mobile client support. Communication is REST over CORS.

---

### 015 — Provider Balance is Authoritative

When provider sync and manual/CSV balances coexist for the same date, provider balance wins. Manual and CSV-derived balances fill gaps for dates before a provider was linked.

---

### 016 — Documentation Split

Single `data-model-architecture.md` replaced with focused docs:

- `architecture.md` — philosophy, stack, project structure
- `schema.md` — database tables, constraints, RLS
- `api.md` — route reference, auth, request/response shapes
- `ingest-pipeline.md` — adapters, pipeline flow, dedup, encryption
- `decisions.md` — this file (append-only decision log)

---

### 017 — Decoupled Security Price Cache

Prices live in a global `security_price` table (no `household_id`, no RLS). Market prices are public data — every household that holds AAPL sees the same price. The backend writes prices via service role from any source (SnapTrade sync, market data API, manual). Holdings reference prices by symbol join, not by storing prices themselves. This means updating one row in `security_price` instantly updates every household's portfolio valuation.

---

### 018 — Tax Lot Tracking from Activity

Tax lots are per-account, per-symbol records created from buy activity and depleted by sells. `tax_lot.quantity` tracks remaining shares (not event-sourced). `lot_disposition` is the junction table recording which lots a sell consumed, with per-slice proceeds, cost basis, and gain/loss. FIFO is the default lot assignment method. `is_short_term` is captured at disposition time (immutable after sale). Open lot holding period is computed at query time since it changes daily.

---

### 019 — Holdings vs Tax Lots: Two Sources of Truth

`holding` = provider snapshots (ground truth for "what you own"). `tax_lot` = built from activity (ground truth for "cost basis and tax treatment"). They should agree on total quantity per (account, symbol) but may drift due to timing or missing activity data. Reconciliation surfaces discrepancies rather than enforcing hard constraints between the two.

---

### 020 — Net Worth Uses Holdings × Security Price

`compute_net_worth_snapshot()` values investment accounts via `holding.quantity × security_price.price` (falling back to `holding.price` when no live price exists). Cash, debt, and illiquid accounts still use `balance_snapshot`. This means net worth updates automatically when prices refresh, without needing a new holding snapshot.

---

### 021 — UI Design System: shadcn/ui + Tailwind

Component library is shadcn/ui (Radix + Tailwind, copy-paste). Charts via Recharts. Data tables via @tanstack/react-table. Forms via react-hook-form + zod. Dark-mode native, desktop-primary. All inline styles to be replaced with Tailwind classes. Full spec in `docs/ui.md`.

---

### 022 — Product Positioning: FIRE Household Investment Manager

Ember is positioned as a household investment manager and planning platform for FIRE-oriented users, not as a general-purpose budgeting app. Investment holdings, tax lots, and long-horizon planning data are first-class concerns.

---

### 023 — Two Distinct Planning Modes

Product planning is organized into two explicit modes: accumulation and drawdown/spending. Both modes share one data foundation (accounts, holdings, lots, cash/debt context), but require different decision tooling and modeling outputs.

---

### 024 — Modeling Quality Bar

Planning features must be assumption-driven, reproducible, interpretable, and stress-testable. Monte Carlo is required but not sufficient on its own; drawdown tooling must include guardrails and tax-aware withdrawal logic over time.

---

### 025 — Current Charting Implementation Uses Nivo

Frontend chart components are currently implemented with Nivo (`@nivo/line`, `@nivo/pie`) and shared chart theme tokens. Earlier references to alternative chart libraries describe prior direction, not current implementation.

---

### 026 — Terminology: Feature Sets, Not Modes

Supersedes terminology in Decision 023 for product language. Accumulation and drawdown/spending are treated as Ember's two primary planning feature sets, not mutually exclusive app modes. Households may use both continuously as part of one integrated investment-planning workflow.

---

### 027 — Household-First Model Confirmed for MVP

Considered switching the primary entity from household to user (with an optional linked household). Decided against it: the one-household-per-user constraint (Decision 010) already makes a solo user equivalent to a single-member household, so the household adds no friction for individuals while enabling the joint-filing tax math, member-scoped income sources, and shared-expense aggregation that the planning engine is built on. Re-keying every table to user-first would be a large migration with no MVP benefit.

---

### 028 — Net Worth Computed Live; Materialized Snapshots Dropped

Supersedes Decision 009. The dashboard computes net worth from `balance_snapshot` aggregates at request time; the `net_worth_snapshot` table and `compute_net_worth_snapshot()` function had no callers and were dropped, along with the unused `asset` table (non-account asset tracking has no API or UI yet). If request-time aggregation becomes slow or asset tracking ships, re-introduce materialization then.

---

### 029 — Provider Sync and Credential Encryption Deferred Post-MVP

Supersedes the implementation status implied by Decision 005. Teller/SnapTrade live sync is out of MVP scope: the 501 sync endpoint, encryption utilities, `account_source.provider_meta` column, and related env vars were removed because none had a live code path. Decision 005's design (AES-256-GCM application-level encryption) remains the plan when provider sync is actually built. Manual entry and CSV upload are the supported MVP ingestion paths.

---

### 030 — Consolidated Migration Baseline

`001_schema.sql` + `002_views_functions.sql` are treated as an editable consolidated baseline while the product is pre-launch (the hosted DB is kept in sync by applying equivalent DDL directly). Once there are real external users, migrations become append-only.
