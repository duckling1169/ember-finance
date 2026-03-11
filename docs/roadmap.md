# Ember — Product Roadmap (Backend-First)

## Purpose

This roadmap translates the FIRE vision into implementation order, with explicit dependency gates.
Key rule: do not build major planning UI before planning data/model APIs exist.

## Current Baseline (March 11, 2026)

Implemented:

- household/member auth and onboarding
- account/source/ingest pipeline
- holdings/tax lots/position views
- dashboard/accounts/holdings/settings frontend shell
- planning data model: cashflow items, scenarios, member planning fields (Phase 1)

## Critical Product Constraints

1. Accumulation v1 is spreadsheet parity, then hardening.
2. Money flows must model real-world routing: income sources → deductions → taxes → contributions → expenses → residual.
3. Every cashflow item routes to a destination (account or expense category). The waterfall is a directed graph, not a flat list.
4. Contribution metrics use recurring investable flows; one-time items excluded by default.
5. Retirement timelines are per member; default target age 65, user-editable.
6. Tax estimation is auto by default (simplified brackets + state + FICA), with manual override.
7. All projections use real (inflation-adjusted) returns.
8. The budget is the single source of truth for both accumulation planning and drawdown spending.

## Implementation Order

## Phase 0 — Platform Cleanup [COMPLETE]

Goal: remove known inconsistencies that will poison planning features if left unresolved.

Delivered:

- aligned manual-entry frontend payload with normalized manual ingest API contract
- replaced remaining mock-backed dashboard historical series with backend data
- added tests around account history/ingest paths used by planning summaries

## Phase 1 — Planning Data Foundation [COMPLETE]

Goal: introduce canonical planning data model (no projection math yet).

Delivered:

- planning fields on member table (state_of_residence, tax_mode, effective_tax_rate_override)
- cashflow_item table with recurring/one-time support, bucket classification, member filtering
- planning_scenario table with base/alternate support and assumptions blob
- CRUD APIs for cashflow items and scenarios, planning fields via settings profile
- integration tests covering validation, defaults, and CRUD lifecycle
- migration: `003_planning.sql`

### Phase 1 Schema

- Planning fields on `member` table: `state_of_residence`, `tax_mode` (auto|manual), `effective_tax_rate_override`
- `cashflow_item` — `household_id`, `member_id?`, `name`, `direction`, `bucket`, `tax_treatment`, `amount` (positive only), `frequency`, `is_recurring`, `include_in_projection`, `start_date`, `end_date?`, timestamps
- `planning_scenario` — `household_id`, `name`, `is_base`, `assumptions` (jsonb), timestamps

### Phase 1 API

- Planning fields via `PATCH /api/settings/profile`
- `GET/POST/PATCH/DELETE /api/planning/items`
- `GET/POST/PATCH /api/planning/scenarios`

## Phase 2 — Money Flow Engine + Accumulation Metrics (Backend)

Goal: model real-world money movement and ship spreadsheet-parity FI metrics.

This is the largest and most critical phase. The money flow model is the foundation for everything that follows — metrics, projections, Sankey visualization, and eventually drawdown planning.

### Phase 2a — Data Model Extensions

Schema changes (migration `004_planning_v2.sql`):

- `income_source` table (first-class entity per member)
  - `id`, `household_id`, `member_id`, `name`, `type` (employment, self_employment, passive, other), `gross_amount`, `frequency`, `is_active`, timestamps
  - RLS via `get_my_household_id()`
- `cashflow_item` gains:
  - `income_source_id` (nullable FK) — links deductions/deferrals to their income source
  - `destination_account_id` (nullable FK) — which account receives the money
- `account` gains:
  - `include_in_fi_portfolio` (boolean, default based on account_type)
- `planning_scenario.assumptions` schema formalized:
  - `gross_return_rate`, `inflation_rate`, `real_return_rate`
  - `withdrawal_rate`
  - `retirement_annual_spend_override` (nullable, overrides budget-derived expenses)
  - `contribution_growth_mode` (inflation | fixed_rate | none)
  - `contribution_growth_rate` (nullable, used when mode = fixed_rate)

API additions:

- Income source CRUD: `GET/POST/PATCH/DELETE /api/planning/income-sources`
- Updated cashflow item API to support `income_source_id` and `destination_account_id`

### Phase 2b — Cashflow Waterfall Engine

Pure computation functions (no DB dependency):

1. **Per-member waterfall** — given income sources + cashflow items, compute:
   - Total gross inflows
   - Pre-tax deductions (by income source)
   - Taxable income
   - Tax burden (federal + state + FICA)
   - Net income
   - Post-tax contributions (by destination account)
   - Disposable income
   - Total expenses
   - Residual (surplus or deficit)

2. **Tax estimator** — given taxable income, filing status, state:
   - Simplified federal bracket calculation (static versioned table)
   - State effective rate lookup (flat rate per state)
   - FICA: Social Security (6.2% up to cap) + Medicare (1.45% + 0.9% surtax)

3. **Household aggregation** — sum member waterfalls, respecting:
   - Joint filing status for tax computation
   - Shared vs individual expense items

4. **Cadence normalization** — all items converted to monthly for waterfall computation, with annual totals derived

### Phase 2c — FI Metrics + Projections

Pure computation functions:

1. **FI metrics** (all use real returns):
   - FIRE number = `retirement_annual_spend / withdrawal_rate`
   - SecurityFI = `yearly_expenses / real_return`
   - CoastFI = `FIRE_number / (1 + real_return)^(desired_age - current_age)`
   - Boiling Point = `yearly_contributions / real_return`
   - Progress to FIRE = `fi_portfolio / FIRE_number`
   - Years to FIRE = log formula from `calculateFIRETime`
   - Projected Retirement Age = `current_age + years_to_FIRE`
   - On Track = `projected_age <= desired_age`

2. **Year-by-year projection engine**:
   - Stepwise future value with contributions
   - Contribution growth (inflation-adjusted or explicit rate)
   - Optional age-based return glide path
   - Per-account growth tracking (contributions route to specific accounts)

3. **Savings rate calculations**:
   - Investment rate = investable flows / total inflows
   - Savings rate = savings flows / total inflows
   - Total savings rate = (investment + savings) / total inflows

### Phase 2d — API Endpoints

Read-only computation endpoints:

- `GET /api/planning/cashflow-summary` — full waterfall breakdown (member and household views)
- `GET /api/planning/projections` — yearly projection table with per-account detail
- `GET /api/planning/metrics` — all FI metrics with formula metadata and input assumptions

### Phase 2 Test Fixtures

Reference spreadsheet values as baseline test case:

- Input: birthday 10/21/1998, gross $125,900, tax rate 28%, 9% gross return, 3% inflation, 6% real return, 3% withdrawal rate, desired retirement age 45, yearly expenses $34,500, yearly savings $128,665, retirement spend $200,000
- Expected: SecurityFI $575,000, CoastFI ~$2,388,853, Boiling Point ~$2,144,420, FIRE $6,666,667, Progress 9.87%, Years to FIRE 19.82, Projected Age 47.21, On Track = Behind

Exit criteria:

- Money flow waterfall computes correctly for single and multi-member households
- Tax estimation produces reasonable results for auto mode across income levels
- FI metrics match spreadsheet outputs within agreed tolerance
- Residual calculation surfaces plan sustainability (surplus/deficit)
- All formulas and assumptions are visible in API responses

## Phase 3 — Money Flows UX + Accumulation UI (Frontend)

Goal: build planning UI only after the money flow engine and metric endpoints are stable.

Work:

- Income source setup flow ("Add an income, trace where it goes")
  - Adding income sources and tracing flows creates accounts naturally
  - Connects to CSV upload and provider linking for historical backfill
- Sankey visualization for cashflow waterfall
  - Income sources on the left, accounts and expenses on the right
  - Filterable by member, income source, or account
  - Residual clearly visible as surplus or deficit
- Budget/expense management UI
- Accumulation metric cards and projection table views
- Assumptions panel (return rates, inflation, retirement ages, contribution growth)

Exit criteria:

- User can fully replace spreadsheet accumulation workflow in-app
- Sankey and metrics update live from persisted planning inputs
- Residual signals plan sustainability at a glance

## Phase 4 — Monte Carlo + Sequence Risk Foundation (Backend + UI)

Goal: establish simulation layer that upgrades planning robustness.

Work:

- Monte Carlo simulation engine with distribution options (normal, lognormal, t, uniform)
- Sequence-of-returns worst-case analysis
- FI age distribution and probability bands
- Keep deterministic "On Track" for continuity; add probabilistic companion signal
- Percentile outputs (10th, 25th, 50th, 75th, 90th) for portfolio projections

Exit criteria:

- Simulation results reproducible for same seed/assumptions
- Percentile and probability outputs visible in UI

## Phase 5 — Drawdown/Spending V1 Definition and Delivery

Goal: move from accumulation parity to first real drawdown capability.

The drawdown phase uses the same budget as accumulation — expenses are the shared source of truth.

Work (definition first, then build):

- Lock withdrawal strategy framework (fixed real, guardrails, dynamic)
- Define account sequencing and tax-aware withdrawal logic
- Define drawdown success metrics and failure conditions
- Implement first drawdown planner using same scenario/simulation substrate

Exit criteria:

- Drawdown v1 spec is explicit and implemented end-to-end for one household scenario

## Dependency Gates (Do Not Skip)

1. No Sankey page before Phase 2 waterfall engine is in place.
2. No FI metrics UI before Phase 2 metric endpoints are stable.
3. No advanced "on track" probability label before Monte Carlo outputs exist (Phase 4).
4. No drawdown UI before withdrawal policy and tax-sequencing rules are locked (Phase 5).

## Milestone Plan

1. Milestone A: Phase 0 + Phase 1 [COMPLETE] — foundation and planning data model
2. Milestone B: Phase 2 — money flow engine + sheet-parity metrics
3. Milestone C: Phase 3 — spreadsheet replacement UX
4. Milestone D: Phase 4 + Phase 5 — probabilistic modeling + drawdown
