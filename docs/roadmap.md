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

Missing for planning feature sets:

- no planning-domain schema (cashflow streams, assumptions, scenarios, projections)
- no planning APIs for recurring inflows/outflows
- no deterministic projection engine for FI metrics
- no Monte Carlo/drawdown simulation services

Important gap already identified:

- account-detail manual-entry UI payload is not aligned with manual ingest API contract

## Critical Product Constraints

1. Accumulation v1 is spreadsheet parity.
2. Cashflow must be full-funnel (all inflows/outflows), per member then household aggregate.
3. Contribution metrics use recurring investable flows; one-time items excluded by default.
4. Retirement timelines are per member; default target age 65, user-editable.
5. Tax defaults should not require ongoing bracket-maintenance dependency; manual override required.

## Implementation Order

## Phase 0 — Platform Cleanup (Immediate)

Goal: remove known inconsistencies that will poison planning features if left unresolved.

Work:

- align manual-entry frontend payload with normalized manual ingest API contract
- replace remaining mock-backed dashboard historical series with backend data
- add tests around account history/ingest paths used by planning summaries

Exit criteria:

- no known frontend/API contract mismatches in data entry paths
- dashboard reads production-backed series in non-dev-bypass mode

## Phase 1 — Planning Data Foundation (Backend First)

Goal: introduce canonical planning data model (no projection math yet).

Work:

- add planning schema for recurring cashflow items:
  - inflows (salary, recurring gifts, other)
  - pre-tax deductions
  - retirement deferrals and employer contributions
  - post-tax contributions
  - expenses
- add support for one-time cashflow items (tracked separately from recurring)
- add per-member planning profile fields needed for timeline/tax assumptions
- add member-level state-of-residence support (current model stores state at household level)
- add tax settings with auto-estimated effective-rate + manual override
- add scenario container model (base scenario + alternates)
- expose CRUD APIs for all planning entities (`/api/planning/...`)

Exit criteria:

- all planning inputs can be created/updated/read via API
- recurring vs one-time classification is explicit and tested
- per-member timeline inputs are persisted and queryable

### Phase 1 Minimum Schema Contract (Proposed)

Minimum tables needed before frontend planning pages:

- `planning_profile`
  - scope: per member
  - fields: `member_id`, `state_of_residence`, `target_retirement_age`, `tax_mode`, `effective_tax_rate_override`, timestamps
- `cashflow_item`
  - scope: member-level or household-level
  - fields: `household_id`, `member_id?`, `name`, `direction` (`inflow|outflow`), `bucket`, `tax_treatment`, `amount`, `frequency`, `is_recurring`, `include_in_projection`, `start_date`, `end_date?`, timestamps
- `planning_scenario`
  - scope: household
  - fields: `household_id`, `name`, `is_base`, high-level assumptions blob, timestamps

Design notes:

- store `cashflow_item.amount` as positive magnitude only; use `direction` for semantics
- treat employer match/profit sharing as investable inflow categories, not salary
- keep one-time items in `cashflow_item` with `is_recurring = false` and `include_in_projection = false` by default
- do not encode provider account linkage in planning tables initially; planning should work before account-link completion
- preserve household tenancy and RLS conventions from existing schema

### Phase 1 Minimum API Contract (Proposed)

- `GET /api/planning/profiles`
- `PATCH /api/planning/profiles/:memberId`
- `GET /api/planning/items`
- `POST /api/planning/items`
- `PATCH /api/planning/items/:itemId`
- `DELETE /api/planning/items/:itemId`
- `GET /api/planning/scenarios`
- `POST /api/planning/scenarios`
- `PATCH /api/planning/scenarios/:scenarioId`

## Phase 2 — Deterministic Accumulation Engine (Backend)

Goal: ship spreadsheet-parity metrics from canonical planning inputs.

Work:

- implement cashflow waterfall calculator (member monthly -> household aggregate)
- implement deterministic projection engine
- implement accumulation metrics:
  - SecurityFI
  - CoastFI
  - FIRE
  - Progress to FIRE
  - Years to FIRE
  - Projected Retirement Age
  - On Track (deterministic v1)
  - Contribution Crossover (legacy: Boiling Point)
- expose read APIs:
  - cashflow summary
  - yearly projection tables
  - metric cards with formula metadata
- add test fixtures that mirror spreadsheet examples

Exit criteria:

- backend metrics match spreadsheet outputs within agreed tolerance
- formulas and assumptions are visible in API responses

## Phase 3 — Money Flows UX + Accumulation UI (Frontend)

Goal: build planning UI only after foundation/model endpoints are stable.

Work:

- add `Money Flows` page (new route) backed by planning APIs
- add Sankey visualization for cashflow waterfall (member and household views)
- add editing UI for recurring and one-time cashflow items
- add accumulation metric cards and projection table views
- show assumptions panel (tax mode, retirement ages, growth settings)

Exit criteria:

- user can fully replace spreadsheet accumulation workflow in-app
- Sankey and metrics update from persisted planning inputs

## Phase 4 — Monte Carlo + Sequence Risk Foundation (Backend + UI)

Goal: establish simulation layer that upgrades planning robustness.

Work:

- add Monte Carlo simulation engine and assumption model
- add sequence-of-returns stress outputs
- return FI age distribution and probability bands
- keep deterministic “On Track” for continuity; add probabilistic companion signal

Exit criteria:

- simulation results reproducible for same seed/assumptions
- percentile and probability outputs visible in UI

## Phase 5 — Drawdown/Spending V1 Definition and Delivery

Goal: move from accumulation parity to first real drawdown capability.

Work (definition first, then build):

- lock withdrawal strategy framework (fixed real, guardrails, dynamic)
- define account sequencing and tax-aware withdrawal logic
- define drawdown success metrics and failure conditions
- implement first drawdown planner using same scenario/simulation substrate

Exit criteria:

- drawdown v1 spec is explicit and implemented end-to-end for one household scenario

## Dependency Gates (Do Not Skip)

1. No Sankey page before Phase 1 + 2 APIs are in place.
2. No advanced “on track” probability label before Monte Carlo outputs exist.
3. No drawdown UI before withdrawal policy and tax-sequencing rules are locked.

## Suggested Near-Term Milestone Plan

1. Milestone A: Phase 0 + Phase 1 (foundation complete)
2. Milestone B: Phase 2 (sheet-parity engine complete)
3. Milestone C: Phase 3 (spreadsheet replacement UX complete)
4. Milestone D: Phase 4 + Phase 5 (robust drawdown begins)
