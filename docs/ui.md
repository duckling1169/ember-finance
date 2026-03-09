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
| Icons       | Lucide React              | Default for shadcn, consistent stroke style       |
| Charts      | Recharts                  | Simple API, good for line/area/bar/pie            |
| Data tables | @tanstack/react-table     | Sorting, filtering, pagination, column visibility |
| Forms       | react-hook-form + zod     | Validation shared with API via shared/types       |
| Styling     | Tailwind 4                | Already installed; replace all inline styles      |
| Fonts       | Geist (sans) + Geist Mono | Already configured in layout.tsx                  |

## Typography

**Font stack (already in place):**

- **Body / UI:** Geist Sans (`--font-geist-sans`) — clean, modern, good number rendering
- **Code / data:** Geist Mono (`--font-geist-mono`) — for account numbers, raw values, code

**Scale (Tailwind defaults):**

| Use                    | Class                                 | Size |
| ---------------------- | ------------------------------------- | ---- |
| Page title             | `text-2xl font-semibold`              | 24px |
| Section heading        | `text-lg font-medium`                 | 18px |
| Card title             | `text-base font-medium`               | 16px |
| Body                   | `text-sm`                             | 14px |
| Caption / label        | `text-xs text-muted-foreground`       | 12px |
| Big number (hero stat) | `text-3xl font-semibold tabular-nums` | 30px |

**Rules:**

- Financial numbers always use `tabular-nums` (monospaced digits for column alignment)
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

### Cards

Every discrete data group lives in a shadcn `Card`. Cards have:

- `CardHeader` with `CardTitle` and optional `CardDescription`
- `CardContent` for the body
- Optional `CardFooter` for actions
- No excessive nesting — flat card > card-in-card

### Data Tables

Use `@tanstack/react-table` with shadcn's `Table` styling:

- Sticky header
- Alternating row shading (subtle, via `even:bg-muted/50`)
- Right-align all number columns
- Sortable columns show sort indicator
- Filter bar above table, not inside it

### Forms

- Labels above inputs (not beside)
- Validation errors below the field in `text-destructive text-xs`
- Primary action button right-aligned at form bottom
- Destructive actions use `variant="destructive"` with confirmation dialog

### Charts

- Consistent padding and axis styling across all charts
- Tooltip on hover showing exact values
- Muted grid lines (`stroke: var(--border)`)
- No chart junk — no 3D, no gradients, no unnecessary legends
- Responsive container via `ResponsiveContainer`

### Empty States

When a section has no data:

- Centered illustration or icon (muted)
- Short heading explaining what will appear
- CTA button to add data (e.g., "Add your first account")

## App Shell

### Sidebar Navigation

```
┌─────────────────────┐
│  FIRE               │  ← App name, text-lg font-semibold
│                     │
│  Dashboard          │  ← nav items: icon + label
│  Accounts           │
│  Holdings           │
│  Performance        │
│  Transactions       │
│                     │
│  ─────────────────  │  ← separator
│  Settings           │
│                     │
│  ─────────────────  │
│  [Avatar] Adam      │  ← user info + sign out
│  owner              │
└─────────────────────┘
```

- Fixed left sidebar, `w-64`
- Collapsible to icon-only `w-16` (persist preference in localStorage)
- Active route highlighted with `bg-accent` + `text-accent-foreground`
- Mobile: sidebar becomes a slide-out sheet (shadcn `Sheet`)

### Top Bar (mobile only)

On viewports < `lg`:

- Hamburger button to open sidebar sheet
- Page title centered
- User avatar right

## Pages

### `/dashboard` — Overview

The home screen. At a glance: how much do I have, how is it allocated, how has it changed.

**Layout:**

```
┌──────────────────────────────────────────────┐
│ Net Worth          Total Holdings            │
│ $1,234,567         $987,654                  │
│ +2.3% MTD          +$12,345 today            │
├──────────────────┬───────────────────────────│
│ Allocation       │ Net Worth Over Time       │
│ [donut chart]    │ [area chart, 1Y default]  │
│                  │                           │
├──────────────────┴───────────────────────────│
│ Accounts                                     │
│ ┌─────────────────────────────────────────┐  │
│ │ Name    │ Type    │ Balance  │ Change   │  │
│ │ Fidelity│ 401k    │ $456,789 │ +1.2%    │  │
│ │ Chase   │ Checking│ $12,345  │ —        │  │
│ └─────────────────────────────────────────┘  │
└──────────────────────────────────────────────┘
```

### `/accounts` — Account List

All accounts with balances, type badges, linked sources, and actions.

### `/accounts/[id]` — Account Detail

Tabbed view: **Overview** (balance chart + summary), **Transactions** (table), **Holdings** (for investment accounts), **Sources** (linked data sources).

### `/holdings` — Cross-Account Holdings

All investment positions aggregated across accounts. Columns: symbol, name, shares, price, market value, cost basis, gain/loss, allocation %.

### `/performance` — Portfolio Performance

Line chart of portfolio value over time. Date range selector (1M, 3M, 6M, YTD, 1Y, 3Y, 5Y, All). Benchmark comparison toggle (S&P 500). Breakdown by account or asset class.

### `/transactions` — All Transactions

Full transaction table across all accounts. Filters: date range, account, category, amount range, source. Search by description. Dedup review: flagged duplicates shown with accept/reject actions.

### `/settings` — Settings

Tabbed: **Household** (name, tax status, state), **Profile** (personal details, retirement targets), **Members** (list, invite, remove), **Data** (export, danger zone).

### `/login` — Authentication

Centered card with email/password form, sign-up toggle. Clean, minimal. Dev login button only in development.

### `/onboarding` — Setup Wizard

Multi-step form (not one giant page):

1. **Household** — name, tax filing status, state
2. **Profile** — name, birthday, retirement age, income, employment, risk tolerance
3. **Done** — confirmation + redirect to dashboard

Progress indicator at top. Back/Next buttons. Each step validates before advancing.

## Responsive Breakpoints

| Breakpoint | Width  | Behavior                        |
| ---------- | ------ | ------------------------------- |
| `sm`       | 640px  | Stack cards vertically          |
| `md`       | 768px  | 2-column card grids             |
| `lg`       | 1024px | Sidebar visible, 3-column grids |
| `xl`       | 1280px | Max content width reached       |

## Accessibility

- All interactive elements keyboard-navigable (Radix handles this)
- Focus rings visible (`ring-2 ring-ring ring-offset-2`)
- Color is never the only indicator (gain/loss also uses +/- prefix)
- Minimum contrast ratios met by shadcn theme defaults
- Chart data accessible via table fallback or ARIA labels

## File Organization

```
src/
├── app/
│   ├── (auth)/              # Auth group (no sidebar)
│   │   ├── login/page.tsx
│   │   └── onboarding/page.tsx
│   ├── (app)/               # Authenticated group (with sidebar)
│   │   ├── layout.tsx       # Sidebar + main content shell
│   │   ├── dashboard/page.tsx
│   │   ├── accounts/
│   │   │   ├── page.tsx
│   │   │   └── [id]/page.tsx
│   │   ├── holdings/page.tsx
│   │   ├── performance/page.tsx
│   │   ├── transactions/page.tsx
│   │   └── settings/page.tsx
│   ├── layout.tsx           # Root layout (fonts, providers)
│   ├── page.tsx             # Redirect logic
│   └── globals.css          # Theme variables + Tailwind
├── components/
│   ├── ui/                  # shadcn/ui primitives (button, card, table, etc.)
│   ├── charts/              # Recharts wrappers (net-worth-chart, allocation-donut, etc.)
│   ├── data-tables/         # Table column definitions + table components
│   └── forms/               # Form components (account-form, transaction-form, etc.)
├── hooks/                   # Custom React hooks
└── lib/                     # Utilities (existing: api.ts, supabase.ts, auth-context.tsx)
```
