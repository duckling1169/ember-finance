import {
  ALLOCATION_BUCKETS,
  TAX_TREATMENTS,
  type AllocationBucket,
  type AllocationTarget,
  type AssetClass,
  type AccountType,
  type ClassificationSource,
  type CompositionBucket,
  type CompositionPosition,
  type AssetLocationRow,
  type PortfolioComposition,
  type TaxTreatment,
} from '../types/index';

/**
 * Pure portfolio-composition engine.
 *
 * Classifies every position into an allocation bucket, rolls buckets up
 * against targets/bands, and builds the asset-location matrix (bucket
 * value by tax treatment). Every classification is tagged with its
 * source so the UI can always explain why a position landed where it
 * did — auditability over cleverness.
 */

/**
 * Common international index funds/ETFs. Brokerages report these as
 * plain `equity`, so symbol recognition is the only way to separate
 * international from US stock without external data.
 */
const INTL_FUND_SYMBOLS: ReadonlySet<string> = new Set([
  'VXUS',
  'VTIAX',
  'VTMGX',
  'VEA',
  'VWO',
  'IXUS',
  'EFA',
  'EEM',
  'IEFA',
  'IEMG',
  'VEU',
  'VSS',
  'FTIHX',
  'FSPSX',
  'SCHF',
  'SCHE',
  'VGTSX',
  'VFWAX',
]);

const ASSET_CLASS_BUCKETS: Record<AssetClass, AllocationBucket> = {
  equity: 'stock',
  fixed_income: 'bond',
  cash: 'cash',
  crypto: 'alt',
  real_estate: 'alt',
  commodity: 'alt',
  other: 'alt',
};

export interface SymbolClassification {
  bucket: AllocationBucket;
  classification_source: ClassificationSource;
}

/**
 * Classify a symbol into an allocation bucket.
 *
 * Priority: explicit per-symbol override > international fund
 * heuristic > broker-reported asset class > fallback to 'stock'
 * (tagged 'fallback' so unknowns are visible, never silent).
 */
export function classifySymbol(
  symbol: string,
  assetClass: AssetClass | null,
  overrides: Record<string, AllocationBucket>,
): SymbolClassification {
  const normalized = symbol.toUpperCase();

  const override = overrides[normalized] ?? overrides[symbol];
  if (override && (ALLOCATION_BUCKETS as readonly string[]).includes(override)) {
    return { bucket: override, classification_source: 'override' };
  }

  if (INTL_FUND_SYMBOLS.has(normalized)) {
    return { bucket: 'intl', classification_source: 'intl_heuristic' };
  }

  if (assetClass && assetClass in ASSET_CLASS_BUCKETS) {
    return { bucket: ASSET_CLASS_BUCKETS[assetClass], classification_source: 'asset_class' };
  }

  return { bucket: 'stock', classification_source: 'fallback' };
}

export interface CompositionPositionInput {
  symbol: string;
  name: string | null;
  account_id: string;
  market_value: number;
  asset_class: AssetClass | null;
}

export interface CompositionCashAccountInput {
  account_id: string;
  name: string;
  balance: number;
}

export interface CompositionAccountInput {
  id: string;
  name: string;
  account_type: AccountType;
  tax_treatment: TaxTreatment;
}

export interface CompositionInput {
  positions: CompositionPositionInput[];
  cashAccounts: CompositionCashAccountInput[];
  accounts: CompositionAccountInput[];
  overrides: Record<string, AllocationBucket>;
  targets: AllocationTarget[];
}

function emptyBucketRecord(): Record<AllocationBucket, number> {
  const record = {} as Record<AllocationBucket, number>;
  for (const bucket of ALLOCATION_BUCKETS) record[bucket] = 0;
  return record;
}

/**
 * Compute the full portfolio composition: classified positions, bucket
 * rollups with drift vs. targets, and the asset-location matrix.
 *
 * Deterministic and division-safe: an empty portfolio yields zero
 * values and zero percentages, never NaN.
 */
export function computeComposition(input: CompositionInput): PortfolioComposition {
  const taxTreatmentByAccount = new Map<string, TaxTreatment>(
    input.accounts.map((a) => [a.id, a.tax_treatment ?? 'none']),
  );

  // Classify security positions, then cash accounts (always bucket
  // 'cash'); cash rows are kept in the positions list so every dollar
  // in the composition is visible and explained.
  const positions: CompositionPosition[] = input.positions.map((p) => {
    const { bucket, classification_source } = classifySymbol(
      p.symbol,
      p.asset_class,
      input.overrides,
    );
    return {
      symbol: p.symbol,
      name: p.name,
      value: p.market_value,
      pct: 0, // filled in once the total is known
      bucket,
      classification_source,
      account_id: p.account_id,
    };
  });

  for (const cash of input.cashAccounts) {
    if (cash.balance <= 0) continue;
    positions.push({
      symbol: 'CASH',
      name: cash.name,
      value: cash.balance,
      pct: 0,
      bucket: 'cash',
      classification_source: 'asset_class',
      account_id: cash.account_id,
    });
  }

  const totalValue = positions.reduce((sum, p) => sum + p.value, 0);
  const pctOf = (value: number) => (totalValue > 0 ? value / totalValue : 0);

  for (const p of positions) p.pct = pctOf(p.value);

  // Bucket rollups with drift vs. targets
  const bucketValues = emptyBucketRecord();
  for (const p of positions) bucketValues[p.bucket] += p.value;

  const targetByBucket = new Map<AllocationBucket, AllocationTarget>(
    input.targets.map((t) => [t.bucket, t]),
  );

  const buckets: CompositionBucket[] = ALLOCATION_BUCKETS.map((bucket) => {
    const value = bucketValues[bucket];
    const pct = pctOf(value);
    const target = targetByBucket.get(bucket);
    const drift = target ? pct - target.target_pct : null;
    return {
      bucket,
      value,
      pct,
      target_pct: target?.target_pct ?? null,
      band_pct: target?.band_pct ?? null,
      drift,
      drift_alert: target != null && drift != null && Math.abs(drift) > target.band_pct,
    };
  });

  // Asset-location matrix: bucket value by the owning account's tax
  // treatment. Positions in accounts we don't know land under 'none'.
  const locationByTreatment = new Map<TaxTreatment, Record<AllocationBucket, number>>(
    TAX_TREATMENTS.map((t) => [t, emptyBucketRecord()]),
  );

  for (const p of positions) {
    const treatment = taxTreatmentByAccount.get(p.account_id) ?? 'none';
    locationByTreatment.get(treatment)![p.bucket] += p.value;
  }

  const asset_location: AssetLocationRow[] = TAX_TREATMENTS.map((tax_treatment) => {
    const by_bucket = locationByTreatment.get(tax_treatment)!;
    const total_value = ALLOCATION_BUCKETS.reduce((sum, b) => sum + by_bucket[b], 0);
    return { tax_treatment, total_value, by_bucket };
  });

  return {
    total_value: totalValue,
    buckets,
    positions,
    asset_location,
  };
}
