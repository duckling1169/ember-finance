# Ember — UI Implementation Notes

## Scope

This doc describes the current frontend implementation in `src/` (not aspirational design specs).
The design laws behind it are in `docs/EMBER_DESIGN_PRINCIPLES.md`; the concrete decisions and
thresholds chosen during the June 2026 overhaul are in `docs/ui-overhaul-notes.md`.

## Product UX Context

UI supports the current household investment manager workflows:

- Authentication and onboarding (+ quick-start FI estimate)
- Dashboard overview
- Accounts list and account detail
- Household holdings (positions / allocation / asset location)
- Activity, Money flows, Budget
- Accumulation planning (projections + FI metrics)
- Assumptions (first-class audit surface)
- Settings (profile, household, members, invites, theme)

## Frontend Stack

| Area          | Implementation                                       |
| ------------- | ---------------------------------------------------- |
| Framework     | Next.js App Router + React 19                        |
| Styling       | Tailwind 4 + CSS variables in `src/app/globals.css`  |
| Components    | Local shadcn-style primitives in `src/components/ui` |
| Data fetching | SWR hooks in `src/lib/swr.ts`                        |
| Charts        | Nivo (`@nivo/line`, `@nivo/pie`, `@nivo/sankey`)     |
| Icons         | Tabler Icons                                         |

## Theme and Tokens

Theme state via `ThemeProvider` (`light`, `dark`, `system`), stored in localStorage
(`ember-theme`). Default shell is dark; light mode is fully supported.

- Primary accent: orange (`--primary`)
- Financial semantics: `--gain`, `--loss`, `--warning`, `--neutral`, `--info` — all tuned to
  ≥4.5:1 small-text contrast in both themes
- `--scenario` (violet): non-baseline scenario chrome (chip + top-bar band)
- Chart palette: `--chart-*` tokens + `CHART_COLORS` in chart theme helpers
- Gain/loss is never color-alone: `GainCell` renders a leading sign, `PctCell` renders ▲/▼-style
  arrows (`src/components/common/financial-cells.tsx`)

Source files: `src/app/globals.css`, `src/lib/theme-context.tsx`, `src/components/charts/theme.ts`.

## Design-System Components

- **`DataTable`** (`src/components/ui/data-table.tsx`) — the single table component used by every
  list/table screen. Three densities (`compact` / `dense` / `wide`); `numeric: true` columns are
  right-aligned `font-mono tabular-nums`; built-in sorting (keyboard-operable headers), a chevron
  expand affordance for details-on-demand, column-shaped loading skeletons, and `empty` / `error`
  props. Mobile behavior is configured per table: `priority` (cols hidden at 640/768 px),
  `scroll` (horizontal scroll + frozen first column), or `cards`.
- **Buttons** (`src/components/ui/button.tsx`) — taxonomy: emphasis `primary | secondary | ghost`,
  semantic `danger | inverse`; sizes `sm | md | lg | icon-sm | icon-md | icon-lg`. Exactly one
  `primary` per view (sheets/dialogs are their own view layer).
- **Two-channel feedback** — `toast()` (`src/components/ui/toast.tsx`) accepts only
  `'success' | 'info'`: top-right, 5 s auto-dismiss, max 3 stacked. Errors, validation, and
  anything needing a decision use the persistent `Alert` banner
  (`src/components/ui/alert.tsx`: `error | warning | info | success`, optional title/dismiss) or
  field-level `FormField` errors.
- **CRUD pattern** — entity create/edit happens in a right-side `Sheet`; visible labels via
  `FormField` (never placeholder-only); validation on blur, cleared as soon as input is valid.
  Destructive actions open `ConfirmDialog` (`src/components/ui/confirm-dialog.tsx`) with the
  consequence named in the confirm button and Cancel focused by default.
- **States** (`src/components/ui/states.tsx`) — shared `EmptyState`, `ErrorState`, `LoadingState`
  used everywhere (no ad-hoc "Loading..." text).

## App Shell

- Desktop: pinned/collapsible left sidebar (`ember-sidebar-pinned`) + a global top bar with
  breadcrumbs (left) and the scenario chip (right)
- Mobile: sticky top bar (menu + page title + scenario chip) + sheet navigation
- Nav: Accounts, Holdings, Activity, Flows, Budget, Planning, **Assumptions**, Settings

Source files: `src/components/layout/sidebar.tsx`, `src/components/layout/top-bar.tsx`,
`src/components/layout/scenario-chip.tsx`, `src/app/(app)/layout.tsx`.

## Scenario Model

`ScenarioProvider` (`src/lib/scenario-context.tsx`) holds the active scenario globally
(localStorage `ember-scenario`), mirrored to `?scenario=` on /flows, /planning, /assumptions for
shareable URLs. The chip shows "Base scenario" (quiet) or "Scenario: {name}" (filled violet) and
the top bar gains a 2 px violet band when a non-base scenario is active. The chip menu states
which data is scenario-specific (Flows, Planning, Assumption overrides) vs shared (accounts,
holdings, activity, budget).

## Key Screens (Current Behavior)

### Dashboard

Household totals, area + donut charts, range controls. Historical line data still mock-backed in
dev bypass paths.

### Accounts

DataTable (priority mobile mode) of enriched accounts; Add Account in a right-side sheet;
row click opens account detail.

### Account Detail

Overview tab (details + balance history + account flows DataTable), History tab (timeline +
ingest), Settings tab. CSV upload and manual entry open in sheets; manual-entry payload contract
unchanged.

### Holdings

Three views: Positions (DataTable, scroll mobile mode, expandable rows → tax lots + "view full
detail" sheet), Allocation (target bands, drift alerts, per-symbol classification), Asset
Location (bucket × tax-treatment matrix).

### Activity

DataTable (wide density, scroll mobile mode with frozen Date column), date/account filters,
conditional investment columns, amounts through GainCell.

### Flows

Waterfall summary cards (Taxes shows federal/state/FICA + tax-year stamp), Sankey on ≥640 px,
vertically stacked tap-to-expand `MobileFlowList` below 640 px. Income sources + allocations are
DataTable cards with sheet-based CRUD and confirm-dialog deletes.

### Budget

Essential/non-essential totals; per-category compact DataTables; expense/category CRUD in sheets;
category delete names the real consequence (expenses move to Uncategorized).

### Planning

`/planning` (no tabs): FI Number / Years to FI / Savings Rate metric cards, projection chart,
year-by-year DataTable (summary every-5th-year by default, "All years" on demand, Growth via
GainCell), FI portfolio value, savings rates, FI metrics cards, tax-year provenance stamp linking
to /assumptions.

### Assumptions

`/assumptions` — the audit-the-math surface, scenario-aware: six groups, every row shows value,
effective date, source badge (Default / Edited / Scenario), inline dated editing with notes
(one row open at a time), and per-key append-only history with confirm-dialog record removal.
Page header states scope (household baseline vs scenario overrides) + tax-table year.

### Settings

Profile, household, members/invites (confirm-dialog removals), theme, sign out. Cross-links to
/assumptions for planning assumptions. Successes toast; errors are card-scoped persistent alerts.

### Onboarding

`/onboarding` (household + profile) → `/onboarding/quick-start`: three numbers produce a headline
FI number via the real metrics engine by seeding real records. Skippable.

## Mobile

- Shell: full-width sticky top bar (with scenario chip) + sheet navigation
- Tables: configured once in DataTable — column priority (640/768 px), horizontal scroll with
  frozen first column, or card transform
- Sankey: replaced below 640 px by the stacked tap-to-expand flow list; line charts use sparser
  ticks at narrow widths
- Touch: `pointer-coarse:size-8` on small icon buttons via the Button primitive

## Verification Tooling

`scripts/ui-screenshot.mjs` (playwright via `PLAYWRIGHT_DIR`) captures every route in dark+light
at 1280×800 and 390×844 into `.screenshots/` (gitignored). Requires `npm run dev` +
`npm run dev:api` and authenticates via the dev login.

## UI Priorities for Next Phase

- Replace remaining mock-backed dashboard history with persisted production data
- Add explicit sync/ingest status visibility in account workflows
- Align manual-entry UI payload shape with backend ingest contract
- Fund overlap / X-ray view (pending external data-source decision)
