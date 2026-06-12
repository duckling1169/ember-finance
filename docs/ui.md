# Ember — UI Implementation Notes

## Scope

This doc describes the current frontend implementation in `src/` (not aspirational design specs).

## Product UX Context

UI supports the current household investment manager workflows:

- Authentication and onboarding
- Dashboard overview
- Accounts list and account detail
- Household holdings view
- Settings (profile, household, members, invites, theme)

Planning-heavy FIRE tooling is a product direction and is not fully implemented in the current UI yet.

## Frontend Stack

| Area          | Implementation                                       |
| ------------- | ---------------------------------------------------- |
| Framework     | Next.js App Router + React 19                        |
| Styling       | Tailwind 4 + CSS variables in `src/app/globals.css`  |
| Components    | Local shadcn-style primitives in `src/components/ui` |
| Data fetching | SWR hooks in `src/lib/swr.ts`                        |
| Charts        | Nivo (`@nivo/line`, `@nivo/pie`)                     |
| Icons         | Tabler Icons                                         |

## Theme and Tokens

Theme state is managed via `ThemeProvider` (`light`, `dark`, `system`) and stored in local storage (`ember-theme`).

Key points from current tokens:

- Default app shell renders in dark mode (`<html className=\"dark\">`)
- Primary accent is orange (`--primary`)
- Financial semantics: `--gain`, `--loss`, `--neutral`
- Chart palette uses `--chart-*` tokens and `CHART_COLORS` in chart theme helpers

Source files:

- `src/app/globals.css`
- `src/lib/theme-context.tsx`
- `src/components/charts/theme.ts`

## App Shell

- Desktop: pinned/collapsible left sidebar with local persistence (`ember-sidebar-pinned`)
- Mobile: sheet-based navigation
- Main routes currently exposed in nav:
  - `/accounts`
  - `/holdings`
  - `/settings`
- Dashboard is `/`

Source files:

- `src/components/layout/sidebar.tsx`
- `src/app/(app)/layout.tsx`

## Data Flow and Rendering

- API client wrappers in `src/lib/api.ts`
- SWR hooks in `src/lib/swr.ts`
- Auth gating via `RequireAuth` and `AuthProvider`
- Dev bypass mode (`NEXT_PUBLIC_DEV_BYPASS_AUTH=true`) provides mock auth/data in development

Important current nuance:

- Some dashboard historical series are still mock-backed outside full production data paths

## Key Screens (Current Behavior)

## Dashboard

- Displays household/account-derived totals
- Uses area and donut charts
- Range controls are available, but historical line data is currently mock-backed in dev bypass mode

## Accounts

- List enriched accounts (balance, linked state, last synced)
- Add manual account
- Open account detail

## Account Detail

- Overview tab: details + balance history chart
- History tab: timeline and ingest actions
- CSV upload triggers `/api/ingest/csv/...`
- Manual entry UI exists, but payload contract still needs alignment with normalized manual ingest API shape

## Holdings

- Household-level aggregate positions
- Lot details and account filter controls
- Uses holdings/lot views from API response

## Settings

- Profile and household settings
- Member management and invite management
- Theme switching

## Planning

- `/planning` — Projections tab (metric cards, projection chart/table, tax-year
  provenance stamp) and Assumptions tab
- **Assumptions panel** (`planning/_components/assumptions-panel.tsx`) is the
  audit-the-math surface: every assumption grouped (returns, retirement, tax
  tables, limits/RMD, tax rules, allocation), each row showing value, effective
  date, source badge (Default / Edited / Scenario), inline dated editing with
  notes, and per-key history with record removal. The panel header shows the
  tax-table year stamp.
- `/flows` waterfall Taxes step shows the federal/state/FICA breakdown and an
  "effective [year]" stamp (or "manual rate")

## Holdings

- Three views: Positions (existing table + lots), Allocation (true cross-account
  buckets with target bands, drift alerts, per-symbol classification editing),
  Asset Location (bucket × tax-treatment matrix)

## Onboarding

- `/onboarding` (household + profile) → `/onboarding/quick-start`: three numbers
  produce a headline FI number via the real metrics engine by seeding real
  records (income source, expense item, starter account). Skippable.

## Mobile

- Mobile shell: full-width sticky top bar + sheet navigation (`flex-col lg:flex-row`)
- Tables: full-bleed horizontal scroll below `sm` (projection-table precedent),
  secondary columns hidden at small breakpoints
- Charts: Sankey compact mode below 640px container width (inward labels, small
  margins); line charts use sparser ticks at narrow widths
- Touch: `pointer-coarse:size-8` on small icon buttons via the Button primitive

## UI Priorities for Next Phase

- Replace remaining mock-backed dashboard history with persisted production data
- Add explicit sync/ingest status visibility in account workflows
- Align manual-entry UI payload shape with backend ingest contract
- Fund overlap / X-ray view (pending external data-source decision)
