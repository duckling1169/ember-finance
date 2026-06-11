# Ember — Ingest Pipeline & Adapters

## Pipeline Overview

Every data source — live provider sync, CSV upload, manual entry — flows through the same pipeline:

```
Source (webhook / sync / file upload / manual entry)
  → Adapter.sync() or Adapter.parse()
  → Write raw payload to raw_ingest (immutable audit trail)
  → Normalize into IngestResult
  → UPSERT into canonical tables (dedup via unique constraints)
  → Run cross-source duplicate detection
  → Mark raw_ingest as processed
  → Update account_source.last_synced
```

One pipeline, one set of tests.

## Adapter Interface

```typescript
interface IngestResult {
  transactions: NormalizedTransaction[];
  investmentActivity: NormalizedInvestmentActivity[];
  balances: NormalizedBalance[];
  holdings: NormalizedHolding[];
}

interface ProviderAdapter {
  sync(account: Account, source: AccountSource): Promise<IngestResult>;
  parse?(file: Buffer, format: string): Promise<IngestResult>;
}
```

Every adapter emits the same `IngestResult` shape. The pipeline is source-agnostic.

## Current Contract Note

`POST /api/ingest/manual/:householdId/:accountId` currently expects normalized payload sections (`transactions`, `investmentActivity`, `balances`, `holdings`) that map directly to `IngestResult`.

The account-detail manual-entry UI still uses a legacy `entry_type/amount` payload shape and should be aligned to this normalized ingest contract.

## Normalized Shapes

```typescript
interface NormalizedTransaction {
  providerTxnId?: string; // From live providers
  date: string;
  amount: number; // Positive = inflow, negative = outflow
  description: string;
  category?: string;
  isTransfer?: boolean;
}

interface NormalizedInvestmentActivity {
  providerTxnId?: string;
  date: string;
  activityType:
    | 'buy'
    | 'sell'
    | 'dividend'
    | 'reinvestment'
    | 'split'
    | 'transfer_in'
    | 'transfer_out'
    | 'fee'
    | 'interest'
    | 'return_of_capital';
  symbol?: string;
  description?: string;
  quantity?: number;
  price?: number;
  amount: number;
  commission?: number;
  lotId?: string;
}

interface NormalizedBalance {
  date: string;
  balance: number;
  available?: number;
}

interface NormalizedHolding {
  asOf: string;
  symbol: string;
  name?: string;
  quantity: number;
  price?: number;
  marketValue: number;
  costBasis?: number;
  assetClass?:
    | 'equity'
    | 'fixed_income'
    | 'cash'
    | 'crypto'
    | 'real_estate'
    | 'commodity'
    | 'other';
}
```

## Adapters

### Manual (`api/src/adapters/manual.ts`)

Pass-through. Accepts pre-normalized data from the API and returns it as-is in an `IngestResult`.

### CSV (`api/src/adapters/csv.ts`)

Parses CSV files with institution-specific handling.

**Supported formats:**

| Format                | Type      | Notes                                            |
| --------------------- | --------- | ------------------------------------------------ |
| chase_checking        | Banking   | Amount sign as-is                                |
| chase_credit          | Banking   | Amount sign flipped (positive charge → negative) |
| fidelity_transactions | Brokerage | Activity type mapping                            |
| fidelity_positions    | Brokerage | Holdings snapshot                                |
| vanguard_transactions | Brokerage | Activity type mapping                            |
| vanguard_positions    | Brokerage | Holdings snapshot                                |
| schwab_transactions   | Brokerage | Strips footer summary rows                       |
| schwab_positions      | Brokerage | Holdings snapshot                                |
| generic_banking       | Banking   | Expects date, amount, description columns        |
| generic_brokerage     | Brokerage | Expects standard activity columns                |

**Features:**

- Header signature detection to identify institution format
- Metadata/disclaimer row stripping
- BOM stripping
- Date parsing: YYYY-MM-DD, MM/DD/YYYY, M/D/YYYY
- Amount parsing: handles `$`, commas, parenthesized negatives `(1,234.56)`
- Asset class inference from symbol (BND → fixed_income, BTC → crypto, etc.)
- Derives balance snapshots from holdings totals

### Teller (planned)

Live bank sync via mTLS. Will use `certificate.pem` and `private_key.pem` for mutual TLS authentication.

### SnapTrade (planned)

Brokerage sync via SnapTrade API. Will use client ID and secret from environment.

## Upsert Strategy

| Data Type           | Conflict Key                                          | Behavior                       |
| ------------------- | ----------------------------------------------------- | ------------------------------ |
| Transactions        | `(account_id, provider_txn_id)` if provider ID exists | Upsert, keep existing          |
| Transactions        | `(account_id, fingerprint)` for file/manual imports   | Upsert, keep existing          |
| Investment Activity | Same as transactions                                  | Same                           |
| Holdings            | `(account_id, as_of, symbol)`                         | Replace (latest snapshot wins) |
| Balance Snapshots   | `(account_id, date, source)`                          | Replace (latest value wins)    |

## Fingerprinting

For file imports and manual entry (no `provider_txn_id`), SHA-256 fingerprints provide idempotent dedup:

- **Transactions:** `SHA256(account_id | date | amount | description)`
- **Investment Activity:** `SHA256(account_id | date | activityType | amount | symbol)`

Implementation: `api/src/lib/fingerprint.ts`

## Cross-Source Duplicate Detection

After upsert, the pipeline runs duplicate detection across sources for the affected date range.

### Authority Ranking

Higher number = more authoritative. When two records from different sources match, the less authoritative one is auto-hidden.

| Source Type    | Authority |
| -------------- | --------- |
| manual_entry   | 1         |
| csv_upload     | 2         |
| pdf_parse      | 3         |
| snaptrade_sync | 4         |
| teller_sync    | 5         |

### Matching

- **Transactions:** grouped by (date, amount)
- **Investment Activity:** grouped by (date, amount, activity_type, symbol)

### Rules

| Group Size | Sources           | Action                                                                        |
| ---------- | ----------------- | ----------------------------------------------------------------------------- |
| 2 records  | Different sources | Auto-hide less authoritative (`hidden_reason: 'auto:cross_source_duplicate'`) |
| 3+ records | Any               | Flag for manual review (no auto-hide)                                         |
| Any        | Same source       | Skip (prevented by DB unique constraints)                                     |

### Manual Override

Users can hide/unhide records via the `/api/duplicates` endpoints. Manual hides use `hidden_reason: 'manual'`.

## Credential Encryption

Deferred until provider sync ships (Decision 029). The planned design is
application-level AES-256-GCM encryption of provider credentials before
storage (Decision 005); no encryption code exists today because nothing
stores credentials.
