# FIRE App — UI & Design System

## Design Philosophy

Clean, data-dense, and functional. This is a tool for people who track investments seriously — not a marketing site. Prioritize clarity, scanability, and information density over decoration. Every pixel should serve comprehension.

**Guiding principles:**

- **Data-forward** — numbers, charts, and tables are the UI, not decoration around them
- **Quiet chrome** — navigation, headers, and controls recede; content leads
- **Consistent rhythm** — spacing, sizing, and color follow a predictable system
- **Dark-mode native** — designed for dark mode first; light mode is the alternate
- **Responsive but desktop-primary** — most usage is desktop; mobile should work but isn't the optimization target

## Stack

| Layer       | Choice                    | Notes                                             |
| ----------- | ------------------------- | ------------------------------------------------- |
| Components  | shadcn/ui                 | Radix primitives + Tailwind, copy-paste ownership |
| Icons       | Tabler Icons              | 5000+ icons, 2px stroke, MIT license              |
| Charts      | Tremor                    | Tailwind-native, lightweight, modern defaults     |
| Data tables | @tanstack/react-table     | Sorting, filtering, pagination, column visibility |
| Forms       | react-hook-form + zod     | Validation shared with API via shared/types       |
| Styling     | Tailwind 4                | Already installed; replace all inline styles      |
| Fonts       | Inter + Roboto Mono       | Inter for UI, Roboto Mono for data/numbers        |

## Typography

### Font Stack

- **UI / Body:** Inter (`--font-inter`) — clean, screen-optimized, excellent at all sizes
- **Data / Numbers:** Roboto Mono (`--font-roboto-mono`) — neutral monospace, clear digit shapes, readable at small sizes

**Usage split:**

| Context | Font | Why |
| --- | --- | --- |
| Navigation, headings, buttons, labels, body copy | Inter | Clean readability for all UI text |
| Table cells, dollar amounts, percentages, chart axis labels, chart tooltips, account numbers | Roboto Mono | Aligned columns, unambiguous digits at 12px+ |

### Scale

| Use                    | Class                                              | Size | Font |
| ---------------------- | -------------------------------------------------- | ---- | ---- |
| Page title             | `text-2xl font-semibold`                           | 24px | Inter |
| Section heading        | `text-lg font-medium`                              | 18px | Inter |
| Card title             | `text-base font-medium`                            | 16px | Inter |
| Body                   | `text-sm`                                          | 14px | Inter |
| Caption / label        | `text-xs text-muted-foreground`                    | 12px | Inter |
| Big number (hero stat) | `text-3xl font-semibold tabular-nums font-mono`    | 30px | Roboto Mono |
| Table cell (data)      | `text-sm font-mono tabular-nums`                   | 14px | Roboto Mono |
| Chart axis label       | `text-xs font-mono`                                | 12px | Roboto Mono |
| Chart tooltip value    | `text-sm font-mono tabular-nums`                   | 14px | Roboto Mono |

### Readability Rules

- **Minimum 12px** for any text — no exceptions (chart labels, table cells, footnotes)
- **`tabular-nums`** on all number columns so digits align vertically
- **`font-feature-settings: 'tnum'`** as CSS fallback where Tailwind shortcut isn't available
- **Medium weight (500)** for table headers, regular (400) for cell data
- **Line height:** `leading-relaxed` (1.625) for body text, `leading-normal` (1.5) for table rows
- **Letter-spacing:** `tracking-wide` on ALL CAPS labels only

### Number Formatting

- Financial numbers always use Roboto Mono with `tabular-nums`
- Negative values: red text, prefixed with `-$` (not parentheses)
- Positive gains: green text, prefixed with `+$` or `+%`
- Neutral/zero: muted foreground, no prefix

## Color System

Premium dark aesthetic — modern, sleek, refined. Built on shadcn/ui's CSS variable system with HSL values in `globals.css`. Both dark and light modes are fully designed (not an afterthought).

**Accent color:** Indigo/purple — distinctive, premium feel.

### Dark Mode (default)

| Role                      | Token                  | Value                    | Tailwind / Hex |
| ------------------------- | ---------------------- | ------------------------ | -------------- |
| Page background           | `--background`         | `zinc-950`               | `#09090b`      |
| Card / surface            | `--card`               | `zinc-900`               | `#18181b`      |
| Elevated (popover, modal) | `--popover`            | `zinc-800`               | `#27272a`      |
| Borders                   | `--border`             | `zinc-800 / 50% opacity` | `#27272a80`    |
| Primary text              | `--foreground`         | `zinc-50`                | `#fafafa`      |
| Secondary text            | `--muted-foreground`   | `zinc-400`               | `#a1a1aa`      |
| Accent (buttons, active)  | `--primary`            | `indigo-400`             | `#818cf8`      |
| Accent hover              | —                      | `indigo-300`             | `#a5b4fc`      |
| Accent text on accent bg  | `--primary-foreground` | `zinc-950`               | `#09090b`      |
| Secondary button          | `--secondary`          | `zinc-800`               | `#27272a`      |
| Muted / disabled bg       | `--muted`              | `zinc-800`               | `#27272a`      |
| Destructive               | `--destructive`        | `red-500`                | `#ef4444`      |
| Input borders             | `--input`              | `zinc-700`               | `#3f3f46`      |
| Focus ring                | `--ring`               | `indigo-400`             | `#818cf8`      |

### Light Mode

| Role                      | Token                  | Value        | Tailwind / Hex |
| ------------------------- | ---------------------- | ------------ | -------------- |
| Page background           | `--background`         | `zinc-50`    | `#fafafa`      |
| Card / surface            | `--card`               | `white`      | `#ffffff`      |
| Elevated (popover, modal) | `--popover`            | `white`      | `#ffffff`      |
| Borders                   | `--border`             | `zinc-200`   | `#e4e4e7`      |
| Primary text              | `--foreground`         | `zinc-900`   | `#18181b`      |
| Secondary text            | `--muted-foreground`   | `zinc-500`   | `#71717a`      |
| Accent (buttons, active)  | `--primary`            | `indigo-600` | `#4f46e5`      |
| Accent hover              | —                      | `indigo-700` | `#4338ca`      |
| Accent text on accent bg  | `--primary-foreground` | `white`      | `#ffffff`      |
| Secondary button          | `--secondary`          | `zinc-100`   | `#f4f4f5`      |
| Muted / disabled bg       | `--muted`              | `zinc-100`   | `#f4f4f5`      |
| Destructive               | `--destructive`        | `red-600`    | `#dc2626`      |
| Input borders             | `--input`              | `zinc-300`   | `#d4d4d8`      |
| Focus ring                | `--ring`               | `indigo-600` | `#4f46e5`      |

### Finance-Specific Colors

| Token       | Purpose                | Dark Mode             | Light Mode            |
| ----------- | ---------------------- | --------------------- | --------------------- |
| `--gain`    | Positive returns, up   | `green-500` `#22c55e` | `green-600` `#16a34a` |
| `--loss`    | Negative returns, down | `red-500` `#ef4444`   | `red-600` `#dc2626`   |
| `--neutral` | Zero change, flat      | `--muted-foreground`  | `--muted-foreground`  |

### Asset Class Colors (for charts)

Consistent across both themes. Chosen to be distinguishable and avoid clashing with gain/loss red/green.

| Asset Class  | Color   | Hex       |
| ------------ | ------- | --------- |
| Equity       | Blue    | `#3b82f6` |
| Fixed Income | Amber   | `#f59e0b` |
| Cash         | Slate   | `#94a3b8` |
| Real Estate  | Emerald | `#10b981` |
| Crypto       | Violet  | `#a855f7` |
| Commodity    | Orange  | `#f97316` |
| Other        | Gray    | `#6b7280` |

### Semantic Tokens (reference)

All shadcn components use these tokens. The values above map to them:

| Token                                        | Purpose                               |
| -------------------------------------------- | ------------------------------------- |
| `--background` / `--foreground`              | Page-level bg and text                |
| `--card` / `--card-foreground`               | Card surfaces                         |
| `--popover` / `--popover-foreground`         | Dropdowns, tooltips, modals           |
| `--primary` / `--primary-foreground`         | Primary buttons, active states        |
| `--secondary` / `--secondary-foreground`     | Secondary buttons, subtle backgrounds |
| `--muted` / `--muted-foreground`             | Disabled states, captions, labels     |
| `--accent` / `--accent-foreground`           | Hover states, nav highlights          |
| `--destructive` / `--destructive-foreground` | Delete, error states                  |
| `--border`                                   | Borders, dividers                     |
| `--input`                                    | Form input borders                    |
| `--ring`                                     | Focus rings                           |

## Spacing & Layout

**Base unit:** 4px (Tailwind's default `1` = 0.25rem = 4px)

**Page structure:**

```
┌──────────────────────────────────────────────────┐
│ Sidebar (w-64, collapsible to w-16)              │
│ ┌──────────────────────────────────────────────┐ │
│ │ Main content area                            │ │
│ │ max-w-7xl mx-auto px-6 py-6                  │ │
│ │                                              │ │
│ │ ┌────────────┐ ┌────────────┐ ┌────────────┐ │ │
│ │ │ Card       │ │ Card       │ │ Card       │ │ │
│ │ │ p-6        │ │ p-6        │ │ p-6        │ │ │
│ │ └────────────┘ └────────────┘ └────────────┘ │ │
│ │ gap-6 between cards                          │ │
│ └──────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────┘
```

**Spacing conventions:**

| Context             | Spacing | Tailwind    |
| ------------------- | ------- | ----------- |
| Page padding        | 24px    | `p-6`       |
| Card padding        | 24px    | `p-6`       |
| Gap between cards   | 24px    | `gap-6`     |
| Between sections    | 32px    | `mt-8`      |
| Between form fields | 16px    | `space-y-4` |
| Inline element gap  | 8px     | `gap-2`     |

## Component Patterns

### Surface Model

No borders. Hierarchy is created through **background color shifts** and **subtle shadows on interaction**. This applies universally across both themes — only the color values change, not the structure.

| Element | Rounding | Border | Shadow | Background |
| --- | --- | --- | --- | --- |
| Card / panel | `rounded-lg` (8px) | None | None at rest, `shadow-sm` on hover | One step above page bg |
| Input | `rounded-md` (6px) | Thin (`border border-input`) | None | Same as card bg |
| Primary button | `rounded-md` (6px) | None (solid fill) | None | Accent color fill |
| Secondary / ghost button | `rounded-md` (6px) | Subtle (`border border-border`) | None | Transparent or muted bg |
| Modal / popover | `rounded-lg` (8px) | None | `shadow-md` | One step above card bg |
| Table container | `rounded-lg` (8px) | None | None | Card bg |
| Badge / tag | `rounded-sm` (4px) | None | None | Muted bg |
| Dividers | — | — | — | Used sparingly, very faint, only for major section breaks |

**Background step-up (dark):** page `zinc-950` → card `zinc-900` → popover `zinc-800`
**Background step-up (light):** page `zinc-50` → card `white` → popover `white` (with `shadow-md`)

### Cards

Every discrete data group lives in a shadcn `Card`:

- `rounded-lg`, no border, bg one step above page
- No resting shadow — `shadow-sm` on hover only (via `hover:shadow-sm transition-shadow`)
- `CardHeader` with `CardTitle` and optional `CardDescription`
- `CardContent` for the body
- Optional `CardFooter` for actions
- No nesting — never put a card inside a card

### Data Tables

Use `@tanstack/react-table` with shadcn's `Table` styling:

- No borders, no row dividers — alternating row bg only
- Alternating rows: subtle shade difference (`even:bg-muted/30` — barely visible)
- Sticky header row
- Right-align all number columns
- Sortable columns show sort indicator
- Filter bar above table, not inside it
- Table container gets `rounded-lg`, same bg as card

### Forms

- Labels above inputs (not beside)
- Inputs have thin border for affordance (`border border-input`), `rounded-md`
- Validation errors below the field in `text-destructive text-xs`
- Primary action button right-aligned at form bottom
- Destructive actions use `variant="destructive"` with confirmation dialog

### Charts

**Library:** Tremor (Tailwind-native, lightweight, modern defaults)

**Chart types:**

| Type | Use |
| --- | --- |
| Line | Performance over time, benchmark comparison |
| Area | Net worth over time |
| Stacked area | Breakdown by account or asset class over time |
| Donut | Allocation percentages |

**Styling:**

- No grid lines by default (option to enable in profile/settings)
- No chart junk — no 3D, no gradients, no unnecessary legends
- Minimal axis labels (start/end dates, key values) — details TBD per chart
- Colors: use asset class palette for breakdowns, accent color for single-series
- Responsive container

**Interaction:**

- Tooltip on hover for line/area/stacked area — shows exact values in Roboto Mono
- No tooltip on donut (labels visible directly)
- Date range selector below chart: button row (1M, 3M, YTD, 1Y, All) + custom range picker

**Loading:**

- Skeleton/shimmer animation while chart data loads
- Charts do not animate data on entry — data appears ready

### Empty States

When a section has no data:

- Centered icon (muted, from Tabler Icons)
- Short heading explaining what will appear
- CTA button to add data (e.g., "Add your first account")

## App Shell

### Icons

**Tabler Icons** (`@tabler/icons-react`) — 5000+ icons, consistent 2px stroke, MIT license. Used for all nav items, actions, and UI elements.

### Sidebar Navigation

```
┌─────────────────────┐
│  FIRE               │  ← App name, clickable → navigates to /
│                     │
│  Accounts           │  ← icon + label
│  Investments        │
│  Profile            │
│                     │
│  [Avatar] Adam      │  ← user info + sign out
└─────────────────────┘
```

- App name/logo is the home button — no separate home nav item
- 3 nav items only: Accounts, Investments, Profile

**Behavior:**

- `w-60` (240px) when pinned open
- **Pin/hide model:** sidebar is hideable, not just collapsible
  - User can **pin** it open (stays visible, content shifts right)
  - User can **unpin/hide** it (sidebar disappears, content takes full width)
  - Reveal hidden sidebar by hovering near left edge or keyboard shortcut (`Cmd+/`)
  - When revealed but not pinned, sidebar overlays content as a floating panel with `shadow-md`
  - Pin/unpin preference persisted in `localStorage`
- No border on sidebar — uses bg color shift from page (same surface model as cards)
- Active nav item: `bg-muted` highlight, `rounded-md`
- Mobile (`< lg`): sidebar becomes a slide-out sheet (shadcn `Sheet`), triggered by hamburger button

**No top bar on desktop.** Sidebar is the only chrome. On mobile, a minimal bar with hamburger + page title + avatar.

## Pages

### `/` — Home

The landing page. Big picture: what's my net worth and what are my accounts.

**Layout:**

```
┌──────────────────────────────────────────────┐
│ Net Worth Chart                              │
│ [area chart, date range selector]            │
│ $1,234,567 current value                     │
│                                              │
├──────────────────────────────────────────────│
│ Accounts                                     │
│ [sortable, filterable table]                 │
│ Name    │ Type    │ Balance  │ Change  │ ... │
│ Fidelity│ 401k    │ $456,789 │ +1.2%   │     │
│ Chase   │ Checking│ $12,345  │ —       │     │
└──────────────────────────────────────────────┘
```

- Net worth chart: area chart showing total net worth over time, date range selector
- Accounts table: sortable columns, filterable — more columns TBD as features grow

### `/accounts` — Account List

All accounts with balances, type badges, linked sources, and actions.

### `/accounts/[id]` — Account Detail

Tabbed view: **Overview** (balance chart + summary), **Transactions** (table), **Holdings** (for investment accounts), **Sources** (linked data sources).

### `/investments` — Investments

Combined view of holdings and performance across all accounts.

- Holdings table: symbol, name, shares, price, market value, cost basis, gain/loss, allocation %
- Performance chart: line chart over time, date range selector, benchmark comparison toggle
- Breakdown by account or asset class

*Details TBD — will flesh out as we build.*

### `/profile` — Profile

Replaces settings. User-facing config:

- **Personal** — name, birthday, retirement age, income, employment, risk tolerance
- **Household** — name, tax filing status, state
- **Members** — list, invite, remove household members
- **Data** — export, danger zone

### `/login` — Authentication

Centered card with email/password form, sign-up toggle. Clean, minimal. Dev login button only in development.

### `/onboarding` — Setup Wizard

Multi-step form:

1. **Household** — name, tax filing status, state
2. **Profile** — name, birthday, retirement age, income, employment, risk tolerance
3. **Done** — confirmation + redirect to `/`

Progress indicator at top. Back/Next buttons. Each step validates before advancing.

## Responsive Behavior

**Desktop-primary.** Mobile should be functional, not optimized.

| Breakpoint | Width  | Behavior                        |
| ---------- | ------ | ------------------------------- |
| `sm`       | 640px  | Stack cards vertically          |
| `md`       | 768px  | 2-column card grids             |
| `lg`       | 1024px | Sidebar visible, multi-column grids |
| `xl`       | 1280px | Max content width reached       |

**Mobile handling:**

- Tables: horizontal scroll, not card-collapse (keeps it simple for MVP)
- Charts: scale down in container, no layout changes
- Sidebar: hidden, accessible via hamburger → sheet overlay
- Minimal top bar on mobile: hamburger + page title + avatar

## Accessibility

MVP defaults — rely on Radix/shadcn built-ins, don't over-engineer.

- All interactive elements keyboard-navigable (Radix handles this)
- Focus rings visible (`ring-2 ring-ring ring-offset-2`)
- Color is never the only indicator (gain/loss uses +/- prefix, icons where applicable)
- Minimum contrast ratios met by theme defaults
- Semantic HTML: proper headings, landmarks, button vs link distinction
- `prefers-reduced-motion`: respect OS setting, disable chart loading animations
- WCAG 2.1 AA compliance as baseline target

## File Organization

```
src/
├── app/
│   ├── (auth)/              # Auth group (no sidebar)
│   │   ├── login/page.tsx
│   │   └── onboarding/page.tsx
│   ├── (app)/               # Authenticated group (with sidebar)
│   │   ├── layout.tsx       # Sidebar + main content shell
│   │   ├── page.tsx         # / — Home (net worth + accounts)
│   │   ├── accounts/
│   │   │   ├── page.tsx
│   │   │   └── [id]/page.tsx
│   │   ├── investments/page.tsx
│   │   └── profile/page.tsx
│   ├── layout.tsx           # Root layout (fonts, providers)
│   ├── page.tsx             # Redirect / auth check
│   └── globals.css          # Theme variables + Tailwind
├── components/
│   ├── ui/                  # shadcn/ui primitives (button, card, table, etc.)
│   ├── charts/              # Recharts wrappers (net-worth-chart, allocation-donut, etc.)
│   ├── data-tables/         # Table column definitions + table components
│   └── forms/               # Form components (account-form, transaction-form, etc.)
├── hooks/                   # Custom React hooks
└── lib/                     # Utilities (existing: api.ts, supabase.ts, auth-context.tsx)
```
