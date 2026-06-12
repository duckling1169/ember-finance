# Ember — Current UI/UX State & Assessment

> **Purpose of this document.** Ember is being prepared for a UI/UX overhaul. This doc is the
> _input_ to that effort. It describes the current frontend exactly as it is built today, then
> assesses honestly what works and what doesn't. The intended pipeline is:
>
> 1. **This doc** → captures current state + known pain points.
> 2. **Research agent** → uses this to propose best-practice UI/UX (visual cohesion, information
>    architecture, component standardization, placement of planning controls) and produce a target
>    design system / IA we can build off of.
> 3. **Coding agent** → implements the agreed target against the current codebase.
>
> Everything below is sourced from the live code (Next.js 16 App Router, React 19, Tailwind v4,
> @base-ui/react, Nivo charts, SWR, Supabase). File:line references are included so the research and
> coding agents can verify and locate.

---

## 1. What Ember Is (product context)

Ember is a **household, investment-first personal finance + FIRE planning tool**. Two halves:

- **Accounting half** — accounts, holdings, tax lots, transactions/activity. Data enters via
  **manual entry and CSV upload** today (Teller/SnapTrade auto-linking is modeled in the data layer
  but **not built** — there is no connect UI). Cross-source dedup with authority ranking exists.
- **Planning half** — money-flow waterfall (income → deductions → taxes → contributions → expenses →
  residual), FI metrics (FIRE number, CoastFI, etc.), year-by-year projections, and a date-stamped
  **assumptions system**. Monte Carlo and drawdown planning are future phases.

Design intent stated in code: _"Investment-first personal finance,"_ dense-but-legible financial data,
monospace numerals, a warm orange brand, dark-mode-first.

---

## 2. Design System (current)

### 2.1 Color tokens

Defined as CSS variables in `src/app/globals.css` with light + dark values; the app ships
**dark-mode-first** (`<html className="dark">` hard-coded in `src/app/layout.tsx:29`, overridable via
ThemeProvider).

| Token                            | Role                            | Light                 | Dark                    |
| -------------------------------- | ------------------------------- | --------------------- | ----------------------- |
| `--primary` / `--ring`           | brand (orange), buttons, focus  | `#ea580c`             | `#fb923c`               |
| `--background` / `--foreground`  | page bg / text                  | `#fafafa` / `#18181b` | `#09090b` / `#fafafa`   |
| `--card`                         | surfaces                        | `#ffffff`             | `#18181b`               |
| `--muted` / `--muted-foreground` | secondary surfaces / text       | `#f4f4f5` / `#71717a` | `#27272a` / `#a1a1aa`   |
| `--border` / `--input`           | borders / field bg              | `#e4e4e7` / `#d4d4d8` | `#27272a80` / `#3f3f46` |
| `--gain`                         | positive money                  | `#16a34a`             | `#22c55e`               |
| `--loss`                         | negative money                  | `#dc2626`             | `#ef4444`               |
| `--warning`                      | caution                         | `#d97706`             | `#f59e0b`               |
| `--destructive`                  | delete/error                    | `#dc2626`             | `#ef4444`               |
| `--chart-1..14`                  | chart palette (IBM-Carbon-like) | same in both modes    | same                    |

Note: `--loss` and `--destructive` resolve to the **same** color, and there is a parallel set of 8
unused `--sidebar-*` tokens reserved for a future component set.

### 2.2 Typography

- **Inter** (sans, `--font-inter`) for UI text; **Roboto Mono** (`--font-roboto-mono`) for numerals.
- Convention: all currency/percentages render `font-mono tabular-nums` via `fmt()`, `fmtPct()`,
  `fmtYears()` (`src/lib/formatters.ts`) — consistently applied. This is a genuine strength.

### 2.3 Radius & spacing

- Radius scale `--radius-sm … --radius-4xl` off a `0.5rem` base.
- No custom spacing scale; Tailwind defaults. The dominant vertical rhythm is `space-y-3` (12px),
  used as the page-root wrapper on **every** app page — a real consistency win.

### 2.4 Component primitives (`src/components/ui/`)

12 primitives, mostly CVA-based:

- **Button** — 7 variants (`default`, `outline`, `primary-outline`, `secondary`, `ghost`,
  `destructive`, `link`) × 8 sizes (`default`, `xs`, `sm`, `lg`, `icon`, `icon-xs`, `icon-sm`,
  `icon-lg`). **Very wide surface area; usage in practice is inconsistent (see §5).**
- **Card** — sizes `default` (p-6), `sm` (p-4), `flush` (p-2); subparts Header/Title/Description/
  Action/Content/Footer.
- **Input**, **Select** — h-9, shared focus/invalid/disabled styling.
- **Alert** — variants `error`, `success`; sizes `default`, `sm`.
- **Toast** — context provider, success/error, auto-dismiss 4s, **inline-styled (not CVA)** — a
  second feedback system that visually parallels Alert.
- **Table** — Header(sticky)/Body/Row(`even:bg-muted/30`, hover)/Head/Cell/Footer.
- **Sheet** — side drawer/dialog (used for holdings detail + mobile nav).
- **Checkbox**, **Skeleton**, **InfoTip** (hover tooltip).

### 2.5 Charts (`src/components/charts/`)

Nivo wrappers: **BalanceChart** & **AreaChart** (line/area), **DonutChart** (pie w/ inner radius),
**SankeyChart** (custom stacked labels, compact mode <640px). `getNivoTheme()` reads CSS vars at
runtime so chart chrome tracks light/dark; `CHART_COLORS` (14) is hard-coded and identical across
modes. Charts are dynamically imported `ssr:false`.

### 2.6 Shared cells (`src/components/common/`)

`GainCell`, `PctCell`, `ChangeIndicator` (color + sign + mono), `SortIcon` (tri-state), `PageSkeleton`.
These are used widely and are a cohesion strength.

---

## 3. App Shell & Navigation

- **Root layout** (`src/app/layout.tsx`): ThemeProvider → AuthProvider → ToastProvider; ErrorBoundary
  per page; `RequireAuth` guard (redirects to `/login` if unauthed, `/onboarding` if no household).
- **App shell** (`src/app/(app)/layout.tsx`): `flex min-h-screen flex-col lg:flex-row`; main content
  `mx-auto max-w-7xl px-4 py-6 sm:px-6`.
- **Sidebar** (`src/components/layout/sidebar.tsx`): fixed left, collapsible (w-14 ↔ w-60), pin/unpin
  persisted in localStorage, **Cmd+/** shortcut, hover-to-expand when unpinned. Branding = "Ember" +
  flame. Nav: **Accounts, Holdings, Activity, Flows, Budget, Planning** + **Settings** in footer.
  Active state = `bg-primary/10 text-primary`. Mobile = sticky hamburger header + left Sheet.
- **Page header convention**: every page opens with `<h1 className="text-2xl font-semibold">`. Detail
  pages add an inline `← back` link and a right-aligned balance/status block.

---

## 4. Page-by-Page (current behavior)

**Auth / Onboarding**

- **Login** (`(auth)/login`): centered `max-w-sm` card, email/password, sign-in/up toggle, dev-login
  button (NODE_ENV-gated, auto-generates mailinator email).
- **Onboarding** (`(auth)/onboarding`): centered card, two modes (new household vs invite). Collects
  household name, display name, birthday, filing status, state. → redirects to **quick-start**.
- **Quick-start** (`(auth)/onboarding/quick-start`): 4 inputs (income, monthly spend, invested, target
  age) → silently creates an income source + a "Living expenses" cashflow item + (optionally) a
  brokerage account, then shows an **FI-number results card** + 4 metric tiles + "Refine your plan" /
  "Go to dashboard". This is the strongest onboarding moment — fast time-to-value.

**Dashboard** (`(app)/page.tsx`)

- Range filter (30D/90D/YTD/1Y/Custom). `lg:grid-cols-3`: Net Worth area chart (2 cols) + stacked
  donuts (Accounts by Value, Tax Treatment); second row mirrors it for investments. Quick links.

**Accounts** (`(app)/accounts`)

- List = one Card + sortable table (Name, Institution, Type, Status badge, Balance, Last Synced).
  Row click → detail. Inline "Add Account" form. Empty state = icon + text + link.
- **Detail** (`accounts/view`): header (name/meta/balance/linked badge) + tabs **Overview /
  Transactions·Activity / History / Settings**. Data entry lives in **History** tab (CSV dropzone +
  manual entry form; investment accounts use a HoldingsEntryForm). Linked/Not-Linked badge is read-only
  (no connect flow exists).

**Holdings** (`(app)/holdings`)

- Account multi-select filter + 3 view tabs: **Positions** (summary cards + allocation bar + expandable
  lot rows + a Sheet detail panel), **Allocation** (5-bucket targets editor + drift alerts +
  per-position classification), **Asset Location** (tax-treatment × asset-class matrix). The most
  sophisticated screen in the app.

**Activity** (`(app)/activity`)

- Date-range + account multi-select filters; one unified table merging bank transactions + investment
  activity. Columns flex by whether investment accounts are present. `?account=` URL param preselects.

**Flows** (`(app)/flows`)

- Income-source filter + **scenario selector** (`?scenario=` URL param). 7-card waterfall summary →
  Sankey (income → taxes/savings/expenses) → "Editing for" member selector → IncomeSourcesCard +
  CashflowItemsCard, both with **inline CRUD** and smart field visibility ($/% toggle, account creation
  inline).

**Planning** (`(app)/planning`)

- Scenario selector + tabs **Projections / Assumptions**. Projections = 3 key metric cards + Nivo
  projection line chart + year-by-year table (Summary/All-years toggle). Assumptions = collapsible
  **AssumptionsPanel** (every knob grouped by returns/retirement/tax/allocation, each row with source
  badge default/household/scenario, inline edit appending a dated record, and full edit history). Plus
  an 8-card FI-metrics grid. **The assumptions audit surface is the standout feature.**

**Budget** (`(app)/budget`)

- "+ Category" / "+ Expense" buttons; 3 totals cards (Essentials/Non-essentials/Total); two-column
  Essentials | Non-essentials layout with CategorySection cards + an Uncategorized (dashed) section.
  Inline add/edit forms.

**Settings** (`(app)/settings`)

- Cards: Profile (display name, email-disabled, birthday, target age, employment, risk, state) /
  Household (name, filing status — owner only) / Members + invites / Appearance (System/Light/Dark) /
  Account (sign out). Manual save per card; theme applies instantly.

---

## 5. What's Working (keep / build on)

1. **Numeric typography** — `font-mono tabular-nums` + `fmt*()` everywhere; financial values align and
   read well. Non-negotiable to preserve.
2. **Semantic color system** — gain/loss/warning + a real token layer; charts read tokens at runtime.
3. **Page rhythm** — `space-y-3` root + `text-2xl font-semibold` h1 on every page = predictable scaffold.
4. **Shared financial cells & SortIcon** — consistent across tables.
5. **Assumptions panel** — source badges, append-only dated records, per-knob history. Transparent,
   auditable, genuinely differentiated. The "nothing hidden" ethos should propagate to the rest of the UI.
6. **Quick-start onboarding** — minimal input → instant FI number is a strong first-run.
7. **Holdings depth** — lot expansion + Sheet detail + allocation/drift is a high-water mark for
   information density done well.
8. **Sidebar ergonomics** — pin/unpin, hover-expand, Cmd+/, mobile Sheet.

---

## 6. What Isn't Working (the brief for the research agent)

These are the cohesion/UX problems most worth solving. Grouped by theme.

### 6.1 Tables are reimplemented per page (highest-leverage fix)

`AccountsTable`, `HoldingsTable`, `ActivityTable`, and the transactions/activity tabs each hand-roll
sort logic, column defs, responsive column-hiding, and empty states. SortIcon is shared but nothing
else is. Result: divergent behavior, duplicated logic, inconsistent density and mobile strategy.
**Need: one `DataTable` abstraction** (columns, sort, row-action slot, responsive rules, empty state).

### 6.2 Two feedback systems (Toast vs Alert), used interchangeably

Account create/settings and holdings forms use **Alert**; flows, allocation targets, and budget use
**Toast**. Same action class, different affordance. **Need: one feedback convention** (recommend toast
for transient save results, alert reserved for persistent/blocking states).

### 6.3 Filters/search are placed and styled differently per page

Accounts = sort only; Activity = date-range + account multi-select; Holdings = account multi-select;
Transactions tab = search + "show hidden". Different layouts, different controls, different placement.
**Need: a shared filter bar pattern** and a decision on search/date-range availability per data view.

### 6.4 Inconsistent CRUD patterns

Flows uses an inline form appearing below the table; Budget edits in-row / in-header; Settings uses
per-card manual save with no dirty/pending state. **Need: one create/edit/delete interaction model**,
including a **delete-confirmation** standard (budget category/expense deletes are currently irreversible
with no confirm).

### 6.5 Planning configuration is split across two pages

Assumptions (withdrawal rate, allocation targets, tax tables) live on **/planning → Assumptions tab**;
profile/household/filing-status live on **/settings**. Users can't predict where a given knob lives.
**Need: a coherent IA decision** — likely consolidate all planning assumptions under Planning, leave
only identity/household/members/appearance in Settings. (This is an information-architecture question,
not just styling.)

### 6.6 "Add" / primary actions are inconsistently discoverable

Accounts has a top-right "Add Account"; Holdings has **no** add (you add via account detail → History
tab); Activity has no page-level add; Flows hides add behind a small CardAction icon. **Need: a
consistent primary-action placement rule.**

### 6.7 Button variant sprawl

7 variants × 8 sizes, and the same logical action (e.g. primary submit) appears as `primary-outline`
in some places and `default`/`secondary` in others. **Need: a tightened variant set with a usage map**
(primary action, secondary action, destructive, tertiary/link) and lint-able conventions.

### 6.8 Empty / loading / error states vary

Messages range from "No accounts" to "No data" to full icon+CTA blocks; some tables show a 6-row
skeleton, some show nothing; full-page route transitions have no loading affordance. **Need: a shared
EmptyState component** and a loading convention.

### 6.9 Navigation & wayfinding gaps

No desktop breadcrumb; sub-routes (`/accounts/view`) don't reflect in nav; the **scenario selector**
silently changes results across Flows _and_ Planning with no global indicator that a non-base scenario
is active; back-link styling is ad hoc. **Need: wayfinding (breadcrumbs/active sub-route) and a global
scenario indicator/switcher.**

### 6.10 Mobile density edge cases

Sankey desktop labels overflow on ~380px screens despite a compact mode; wide sparse tables (Activity)
are hard to scan on mobile; two-column Budget collapses awkwardly on tablets. **Need: a mobile-first
table/figure strategy.**

### 6.11 Minor token/system tidy-ups

`--loss` == `--destructive`; unused `--sidebar-*` tokens; inconsistent focus-ring widths (2px vs 3px)
and disabled opacity (50% vs 60%) across primitives; ChartTooltip is double-styled (inline + Nivo
theme). Low severity, but relevant to a clean design-system reset.

---

## 7. Questions for the Research Agent

These are the decisions we want best-practice guidance on, in priority order:

1. **Information architecture / page model.** Is the current 7-section nav (Accounts, Holdings,
   Activity, Flows, Budget, Planning, Settings) the right top-level split for an investment-first FIRE
   tool? Where should planning **assumptions** live relative to **profile/household**? (See §6.5.)
2. **A unified data-table + filter system.** What's the right column/sort/filter/empty/responsive model
   for financial tables that range from compact (accounts) to dense+expandable (holdings) to wide+sparse
   (activity)? (See §6.1, §6.3.)
3. **Visual cohesion / design language.** Given the orange-brand, dark-first, mono-numeral foundation —
   what type scale, spacing scale, card density, and color usage best serve dense financial data while
   feeling calm and trustworthy? Tighten the button/variant system. (See §6.7, §6.11.)
4. **Feedback & interaction model.** One convention for save feedback, CRUD, delete confirmation, and
   pending/dirty state. (See §6.2, §6.4.)
5. **Wayfinding & scenarios.** Breadcrumbs/active-route, and how a multi-page **scenario** context
   should be surfaced and switched. (See §6.9.)
6. **Action discoverability.** A placement rule for primary "add"/CRUD actions across list pages.
   (See §6.6.)
7. **Onboarding → habitual use.** How to carry the strong quick-start moment into ongoing engagement
   (empty states that teach, next-best-action prompts).

Deliverables we'd want back: a target IA/sitemap, a tightened design-token + component spec, a
canonical set of patterns (table, filter bar, form/CRUD, feedback, empty/loading/error, primary
action), and annotated before/after notes mapped to the §6 problems so the coding agent has a concrete
build list.

---

## 8. Reference Map (for verification)

- Design tokens: `src/app/globals.css`; fonts `src/app/layout.tsx`.
- Primitives: `src/components/ui/{button,card,input,select,alert,toast,table,sheet,checkbox,skeleton,info-tip}.tsx`.
- Charts: `src/components/charts/{theme,balance-chart,area-chart,donut-chart,sankey-chart}.ts(x)`.
- Shared cells: `src/components/common/{financial-cells,sort-icon,page-skeleton}.tsx`.
- Shell/nav: `src/app/layout.tsx`, `src/app/(app)/layout.tsx`, `src/components/layout/sidebar.tsx`.
- Pages: `src/app/(app)/{page,accounts,accounts/view,holdings,activity,flows,budget,planning,settings}`.
- Auth/onboarding: `src/app/(auth)/{login,onboarding,onboarding/quick-start}`.
- Formatters: `src/lib/formatters.ts`. Scenario state: `src/components/planning/scenario-selector.tsx`.

> **Note on "linking" (Teller/SnapTrade):** The Linked/Not-Linked badge and provider plumbing exist in
> the data layer, but there is **no account-connect UI or adapter**. Any IA work that assumes auto-sync
> should treat it as a _future_ surface, not a current one.
