# UI/UX Overhaul — Working Notes & Decisions

Implements `docs/EMBER_DESIGN_PRINCIPLES.md` (eight principles + mobile density).
This file records the audit findings the work is grounded in, and every concrete
threshold/pattern decision the design doc left to the implementer.

## Audit findings (pre-change state, June 2026)

### P1 — Tables (one system, three densities)

Current implementations are per-page and inconsistent:

| Surface                      | Component             | Numeric align | Mono                                | Expandable                     | Mobile                              |
| ---------------------------- | --------------------- | ------------- | ----------------------------------- | ------------------------------ | ----------------------------------- |
| Accounts list                | ui/table              | right         | Balance only (Last Synced not mono) | no                             | 2 cols hidden `sm:`, `-mx-6` scroll |
| Account txns/activity        | ui/table              | right         | yes                                 | no                             | 1 col hidden, `-mx-6` scroll, pager |
| Holdings positions           | ui/table              | right         | yes                                 | chevron + row click → lot rows | none (no scroll wrapper!)           |
| Holdings classification      | hand-rolled `<table>` | right         | yes                                 | no                             | 1 col hidden                        |
| Asset location               | hand-rolled `<table>` | right         | yes                                 | no                             | scroll                              |
| Activity                     | ui/table              | right         | partial                             | no                             | 1 col hidden, `-mx-4` scroll        |
| Income sources / allocations | ui/table              | right         | amount only                         | no                             | `-mx-4` scroll                      |
| Budget                       | flex rows (no table)  | n/a           | totals only                         | no                             | wraps                               |
| Projection table             | ui/table              | right         | yes                                 | summary/all toggle             | `-mx-4` scroll                      |

Scroll margins inconsistent (`-mx-4` vs `-mx-6`), zebra only via the primitive's
`even:bg-muted/30`, hover color inconsistent (`hover:bg-primary/5` vs `bg-muted/50`).

### P2 — Feedback channels

Both channels exist and are used interchangeably — the documented anti-pattern:

- `toast('error', …)` used for CRUD failures in: composition-view, income-sources-card,
  cashflow-items-card, budget page, transactions-tab, account-flows, assumptions-panel.
- Persistent `Alert` used for fetch errors in: holdings, accounts, dashboard, flows.
- Settings uses a third pathway: `flash()` setState w/ 3s timer rendered in an Alert.
- Several CRUD paths have **no success feedback** (cashflow items, budget).
- Toast: bottom-right, 4s, unbounded stack.

### P3 — Assumptions placement

Assumptions panel is buried as a collapsible card inside the Planning page's second
tab ("settings"). Strong content (source badges, append-only history, dated edits)
with weak scent. Settings holds two assumption-like fields (Birthday, Target
Retirement Age) on the profile record.

### P4 — Scenario indicator

`?scenario=` URL param read independently by /planning and /flows; ScenarioSelector
rendered per-page in the page header; **no global indicator**, state silently lost
when navigating to another page. Scenario create failure is swallowed silently.
Nothing tells the user which data is shared vs scenario-specific.

### P5 — Buttons

7 variants × 8 sizes in `button.tsx`. In practice `primary-outline` is used as the
de-facto primary action; true filled primary is almost never used; destructive
actions (delete income source/allocation/expense/category, remove member, cancel
invite, remove assumption record) are ghost icon buttons with **no confirmation**.

### P6 — Color-alone

- `--gain/--loss/--warning/--neutral` tokens exist in both themes.
- GainCell has a `+` sign; PctCell has arrows — good.
- Violations: projection-table Growth column (`text-gain` raw text, no sign);
  transactions-tab amount (`text-gain` when > 0, no sign); light-mode warning
  `#d97706` is ~3.1:1 as small text.

### P7 — Progressive disclosure

Holdings→lots (good), assumption history (good), projection summary/all (good).
Gaps: no global table affordance standard; Sankey nodes not tappable for detail on
mobile; waterfall Taxes breakdown always inline (fine) but no node drill-down.

### P8 — States & CRUD

- Loading: PageSkeleton / raw `<p>Loading...</p>` (flows, budget) / spinner
  (settings) / 6 ad-hoc skeleton rows (activity) — four different patterns.
- Empty: ad-hoc text everywhere; accounts has the only designed empty state.
- Error: Alert / destructive-bordered Card / nothing (activity has no error state).
- CRUD: inline forms everywhere with `h-7 text-xs` inputs and `text-xs` labels;
  validation on submit only; no delete confirmations anywhere.
- No breadcrumbs; account detail relies on a "Back to Accounts" link.

---

## Decisions (committed values)

### Tokens (globals.css — extended, not rebuilt)

- `--gain` light: `#15803d` (was `#16a34a`) — ≥4.5:1 small-text on `#fafafa`.
- `--warning` light: `#b45309` (was `#d97706`) — ≥4.5:1.
- `--loss` unchanged (`#dc2626` / `#ef4444`).
- New `--info`: light `#1d4ed8`, dark `#60a5fa` (info banners).
- New `--scenario`: light `#7c3aed`, dark `#a78bfa` (violet — non-baseline scenario
  chrome; deliberately distinct from primary orange and from gain/loss/warning).
- All mapped through `@theme inline` as `--color-*` like existing tokens.

### Button taxonomy (P5)

Variants: `primary` (filled orange), `secondary` (bordered — replaces both
`outline` and `primary-outline`), `ghost` (tertiary), `danger` (destructive),
`inverse` (foreground-on-background flip, for colored surfaces).
Sizes: `sm` (h-7), `md` (h-8, default), `lg` (h-9), `icon-sm`, `icon-md`, `icon-lg`.
Migration map: default→primary, primary-outline→secondary (promoted to `primary`
only for the single main action of a view), outline→secondary,
destructive→danger, link→removed (plain anchor styling), xs→sm, icon-xs→icon-sm,
icon→icon-md.
Rules enforced in migration: exactly one `primary` per view (the section's Add /
Save); destructive buttons get `danger` styling + whitespace separation; dense
tables use ghost icon-sm buttons; ≥3 row actions overflow to a kebab menu.

### Two-channel feedback (P2)

- Toast = success/info confirmations ONLY. `ToastType = 'success' | 'info'` (the
  type system now rejects `toast('error', …)`). Top-right, **5000 ms**, max **3**
  stacked (oldest dropped), dismissible, `role="status"`.
- Banner/Alert = errors, validation, sync failures, stale state, decisions.
  `Alert` gains variants `error | warning | info | success`, optional title,
  optional dismiss. Placement: page header for global, card-level for section
  errors, field-level text for validation.
- `flash()` in Settings (third pathway) deleted → toast for success, Alert for error.
- Every former `toast('error')` call site now sets persistent inline error state.

### Tables (P1, P7, mobile)

`<DataTable>` in `src/components/ui/data-table.tsx`, built on the existing
`ui/table` primitives:

- Density: `compact` (text-xs, py-1.5), `dense` (text-sm, py-2, default),
  `wide` (text-sm, py-3).
- Numeric columns: `numeric: true` → right-aligned `font-mono tabular-nums`.
- Expand affordance: leading chevron column, row-click + keyboard toggles,
  `aria-expanded`; detail rendered full-width under the row.
- Sorting built in (`sortValue`), using existing SortIcon.
- Mobile (breakpoints): `priority` mode — priority 2 hidden < 640 px (sm),
  priority 3 hidden < 768 px (md); `scroll` mode — `-mx-4 sm:mx-0` horizontal
  scroll with **frozen first column** (sticky left); `cards` mode — rows become
  labeled cards < 640 px via `cardRender`.
- Built-in loading skeleton matching column structure, EmptyState, ErrorState.

Mode assignments: accounts=priority, holdings=scroll (wide), activity=scroll,
account txns/activity=priority, income/allocations=priority, projection=scroll,
classification=priority, asset-location=scroll.

### States (P8)

`src/components/ui/states.tsx`: `EmptyState {icon, title, description, action}`,
`ErrorState {title?, message, retry?}` (renders error Alert styling),
`LoadingState` (generic) — DataTable embeds table-shaped skeletons itself.
All `<p>Loading...</p>` and ad-hoc patterns replaced.

### CRUD pattern (P8) — side panel

**Side panel (Sheet) is the single create/edit pattern** for entities: add account,
income source, allocation/cashflow item, budget category & expense, account flow,
manual holdings entry. Chosen over modal because the right-side Sheet already
exists (holdings detail), preserves table context, and degrades well on mobile.
Recorded exception: assumption editing stays an inline row expansion — it is part
of the append-only audit/history disclosure surface (P7), not entity CRUD.
Micro-rename (budget category name) stays inline.

- Forms: visible labels always (no placeholder-only); validation **on blur**,
  never on keypress, cleared immediately when input becomes valid; errors as
  `text-loss text-xs` under the field + `aria-invalid`.
- Delete: `ConfirmDialog` (base-ui Dialog) naming the consequence in the confirm
  button ("Delete income source", "Remove member"); Cancel is focused/default;
  confirm uses `danger` variant.
- Primary "add" action: top-right of the owning card/section header, `primary`
  variant, labeled (icon+text), consistently.

### Assumptions destination (P3)

New top-level route `/assumptions` + sidebar nav item (after Planning).
Planning loses its tabs: `/planning` = projections + FI metrics + savings rates;
`/assumptions` = full-page assumptions (groups always visible, not collapsed),
scenario-aware, source badges + effective dates + history prominent.
Settings keeps Birthday / Target Retirement Age (profile record data, mirroring
Boldin's split) but gains a cross-link to /assumptions. **Flagged for Adam**: if
target retirement age should become a dated assumption record instead, that's a
data-model change out of scope for this pass.

### Scenario indicator (P4)

- `ScenarioProvider` (`src/lib/scenario-context.tsx`): id persisted in
  localStorage `ember-scenario`, initialized from `?scenario=` when present;
  /planning, /flows, /assumptions keep the URL param in sync for shareability.
- Global top bar (`src/components/layout/top-bar.tsx`) rendered on every app page:
  breadcrumbs left, scenario chip right.
- Non-baseline active → chip fills with `--scenario` violet ("Scenario: {name}")
  **and** the top bar gets a 2 px violet bottom band; baseline → quiet outline
  chip ("Base scenario").
- Chip popover explains shared vs scenario-specific data: "Scenarios change
  Flows, Planning, and Assumption overrides. Accounts, holdings, activity, and
  budget are shared."

### Breadcrumbs (P8)

In the top bar, derived from the path (static label map; account detail shows
"Accounts / {account name}" via SWR lookup). Single-level pages show "Home /
{Section}".

### Color redundancy (P6)

- GainCell keeps sign; PctCell keeps arrows; projection Growth + transactions
  amounts migrate to GainCell (sign + color, never color alone).
- LT/ST lot badges, type badges, on-track badges: text labels already present.

### Mobile Sankey (cross-cutting)

Below 640 px the Sankey is replaced by a vertically stacked flow list
(`MobileFlowList`) built from the same `SankeyData`: nodes grouped by category
with amounts; tapping a node expands its inbound/outbound links (details on
demand). Desktop Sankey unchanged.

### Verification tooling

`scripts/ui-screenshot.mjs` (playwright) captures any route at
1280×800 (desktop) and 390×844 (phone) in dark + light (sets `ember-theme`
localStorage + `.dark` class before load) with `NEXT_PUBLIC_DEV_BYPASS_AUTH=true`.

## Verification outcome (June 12, 2026)

Gates: `tsc --noEmit` clean, `eslint src` clean, 21/21 vitest, prettier clean.
Visual: all 9 routes captured in dark+light at 1280×800 and 390×844 via
`scripts/ui-screenshot.mjs` and reviewed; scenario-active treatment verified on
/planning, /assumptions, /accounts (violet chip + band, light + dark).
Two fresh-context verifier agents ran: a data-preservation audit (per-file git
diff — verdict: no figures, payloads, SWR params, or math changed; GainCell
sign prefixes are the one approved rendering change) and a principles audit
(all 8 PASS; all ten semantic colors measured ≥4.5:1 in both themes).
Verifier findings fixed afterward: BOM/mojibake in 3 auth pages (introduced by
a tooling step mid-pass), accounts Status column sort restored, projection
table now defaults to summary (P7), stale "Planning → Assumptions" tooltip
copy, DataTable keyboard a11y (sortable headers are buttons; clickable rows
focusable), NaN-safe sort comparator, cards-mode row index, flows empty Sankey
→ EmptyState, require-auth skeleton, login success message moved off the error
channel, single-open-editor rule in the assumptions panel (one primary per
view), effective-date required validation, Escape closes the scenario menu.

Accepted (documented, not fixed):

- Scroll-mode frozen first column uses an opaque `bg-card` below 640 px, which
  doesn't match zebra/hover striping on those rows (cosmetic).
- Scenario context hydrates from localStorage in an effect, so the first
  render of /planning//flows can briefly fetch baseline data before the stored
  scenario kicks in.
- DataTable `mobile="cards"` has no consumer yet; its loading state renders
  the table shell rather than card skeletons.
- Breadcrumbs are desktop-only; the mobile header shows the page title.
- Accounts "Type" column is priority 3 (hidden < 768 px) — was always visible.
- Quick-start numeric inputs changed `step` → `"any"`: the old
  `min="1" step="1000"` made round entries like 120000 fail native validation.

## Flagged for Adam (decisions to revisit)

1. **Target Retirement Age stays in Settings** (profile record), with a
   cross-link to /assumptions. If it should become a dated assumption record,
   that's a data-model change beyond this presentation pass.
2. **RequireAuth treats any household-fetch error as "no household"** and
   bounces to /onboarding (`src/lib/require-auth.tsx:20-21`) — a transient API
   401 mid-session sends a logged-in user to onboarding. Auth-flow logic, out
   of scope here, but it surfaced repeatedly during screenshot runs.
3. **"Add allocation" is secondary** (income card's "Add income source" holds
   the flows page's single primary) — swap if allocations are the more common
   action.

## Content relocations (review these)

1. Assumptions panel: Planning "settings" tab → new `/assumptions` page (all content preserved).
2. FI metrics cards + savings rates + FI portfolio value: Planning "settings" tab → Planning main page (below projections).
3. Scenario selector: per-page header → global top bar (still controls the same `?scenario=` data).
4. Toast position: bottom-right → top-right.
5. Settings: no fields removed; cross-link added to /assumptions.
