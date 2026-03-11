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

### Money Flow Model

The planning engine models real-world money movement as a directed graph:

- **Income sources** are the inflow nodes (Job 1, Job 2, side hustle, rental income, etc.)
- **Cashflow items** are the edges — each routes money from a source to a destination at a specific cadence
- **Accounts** are the destination nodes for investment/savings flows
- **Taxes + FICA** are computed edges (derived from income, filing status, and state)
- **Expenses** are outflow edges from the disposable income pool
- **Residual** is computed (surplus or deficit after all flows)

This model is the single source of truth for both accumulation planning and drawdown spending. A member in accumulation and a member in drawdown both reference the same budget — one is planning against it, the other is living it.

### Cashflow Waterfall (per member, monthly)

```
INFLOWS (income sources)
  ├─ Job 1 gross salary
  ├─ Job 2 gross salary
  ├─ Side hustle / freelance
  ├─ Passive income (rental, dividends)
  └─ Employer contributions (match, profit sharing → destination account)
      ↓
  Total Gross Inflows
      ↓
PRE-TAX DEDUCTIONS (reduce taxable income)
  ├─ Health / dental / vision insurance
  ├─ Traditional 401k deferral → destination account
  ├─ HSA contribution → destination account
  └─ Other pre-tax deductions
      ↓
  Taxable Income
      ↓
TAXES (computed, not user-created)
  ├─ Federal income tax (simplified brackets by filing status)
  ├─ State income tax (by member state of residence)
  └─ FICA (Social Security capped + Medicare)
      ↓
  Net Income (take-home)
      ↓
POST-TAX CONTRIBUTIONS (investable flows → destination accounts)
  ├─ Roth 401k / Roth IRA
  ├─ Brokerage contributions
  ├─ 529 / other investment vehicles
  └─ Cash savings allocation
      ↓
  Disposable Income
      ↓
EXPENSES (from budget)
  ├─ Housing, utilities, groceries
  ├─ Insurance, transportation
  └─ Discretionary spending
      ↓
  Residual (surplus or deficit — signals plan sustainability)
```

Each cashflow item has a **cadence** (monthly, biweekly, annual, one-time) because real money moves at different frequencies. A biweekly paycheck, an annual Roth IRA max-out, and a monthly rent payment all coexist in the same waterfall.

The waterfall is computed per member, then aggregated at the household level. Household aggregation respects joint tax filing when applicable.

### Income Sources

Income sources are first-class entities, not just cashflow items:

- Each member can have multiple income sources (Job 1, Job 2, freelance, etc.)
- Each income source has a gross amount and frequency
- Pre-tax deductions and retirement deferrals hang off their income source
- Employer match is linked to the income source that generates it
- The Sankey can filter by income source to show where each dollar goes

### Account Destinations

Every deferral and contribution flows to a real account in the system. This is critical for:

- Computing FI portfolio growth (which accounts receive investable flows)
- Showing the Sankey with real account names as destination nodes
- Connecting planning inputs to actual account history

### FI Portfolio Definition

The FI portfolio is the set of accounts that generate returns toward financial independence. Not all assets count — a car or house doesn't compound toward FIRE.

- Users flag which accounts count toward FI (default: investment + HSA accounts)
- Cash accounts can optionally be included
- FI portfolio value = sum of flagged account balances
- All FI metrics reference this value, not total net worth

### Timeline Model

- Retirement timelines are per member (not household-only)
- Desired retirement age is user-editable at any time
- Default desired retirement age starts at 65

### Contribution Definition

Forward-looking contribution metrics include all recurring investable flows:

- Employee retirement deferrals (pre-tax and post-tax)
- Employer retirement contributions (match, profit sharing)
- IRA / HSA contributions
- Taxable brokerage contributions
- Other recurring investment contributions

One-time inflows (e.g., one-off gifts) are tracked but excluded from default forward projection metrics.

### Savings Rate

Savings rate uses total inflows as the denominator, split into:

- **Investment rate** — money flowing into investment accounts / total inflows
- **Savings rate** — money flowing into savings accounts / total inflows
- **Total savings rate** — combined investment + savings / total inflows

### Core Accumulation Metrics

All metrics use real (inflation-adjusted) returns. Assumptions are explicit and user-editable.

| Metric                       | Formula                                               | Description                                                        |
| ---------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------ |
| **FIRE number**              | `retirement_annual_spend / withdrawal_rate`           | Portfolio needed to fund retirement spending                       |
| **SecurityFI**               | `yearly_expenses / real_return`                       | Portfolio where real returns cover current expenses                |
| **CoastFI**                  | `FIRE_number / (1 + real_return)^years_to_retirement` | Amount needed today to coast to FIRE with no further contributions |
| **Boiling Point**            | `yearly_contributions / real_return`                  | Portfolio where annual returns exceed annual contributions         |
| **Progress to FIRE**         | `fi_portfolio / FIRE_number`                          | Percentage of the way to FIRE                                      |
| **Years to FIRE**            | log formula with contributions + growth               | Time to reach FIRE number at current contribution rate             |
| **Projected Retirement Age** | `current_age + years_to_FIRE`                         | When FIRE is reached at current pace                               |
| **On Track**                 | `projected_age <= desired_age`                        | Whether current pace meets target                                  |

Retirement annual spend is managed through the budget/expense system — the same expenses used during accumulation planning. Users can set a scenario-level override for modeling different retirement spending levels.

### Projection Engine

Year-by-year deterministic projections with:

- Contribution growth over time (inflation-adjusted or explicit growth rate, user choice)
- Optional age-based return glide path (shifting from aggressive to conservative)
- Scenario-level assumption overrides (return rates, inflation, withdrawal rate)

### Tax Strategy for V1

- Auto-estimated effective tax rate by default using simplified federal brackets + state rates + FICA
- Manual override available (flat effective rate)
- Member state of residence drives state tax estimation
- Household filing status drives federal bracket selection and joint filing math
- No mandatory tax-bracket maintenance — static versioned tables in code

### UX Direction

The cashflow Sankey is the primary visualization for the money flow system. It shows:

- All income sources on the left
- Deductions, taxes, contributions as flows through the middle
- Accounts and expense categories on the right
- Filterable by member, income source, or account
- Residual clearly visible as surplus or deficit

## 2) Drawdown/Spending Feature Set

Goal: convert assets into sustainable household cash flow with risk-aware, tax-aware spending decisions.

Tooling direction:

- Monte Carlo retirement sustainability modeling
- Dynamic withdrawal guardrails
- Withdrawal sequencing across taxable/traditional/Roth accounts
- Tax-aware spending strategy and distribution planning

The drawdown phase uses the same budget as accumulation — a member who transitions from accumulation to spending simply starts living the plan their expenses already describe.

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
- Planning data model: cashflow items, scenarios, member planning fields

Still to mature:

- Income source model and account-linked cashflow routing
- Cashflow waterfall engine and FI metric calculators
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
