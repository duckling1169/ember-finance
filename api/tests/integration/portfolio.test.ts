import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Hono } from 'hono';
import { portfolioRoute } from '../../src/routes/portfolio.js';
import {
  createTestHousehold,
  createTestAccount,
  cleanupTestHousehold,
  getTestClient,
  stubAuth,
  stubHouseholdMember,
} from '../helpers.js';
import type { AuthEnv } from '../../src/middleware/auth.js';
import type { PortfolioCompositionResponse } from '../../src/types/index.js';

// Build a test app with stub auth + household member middleware
const app = new Hono<AuthEnv>();
app.use('/api/*', stubAuth());
app.use('/api/portfolio/:householdId/*', stubHouseholdMember());
app.route('/api/portfolio', portfolioRoute);

describe('Portfolio composition API', () => {
  let householdId: string;
  let brokerageId: string;
  let checkingId: string;

  // Symbols unlikely to collide with security_price rows from other
  // tests, so live_market_value falls back to the snapshot price.
  const STOCK_SYM = 'ZZEMBSTK';
  const OVERRIDE_SYM = 'ZZEMBOVR';
  const BOND_SYM = 'ZZEMBBND';
  const ZERO_SYM = 'ZZEMBZRO';

  beforeAll(async () => {
    const ctx = await createTestHousehold();
    householdId = ctx.householdId;

    const brokerage = await createTestAccount(householdId, {
      name: 'Composition Brokerage',
      account_type: 'brokerage',
      tax_treatment: 'after_tax',
    });
    brokerageId = brokerage.id;

    const checking = await createTestAccount(householdId, {
      name: 'Composition Checking',
      account_type: 'checking',
      tax_treatment: 'none',
    });
    checkingId = checking.id;

    const db = getTestClient();

    // Holdings: 1000 stock + 500 override→intl + 300 bond + one
    // zero-quantity row that must be excluded
    const { error: holdingsErr } = await db.from('holding').insert([
      {
        household_id: householdId,
        account_id: brokerageId,
        as_of: '2026-06-01',
        symbol: STOCK_SYM,
        name: 'Test Stock Fund',
        quantity: 10,
        price: 100,
        market_value: 1000,
        asset_class: 'equity',
      },
      {
        household_id: householdId,
        account_id: brokerageId,
        as_of: '2026-06-01',
        symbol: OVERRIDE_SYM,
        name: 'Test Intl Fund',
        quantity: 10,
        price: 50,
        market_value: 500,
        asset_class: 'equity',
      },
      {
        household_id: householdId,
        account_id: brokerageId,
        as_of: '2026-06-01',
        symbol: BOND_SYM,
        name: 'Test Bond Fund',
        quantity: 10,
        price: 30,
        market_value: 300,
        asset_class: 'fixed_income',
      },
      {
        household_id: householdId,
        account_id: brokerageId,
        as_of: '2026-06-01',
        symbol: ZERO_SYM,
        name: 'Sold Out',
        quantity: 0,
        price: 10,
        market_value: 0,
        asset_class: 'equity',
      },
    ]);
    if (holdingsErr) throw new Error(`Failed to insert holdings: ${holdingsErr.message}`);

    // Checking balance → cash sleeve
    const { error: balanceErr } = await db.from('balance_snapshot').insert({
      household_id: householdId,
      account_id: checkingId,
      date: '2026-06-01',
      balance: 200,
      source: 'manual',
    });
    if (balanceErr) throw new Error(`Failed to insert balance: ${balanceErr.message}`);

    // Household-baseline allocation assumptions
    const { error: recordsErr } = await db.from('assumption_record').insert([
      {
        household_id: householdId,
        scenario_id: null,
        key: 'allocation.targets',
        value: [
          { bucket: 'stock', target_pct: 0.4, band_pct: 0.05 },
          { bucket: 'bond', target_pct: 0.2, band_pct: 0.1 },
          { bucket: 'cash', target_pct: 0.1, band_pct: 0.05 },
        ],
        effective_date: '2026-01-01',
      },
      {
        household_id: householdId,
        scenario_id: null,
        key: 'allocation.symbol_overrides',
        value: { [OVERRIDE_SYM]: 'intl' },
        effective_date: '2026-01-01',
      },
    ]);
    if (recordsErr) throw new Error(`Failed to insert assumption records: ${recordsErr.message}`);
  });

  afterAll(async () => {
    await cleanupTestHousehold(householdId);
  });

  describe('GET /api/portfolio/:householdId/composition', () => {
    let body: PortfolioCompositionResponse;

    beforeAll(async () => {
      const res = await app.request(`/api/portfolio/${householdId}/composition`);
      expect(res.status).toBe(200);
      body = await res.json();
    });

    it('sums total value across holdings and cash accounts', () => {
      // 1000 + 500 + 300 + 200; the zero-quantity row is excluded
      expect(body.total_value).toBe(2000);
      expect(body.positions.find((p) => p.symbol === ZERO_SYM)).toBeUndefined();
    });

    it('classifies positions with resolved symbol overrides', () => {
      const stock = body.positions.find((p) => p.symbol === STOCK_SYM)!;
      expect(stock.bucket).toBe('stock');
      expect(stock.classification_source).toBe('asset_class');
      expect(stock.value).toBe(1000);
      expect(stock.account_id).toBe(brokerageId);

      const overridden = body.positions.find((p) => p.symbol === OVERRIDE_SYM)!;
      expect(overridden.bucket).toBe('intl');
      expect(overridden.classification_source).toBe('override');

      const bond = body.positions.find((p) => p.symbol === BOND_SYM)!;
      expect(bond.bucket).toBe('bond');
      expect(bond.classification_source).toBe('asset_class');

      const cash = body.positions.find((p) => p.account_id === checkingId)!;
      expect(cash.symbol).toBe('CASH');
      expect(cash.bucket).toBe('cash');
      expect(cash.value).toBe(200);
    });

    it('rolls up buckets with drift against household targets', () => {
      const byBucket = Object.fromEntries(body.buckets.map((b) => [b.bucket, b]));

      // stock: 1000/2000 = 0.5 vs target 0.4 band 0.05 → alert
      expect(byBucket.stock.value).toBe(1000);
      expect(byBucket.stock.pct).toBeCloseTo(0.5, 10);
      expect(byBucket.stock.drift).toBeCloseTo(0.1, 10);
      expect(byBucket.stock.drift_alert).toBe(true);

      // bond: 300/2000 = 0.15 vs target 0.2 band 0.1 → inside band
      expect(byBucket.bond.pct).toBeCloseTo(0.15, 10);
      expect(byBucket.bond.drift).toBeCloseTo(-0.05, 10);
      expect(byBucket.bond.drift_alert).toBe(false);

      // cash: 200/2000 = 0.1 vs target 0.1 → no drift
      expect(byBucket.cash.drift).toBeCloseTo(0, 10);
      expect(byBucket.cash.drift_alert).toBe(false);

      // intl has no target
      expect(byBucket.intl.pct).toBeCloseTo(0.25, 10);
      expect(byBucket.intl.target_pct).toBeNull();
      expect(byBucket.intl.drift).toBeNull();
      expect(byBucket.intl.drift_alert).toBe(false);
    });

    it('builds the asset-location matrix by account tax treatment', () => {
      const byTreatment = Object.fromEntries(body.asset_location.map((r) => [r.tax_treatment, r]));

      expect(byTreatment.after_tax.total_value).toBe(1800);
      expect(byTreatment.after_tax.by_bucket.stock).toBe(1000);
      expect(byTreatment.after_tax.by_bucket.intl).toBe(500);
      expect(byTreatment.after_tax.by_bucket.bond).toBe(300);

      expect(byTreatment.none.total_value).toBe(200);
      expect(byTreatment.none.by_bucket.cash).toBe(200);

      expect(byTreatment.pre_tax.total_value).toBe(0);
      expect(byTreatment.tax_free.total_value).toBe(0);
    });

    it('reports targets provenance from the household record', () => {
      expect(body.as_of).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(body.targets_source).toBe('household');
      expect(body.targets_effective_date).toBe('2026-01-01');
    });
  });

  it('returns 403 for a household with no members', async () => {
    const res = await app.request(
      '/api/portfolio/00000000-0000-0000-0000-000000000000/composition',
    );
    expect(res.status).toBe(403);
  });
});
