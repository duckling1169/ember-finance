# Ember — Backlog

> Ordered roughly by priority within each tier. Items may shift as needs change.

---

## Tier 1 — Core Gaps (high-value features the app needs to feel complete)

### 1.1 Transaction History UI

**Status:** DONE (June 2026) — Transactions/Activity tab on account detail with search, pagination, and hide/unhide of duplicates. Remaining nice-to-haves: inline category editing, date-range filter.

**Original scope (for reference):**
**Why:** Transactions exist in the DB (ingested via CSV/manual), but there's no way to browse them. This is table-stakes for a finance app.

**Scope:**

- Transaction table on the account detail page (new tab or integrate into History tab)
  - Columns: Date, Description, Amount, Category, Source, Hidden status
  - Sortable, filterable (by date range, category, amount)
  - Search by description
- Inline category editing (click to set/change category)
- Show/hide hidden transactions toggle (ties into existing `/api/duplicates` endpoints)
- Unhide/hide actions on individual rows
- Investment activity table for investment-type accounts
  - Columns: Date, Type, Symbol, Quantity, Price, Amount, Commission
  - Same sort/filter/search patterns

**API endpoints (already exist):**

- `GET /api/duplicates/transactions/:householdId/:accountId` — hidden txns
- `GET /api/duplicates/activity/:householdId/:accountId` — hidden activity
- `POST /api/duplicates/hide|unhide/transaction|activity/:id`
- Need: `GET /api/transactions/:householdId/:accountId` — visible txns (may need a new route, or query directly)

---

### 1.2 Investment Performance Page

**Status:** Holdings page exists, performance tracking does not
**Why:** The app is investment-first (Decision 001). Seeing holdings is only half — users need performance over time.

**Scope:**

- `/investments` page (or enhance existing `/holdings`)
- Performance chart: line chart showing portfolio value over time
  - Derived from holding snapshots × security prices over time
  - Date range selector (1M, 3M, YTD, 1Y, All)
- Benchmark comparison toggle (S&P 500 / total market)
  - Requires storing benchmark price history in `security_price`
- Return metrics: total return, annualized return, time-weighted return
- Breakdown views: by account, by asset class, by individual holding
- Dividend income summary (from `investment_activity` where `activity_type = 'dividend'`)

**Dependencies:**

- Historical security prices (currently only latest price in `security_price`)
- May need a `security_price_history` table or expand `security_price` to store daily close
- Benchmark data source (Yahoo Finance, Polygon, etc.)

---

### 1.3 Account Linking — Teller (Banking)

**Status:** Adapters planned, not implemented. TODO in accounts page.
**Why:** Manual entry and CSV work, but auto-sync is the path to a "set and forget" experience.

**Scope:**

- Teller Connect integration (embedded widget for account selection)
- mTLS setup for API calls (certs already gitignored, env vars defined)
- Teller adapter implementing `ProviderAdapter.sync()`
  - Fetch transactions, balances
  - Map to `NormalizedTransaction` / `NormalizedBalance`
- Webhook receiver for push updates
- Source management UI: connect, disconnect, re-auth
- Error handling: expired tokens, institution downtime

**Dependencies:**

- Teller developer account + approved application
- mTLS certificate + private key
- Webhook endpoint (needs public URL or tunnel for dev)

---

### 1.4 Account Linking — SnapTrade (Brokerage)

**Status:** Adapters planned, not implemented
**Why:** Same as Teller — auto-sync for investment accounts.

**Scope:**

- SnapTrade Connection Portal (embedded widget)
- SnapTrade adapter implementing `ProviderAdapter.sync()`
  - Fetch holdings, positions, balances, activity
  - Map to `NormalizedHolding` / `NormalizedInvestmentActivity` / `NormalizedBalance`
- Webhook receiver or daily pull
- Holdings snapshot refresh
- Tax lot creation from synced activity
- Source management UI (same patterns as Teller)

**Dependencies:**

- SnapTrade API credentials (client ID + secret)
- User connection authorization flow

---

## Tier 2 — Important Enhancements (makes the app significantly better)

### 2.1 Security Price Service

**Status:** `security_price` table exists but only populated during ingest
**Why:** Stale prices = stale portfolio values. Needed for performance charts and accurate net worth.

**Scope:**

- Daily price refresh job (pg_cron or scheduled API call)
- Price data source: Yahoo Finance API, Polygon, or Alpha Vantage
- Historical price backfill for performance charts
- Price history storage (new table or expand `security_price`)
- Handle market holidays, weekends (carry forward last close)
- Benchmark index prices (SPY, VTI) for comparison charts

---

### 2.2 Net Worth Snapshot Automation

**Status:** Dropped for MVP (Decision 028) — net worth is computed live from balance snapshots. Revisit if request-time aggregation gets slow.
**Why:** Dashboard net worth chart reads from `net_worth_snapshot` — needs to be populated regularly.

**Scope:**

- pg_cron job to run `compute_net_worth_snapshot()` daily
- Trigger on-ingest: recompute after any data import
- Backfill historical snapshots from existing balance/holding data
- Handle gaps gracefully (carry forward last known value)

---

### 2.3 Dashboard Placeholder Cards

**Status:** Resolved — the dashboard no longer ships placeholder cards. The ideas below remain candidates for new cards.
**Why:** They're visible and empty — either build them or remove them.

**Cards:**

- **Salary Deferral** — contribution allocation across accounts (401k, IRA, HSA)
  - Needs: contribution tracking, annual limits by account type
- **Tax Buckets by Inflow** — yearly contribution breakdown by tax treatment
  - Needs: same contribution data, grouped by tax_bucket
- **Tax Buckets Over Time** — projected growth by tax treatment
  - Needs: projection logic (simple compound growth or Monte Carlo)
- **Spending by Category** — transaction category analysis
  - Needs: transaction UI (1.1) first, then aggregate by category

---

### 2.4 CSV Format Auto-Detection

**Status:** CSV adapter requires user to select format
**Why:** Reduces friction — upload a file, system figures out the format.

**Scope:**

- Header signature matching (already partially implemented)
- Confidence scoring for ambiguous formats
- Fallback to manual format selection
- Preview parsed data before confirming import

---

## Tier 3 — Quality of Life

### 3.1 Bulk Account Actions

- Archive/deactivate accounts
- Bulk category assignment for transactions
- Merge duplicate accounts

### 3.2 Data Export

- Export transactions to CSV
- Export holdings snapshot
- Export full account history
- Profile > Data section already has placeholder

### 3.3 Mobile Optimization

- Sidebar sheet overlay works, but tables and charts need responsive polish
- Card-collapse for tables on small screens (or horizontal scroll refinement)
- Touch-friendly chart interactions

### 3.4 Light Mode Polish

- Theme toggle exists in settings
- Verify all components render correctly in light mode
- Check contrast ratios match WCAG 2.1 AA

### 3.5 Notification & Alerts

- Large balance changes
- Unusual transactions
- Sync failures
- In-app notification center or email digest

---

## Tier 4 — Future / Phase 2

### 4.1 PDF Parsing

- Statement import from PDF (brokerage statements, tax documents)
- Likely Python sidecar or LLM extraction (per architecture doc)
- Institution-specific parsers (Fidelity, Vanguard, Schwab statements)

### 4.2 Monte Carlo Projections

- Retirement projection using current portfolio, contributions, and expected returns
- Configurable assumptions (return rate, inflation, Social Security)
- Visualization: fan chart showing probability ranges

### 4.3 Tax Optimization Tools

- Tax-loss harvesting suggestions (identify positions with unrealized losses)
- Asset location optimization (which holdings in which tax bucket)
- Estimated tax liability from realized gains (via `lot_disposition`)

### 4.4 Rebalancing

- Target allocation by asset class
- Drift analysis (current vs target)
- Suggested trades to rebalance

### 4.5 Multi-Currency Support

- `currency` field exists on most tables
- Exchange rate service
- Portfolio value in base currency with per-holding original currency

---

## Done (for reference)

- [x] Login + auth flow (email/password, dev bypass)
- [x] Onboarding wizard (household + profile setup)
- [x] Sidebar navigation (pin/unpin, mobile sheet)
- [x] Dashboard (net worth chart, donut charts, account summary)
- [x] Accounts list page (sortable table, add manual account)
- [x] Account detail page (balance chart, history timeline, manual entry, CSV upload)
- [x] Holdings page (multi-account, tax lot expansion, detail sidebar)
- [x] Settings page (profile, household, members, invites, theme)
- [x] Ingest pipeline (manual + CSV adapters, fingerprinting, dedup)
- [x] Cross-source duplicate detection with authority ranking
- [x] RLS on all tables
- [x] Shared types between frontend and API
