# FIRE App — Decision Log

Architectural decisions, recorded when made. Append-only.

---

### 001 — App Focus: Investment-First

Portfolio construction, performance tracking, and allocation are primary. Net worth tracking is secondary. The data model, table structure, and query patterns all reflect this priority.

---

### 002 — Separate Tables for Transactions vs Investment Activity

Investment activity has fundamentally different fields (symbol, quantity, price, lot_id, activity_type) and different query patterns (performance by symbol, dividend history, cost basis per lot). Separate tables mean clean queries and clear intent. No polymorphic type column.

---

### 003 — Holdings as Provider Snapshots, Not Derived

Holdings are point-in-time snapshots from providers, not computed from investment_activity. Provider snapshots are ground truth. Activity explains _how_ you got there, but reconciling activity into positions is error-prone and unnecessary when the provider gives you the answer.

---

### 004 — Accounts Are Concepts, Sources Are Pipes

An account ("my Fidelity 401k") is a single entity. `account_source` represents data pipes (Teller, CSV, manual). One account can have multiple sources — e.g., SnapTrade for live sync + CSV for historical backfill. Dedup handles overlap.

---

### 005 — Application-Level Credential Encryption

Provider tokens encrypted with AES-256-GCM before storage in `account_source.provider_meta` (bytea). A database dump does not expose credentials. Key managed via environment variable.

---

### 006 — Append-Only Raw Ingestion

`raw_ingest` stores every payload exactly as received. Never mutated. Enables reprocessing without provider API calls. Status transitions: pending → processed/failed/skipped.

---

### 007 — Cross-Source Dedup with Authority Ranking

When the same transaction appears from multiple sources, the system auto-hides the less authoritative copy. Ranking: teller > snaptrade > pdf > csv > manual. Groups of 3+ are flagged for manual review rather than auto-resolved.

---

### 008 — Flat Category Taxonomy

Transaction categories are simple flat text with no enforced schema. Users can categorize however they want. No category tree, no predefined list. Keeps the model simple for a personal tool.

---

### 009 — Materialized Net Worth Snapshots

Net worth is computed daily (or on-ingest) and written to `net_worth_snapshot`. Dashboard reads this single table. Never computed on page load.

---

### 010 — One Household Per Auth User

Enforced by unique constraint on `member.auth_user_id` and a DB trigger (`trg_prevent_multi_household`). Simplifies the model — a user sees exactly one household's data.

---

### 011 — Partner Role is Always Owner

Per onboarding spec, invited partners join as `owner` role. The `viewer` role exists in the schema for future use but is not exposed in the invite flow.

---

### 012 — Invite Flow: 24-Hour TTL + Supabase Magic Link

Invites expire after 24 hours. The system sends a Supabase Auth magic link via `inviteUserByEmail`. If the user doesn't have an account, Supabase creates one. Expired invites require a re-invite. Duplicate pending invites to the same email are blocked.

---

### 013 — Onboarding Atomicity via Postgres RPC

`create_household_with_owner()` creates household + member in a single Postgres transaction. If member creation fails, the household is also rolled back. The API has a fallback path (sequential inserts with manual rollback) for environments where the RPC isn't available.

---

### 014 — Hono Backend Separate from Next.js Frontend

The API runs as a standalone Hono server (port 3001), separate from the Next.js frontend (port 3000). This keeps the API portable across runtimes and simplifies future mobile client support. Communication is REST over CORS.

---

### 015 — Provider Balance is Authoritative

When provider sync and manual/CSV balances coexist for the same date, provider balance wins. Manual and CSV-derived balances fill gaps for dates before a provider was linked.

---

### 016 — Documentation Split

Single `data-model-architecture.md` replaced with focused docs:

- `architecture.md` — philosophy, stack, project structure
- `schema.md` — database tables, constraints, RLS
- `api.md` — route reference, auth, request/response shapes
- `ingest-pipeline.md` — adapters, pipeline flow, dedup, encryption
- `decisions.md` — this file (append-only decision log)
