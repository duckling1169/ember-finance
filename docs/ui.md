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

## UI Priorities for Next Phase

- Replace remaining mock-backed dashboard history with persisted production data
- Add explicit sync/ingest status visibility in account workflows
- Align manual-entry UI payload shape with backend ingest contract
- Introduce dedicated accumulation and drawdown planning surfaces
