# Ember — Product Vision

## Vision Statement

Ember is a household investment manager and planning engine for the FIRE community, built around two primary feature sets:

- Accumulation phase
- Drawdown/spending phase

The product must be best-in-class at turning messy multi-account data into trustworthy financial decisions.

## Product Identity

At its core, Ember is not a budgeting app. It is:

- A household investment system of record
- A planning platform for long-horizon financial independence decisions
- A modeling tool where assumptions are explicit and results are explainable

## Primary User

- FIRE-oriented households with multiple account types and tax buckets
- Users who care about portfolio construction, contribution strategy, tax drag, and withdrawal sequencing
- Users who want rigor, not generic personal-finance summaries

## Two Primary Feature Sets

## 1) Accumulation Feature Set

Goal: maximize probability of reaching financial independence with a portfolio and savings plan that can survive real-world uncertainty.

Tooling direction:

- Savings rate and contribution planning by account/tax bucket
- Allocation and glide-path planning
- Scenario modeling (income changes, market regimes, one-off expenses)
- Progress-to-target metrics tied to household spending assumptions

## Accumulation V1 Contract (Sheet Parity)

V1 for accumulation is parity with the current spreadsheet tracker, then incremental hardening.

### Cashflow Model

The planning engine uses a full cashflow waterfall, not just net savings:

1. recurring inflows (salary + other recurring income)
2. pre-tax non-retirement deductions (insurance, etc.)
3. pre-tax retirement deferrals
4. estimated taxes
5. post-tax investing
6. living expenses
7. residual cashflow

This model is computed per member and then aggregated at the household level.

Flow representation convention:

- every cashflow item has an explicit `direction` (`inflow` or `outflow`)
- `amount` is always stored as a positive magnitude
- sign is derived in reporting/visualization layers when needed

### Timeline Model

- retirement timelines are per member (not household-only)
- desired retirement age is user-editable at any time
- default desired retirement age starts at 65

### Contribution Definition

Forward-looking contribution metrics include all recurring investable flows:

- employee retirement contributions
- employer retirement contributions
- IRA/HSA contributions
- taxable brokerage contributions
- other recurring investment contributions

One-time inflows (for example, one-off gifts) are tracked but excluded from default forward projection metrics.

Employer match is treated as an investable inflow (new capital), separate from base salary inflow.

### Core Accumulation Metrics

Initial milestone/trajectory metrics include:

- SecurityFI
- CoastFI
- FIRE
- Progress to FIRE
- Years to FIRE
- Projected Retirement Age
- On Track status (v1 deterministic comparison)
- Contribution crossover milestone (current working term; legacy sheet label: "Boiling Point")

Contribution crossover is defined as the first year where expected annual portfolio return is greater than or equal to annual recurring contributions.

### Tax Strategy for V1

- support auto-estimated effective tax rate by default
- allow explicit manual tax-rate override
- collect member state of residence in onboarding to support state-aware estimation
- avoid mandatory tax-bracket maintenance as a release dependency

### UX Direction

A cashflow Sankey view is a first-class candidate for visualizing the household money-flow system in accumulation planning.

## 2) Drawdown/Spending Feature Set

Goal: convert assets into sustainable household cash flow with risk-aware, tax-aware spending decisions.

Tooling direction:

- Monte Carlo retirement sustainability modeling
- Dynamic withdrawal guardrails
- Withdrawal sequencing across taxable/traditional/Roth accounts
- Tax-aware spending strategy and distribution planning

## Modeling Standard (Non-Negotiable)

Every major planning output should be:

- Assumption-driven (inputs visible and editable)
- Reproducible (same inputs, same outputs)
- Interpretable (clear attribution of what drove the result)
- Stress-testable (not only a single average-case projection)

## Current State (March 2026)

Implemented foundation:

- Household auth + onboarding + member/invite model
- Account/source/data-ingest architecture
- Holdings and tax-lot data model with portfolio views
- Frontend shell for dashboard, accounts, holdings, settings

Still to mature:

- Full live-provider sync workflows
- End-to-end production planning analytics in UI
- Drawdown/withdrawal modeling toolkit

## Product Boundaries

In scope:

- Household investment management
- FIRE planning (accumulation + drawdown)
- High-fidelity financial modeling and scenario analysis

Out of scope for now:

- General-purpose budgeting replacement
- Consumer social/community features
- Lightweight "set and forget" finance summaries with no model transparency

## Definition of Success

A household can use Ember to answer, with confidence:

- Are we on track for FIRE under realistic assumptions?
- What should we do next in accumulation?
- How much can we safely spend in drawdown, and from where?
- How robust is that plan under adverse scenarios?

## Roadmap Link

Implementation sequencing and dependency gates live in `docs/roadmap.md`.
