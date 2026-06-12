import { describe, it, expect } from 'vitest';
import { classifySymbol, computeComposition } from '../../../src/engine/composition.js';
import type { CompositionInput } from '../../../src/engine/composition.js';
import { ALLOCATION_BUCKETS } from '../../../src/types/index.js';
import type { AllocationBucket } from '../../../src/types/index.js';

describe('classifySymbol', () => {
  it('maps each asset_class to its bucket', () => {
    expect(classifySymbol('VTI', 'equity', {})).toEqual({
      bucket: 'stock',
      classification_source: 'asset_class',
    });
    expect(classifySymbol('BND', 'fixed_income', {})).toEqual({
      bucket: 'bond',
      classification_source: 'asset_class',
    });
    expect(classifySymbol('SPAXX', 'cash', {})).toEqual({
      bucket: 'cash',
      classification_source: 'asset_class',
    });
    expect(classifySymbol('BTC', 'crypto', {})).toEqual({
      bucket: 'alt',
      classification_source: 'asset_class',
    });
    expect(classifySymbol('VNQ', 'real_estate', {})).toEqual({
      bucket: 'alt',
      classification_source: 'asset_class',
    });
    expect(classifySymbol('GLD', 'commodity', {})).toEqual({
      bucket: 'alt',
      classification_source: 'asset_class',
    });
    expect(classifySymbol('XYZ', 'other', {})).toEqual({
      bucket: 'alt',
      classification_source: 'asset_class',
    });
  });

  it('recognizes common international fund symbols ahead of asset_class', () => {
    // Brokers report VXUS as plain equity; the heuristic wins
    expect(classifySymbol('VXUS', 'equity', {})).toEqual({
      bucket: 'intl',
      classification_source: 'intl_heuristic',
    });
    expect(classifySymbol('VTIAX', null, {})).toEqual({
      bucket: 'intl',
      classification_source: 'intl_heuristic',
    });
    expect(classifySymbol('iemg', 'equity', {})).toEqual({
      bucket: 'intl',
      classification_source: 'intl_heuristic',
    });
  });

  it('override beats the intl heuristic and asset_class', () => {
    expect(classifySymbol('VXUS', 'equity', { VXUS: 'bond' })).toEqual({
      bucket: 'bond',
      classification_source: 'override',
    });
    expect(classifySymbol('VTI', 'equity', { VTI: 'alt' })).toEqual({
      bucket: 'alt',
      classification_source: 'override',
    });
  });

  it('falls back to stock with fallback tag for null asset_class', () => {
    expect(classifySymbol('MYSTERY', null, {})).toEqual({
      bucket: 'stock',
      classification_source: 'fallback',
    });
  });

  it('ignores overrides pointing at unknown buckets', () => {
    const overrides = { VTI: 'derivatives' } as unknown as Record<string, AllocationBucket>;
    expect(classifySymbol('VTI', 'equity', overrides)).toEqual({
      bucket: 'stock',
      classification_source: 'asset_class',
    });
  });
});

function makeInput(overrides: Partial<CompositionInput> = {}): CompositionInput {
  return {
    positions: [
      {
        symbol: 'VTI',
        name: 'Total Market',
        account_id: 'acc-b',
        market_value: 5000,
        asset_class: 'equity',
      },
      {
        symbol: 'VXUS',
        name: 'Intl Market',
        account_id: 'acc-b',
        market_value: 2500,
        asset_class: 'equity',
      },
      {
        symbol: 'BND',
        name: 'Total Bond',
        account_id: 'acc-r',
        market_value: 1500,
        asset_class: 'fixed_income',
      },
    ],
    cashAccounts: [{ account_id: 'acc-c', name: 'Checking', balance: 1000 }],
    accounts: [
      { id: 'acc-b', name: 'Brokerage', account_type: 'brokerage', tax_treatment: 'after_tax' },
      { id: 'acc-r', name: '401k', account_type: 'retirement', tax_treatment: 'pre_tax' },
      { id: 'acc-c', name: 'Checking', account_type: 'checking', tax_treatment: 'none' },
    ],
    overrides: {},
    targets: [],
    ...overrides,
  };
}

describe('computeComposition', () => {
  it('sums bucket values and computes percentages of total', () => {
    const result = computeComposition(makeInput());

    expect(result.total_value).toBe(10000);

    const byBucket = Object.fromEntries(result.buckets.map((b) => [b.bucket, b]));
    expect(byBucket.stock.value).toBe(5000);
    expect(byBucket.stock.pct).toBeCloseTo(0.5, 10);
    expect(byBucket.intl.value).toBe(2500);
    expect(byBucket.intl.pct).toBeCloseTo(0.25, 10);
    expect(byBucket.bond.value).toBe(1500);
    expect(byBucket.bond.pct).toBeCloseTo(0.15, 10);
    expect(byBucket.cash.value).toBe(1000);
    expect(byBucket.cash.pct).toBeCloseTo(0.1, 10);
    expect(byBucket.alt.value).toBe(0);
    expect(byBucket.alt.pct).toBe(0);

    // Always one row per bucket, in canonical order
    expect(result.buckets.map((b) => b.bucket)).toEqual([...ALLOCATION_BUCKETS]);
  });

  it('tags every position with its bucket and classification source', () => {
    const result = computeComposition(makeInput({ overrides: { BND: 'alt' } }));

    const vti = result.positions.find((p) => p.symbol === 'VTI')!;
    expect(vti.bucket).toBe('stock');
    expect(vti.classification_source).toBe('asset_class');
    expect(vti.pct).toBeCloseTo(0.5, 10);
    expect(vti.account_id).toBe('acc-b');

    const vxus = result.positions.find((p) => p.symbol === 'VXUS')!;
    expect(vxus.bucket).toBe('intl');
    expect(vxus.classification_source).toBe('intl_heuristic');

    const bnd = result.positions.find((p) => p.symbol === 'BND')!;
    expect(bnd.bucket).toBe('alt');
    expect(bnd.classification_source).toBe('override');

    // Cash accounts appear as explained positions too
    const cash = result.positions.find((p) => p.account_id === 'acc-c')!;
    expect(cash.symbol).toBe('CASH');
    expect(cash.name).toBe('Checking');
    expect(cash.bucket).toBe('cash');
    expect(cash.classification_source).toBe('asset_class');
    expect(cash.value).toBe(1000);
  });

  it('computes drift and band alerts against targets', () => {
    const result = computeComposition(
      makeInput({
        targets: [
          { bucket: 'stock', target_pct: 0.4, band_pct: 0.05 }, // pct 0.5 → drift +0.10, alert
          { bucket: 'bond', target_pct: 0.2, band_pct: 0.1 }, // pct 0.15 → drift -0.05, in band
          { bucket: 'cash', target_pct: 0.1, band_pct: 0.05 }, // pct 0.10 → drift 0
        ],
      }),
    );

    const byBucket = Object.fromEntries(result.buckets.map((b) => [b.bucket, b]));

    expect(byBucket.stock.target_pct).toBe(0.4);
    expect(byBucket.stock.band_pct).toBe(0.05);
    expect(byBucket.stock.drift).toBeCloseTo(0.1, 10);
    expect(byBucket.stock.drift_alert).toBe(true);

    expect(byBucket.bond.drift).toBeCloseTo(-0.05, 10);
    expect(byBucket.bond.drift_alert).toBe(false);

    expect(byBucket.cash.drift).toBeCloseTo(0, 10);
    expect(byBucket.cash.drift_alert).toBe(false);

    // No target for intl → drift null, no alert
    expect(byBucket.intl.target_pct).toBeNull();
    expect(byBucket.intl.band_pct).toBeNull();
    expect(byBucket.intl.drift).toBeNull();
    expect(byBucket.intl.drift_alert).toBe(false);
  });

  it('does not alert when drift exactly equals the band', () => {
    const result = computeComposition(
      makeInput({ targets: [{ bucket: 'stock', target_pct: 0.4, band_pct: 0.1 }] }),
    );
    const stock = result.buckets.find((b) => b.bucket === 'stock')!;
    expect(stock.drift).toBeCloseTo(0.1, 10);
    expect(stock.drift_alert).toBe(false);
  });

  it('reports null drift for every bucket when no targets are set', () => {
    const result = computeComposition(makeInput());
    for (const bucket of result.buckets) {
      expect(bucket.target_pct).toBeNull();
      expect(bucket.drift).toBeNull();
      expect(bucket.drift_alert).toBe(false);
    }
  });

  it('builds the asset-location matrix with cash under its account tax treatment', () => {
    const result = computeComposition(makeInput());

    const byTreatment = Object.fromEntries(result.asset_location.map((r) => [r.tax_treatment, r]));
    expect(result.asset_location.map((r) => r.tax_treatment)).toEqual([
      'pre_tax',
      'after_tax',
      'tax_free',
      'none',
    ]);

    expect(byTreatment.after_tax.total_value).toBe(7500);
    expect(byTreatment.after_tax.by_bucket.stock).toBe(5000);
    expect(byTreatment.after_tax.by_bucket.intl).toBe(2500);
    expect(byTreatment.after_tax.by_bucket.cash).toBe(0);

    expect(byTreatment.pre_tax.total_value).toBe(1500);
    expect(byTreatment.pre_tax.by_bucket.bond).toBe(1500);

    expect(byTreatment.none.total_value).toBe(1000);
    expect(byTreatment.none.by_bucket.cash).toBe(1000);

    expect(byTreatment.tax_free.total_value).toBe(0);
  });

  it('puts positions from unknown accounts under tax treatment none', () => {
    const result = computeComposition(
      makeInput({
        positions: [
          {
            symbol: 'VTI',
            name: null,
            account_id: 'acc-gone',
            market_value: 100,
            asset_class: 'equity',
          },
        ],
        cashAccounts: [],
      }),
    );
    const none = result.asset_location.find((r) => r.tax_treatment === 'none')!;
    expect(none.total_value).toBe(100);
    expect(none.by_bucket.stock).toBe(100);
  });

  it('skips cash accounts with zero or negative balances', () => {
    const result = computeComposition(
      makeInput({
        positions: [],
        cashAccounts: [
          { account_id: 'acc-c', name: 'Checking', balance: 0 },
          { account_id: 'acc-c2', name: 'Overdrawn', balance: -50 },
        ],
      }),
    );
    expect(result.total_value).toBe(0);
    expect(result.positions).toHaveLength(0);
  });

  it('handles an empty portfolio without NaN', () => {
    const result = computeComposition(
      makeInput({
        positions: [],
        cashAccounts: [],
        targets: [{ bucket: 'stock', target_pct: 0.6, band_pct: 0.05 }],
      }),
    );

    expect(result.total_value).toBe(0);
    expect(result.positions).toHaveLength(0);
    for (const bucket of result.buckets) {
      expect(bucket.value).toBe(0);
      expect(bucket.pct).toBe(0);
      expect(Number.isNaN(bucket.pct)).toBe(false);
    }
    // With a 0 total, stock pct 0 vs target 0.6 → drift -0.6, alert fires
    const stock = result.buckets.find((b) => b.bucket === 'stock')!;
    expect(stock.drift).toBeCloseTo(-0.6, 10);
    expect(stock.drift_alert).toBe(true);
    for (const row of result.asset_location) {
      expect(row.total_value).toBe(0);
    }
  });
});
