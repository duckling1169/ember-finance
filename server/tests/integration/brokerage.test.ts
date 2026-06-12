import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  createTestHousehold,
  createTestAccount,
  createTestSource,
  cleanupTestHousehold,
  getTestClient,
} from '../helpers.js';
import { persistIngest } from '../../src/services/ingest.js';
import type { IngestResult } from '../../src/types/index.js';

describe('brokerage account (comprehensive)', () => {
  let householdId: string;
  let brokerageId: string;
  let retirementId: string;
  let hsaId: string;
  let brokerageSourceId: string;
  let retirementSourceId: string;
  let hsaSourceId: string;

  beforeAll(async () => {
    const ctx = await createTestHousehold();
    householdId = ctx.householdId;

    const brokerage = await createTestAccount(householdId, {
      name: 'Fidelity Taxable',
      institution: 'Fidelity',
      account_type: 'brokerage',
    });
    brokerageId = brokerage.id;

    const retirement = await createTestAccount(householdId, {
      name: 'Vanguard 401k',
      institution: 'Vanguard',
      account_type: 'retirement',
    });
    retirementId = retirement.id;

    const hsa = await createTestAccount(householdId, {
      name: 'Fidelity HSA',
      institution: 'Fidelity',
      account_type: 'hsa',
    });
    hsaId = hsa.id;

    const bs = await createTestSource(brokerageId, householdId, 'manual');
    brokerageSourceId = bs.id;
    const rs = await createTestSource(retirementId, householdId, 'manual');
    retirementSourceId = rs.id;
    const hs = await createTestSource(hsaId, householdId, 'manual');
    hsaSourceId = hs.id;
  });

  afterAll(async () => {
    await cleanupTestHousehold(householdId);
  });

  const ingestBrokerage = (result: IngestResult) =>
    persistIngest(
      {
        householdId,
        accountId: brokerageId,
        sourceId: brokerageSourceId,
        sourceType: 'manual_entry',
      },
      result,
    );

  const ingestRetirement = (result: IngestResult) =>
    persistIngest(
      {
        householdId,
        accountId: retirementId,
        sourceId: retirementSourceId,
        sourceType: 'manual_entry',
      },
      result,
    );

  const ingestHsa = (result: IngestResult) =>
    persistIngest(
      { householdId, accountId: hsaId, sourceId: hsaSourceId, sourceType: 'manual_entry' },
      result,
    );

  const db = () => getTestClient();

  // ── POSITION BUILDING ──

  describe('building positions over time', () => {
    it('handles initial buys across multiple symbols', async () => {
      await ingestBrokerage({
        transactions: [],
        investmentActivity: [
          {
            date: '2025-01-02',
            activityType: 'buy',
            symbol: 'VTI',
            quantity: 50,
            price: 250.0,
            amount: -12500.0,
            commission: 0,
          },
          {
            date: '2025-01-02',
            activityType: 'buy',
            symbol: 'VXUS',
            quantity: 100,
            price: 58.0,
            amount: -5800.0,
            commission: 0,
          },
          {
            date: '2025-01-02',
            activityType: 'buy',
            symbol: 'BND',
            quantity: 75,
            price: 72.0,
            amount: -5400.0,
            commission: 4.95,
          },
          {
            date: '2025-01-02',
            activityType: 'buy',
            symbol: 'AAPL',
            quantity: 25,
            price: 185.5,
            amount: -4637.5,
            commission: 0,
          },
          {
            date: '2025-01-02',
            activityType: 'buy',
            symbol: 'MSFT',
            quantity: 15,
            price: 375.0,
            amount: -5625.0,
            commission: 0,
          },
        ],
        balances: [{ date: '2025-01-02', balance: 33962.5 }],
        holdings: [],
      });

      const { data } = await db()
        .from('investment_activity')
        .select('*')
        .eq('account_id', brokerageId)
        .eq('date', '2025-01-02');

      expect(data).toHaveLength(5);
      const vti = data!.find((a: any) => a.symbol === 'VTI');
      expect(vti!.quantity).toBe(50);
      expect(vti!.amount).toBe(-12500);

      // BND should have commission recorded
      const bnd = data!.find((a: any) => a.symbol === 'BND');
      expect(bnd!.commission).toBe(4.95);
    });

    it('handles dollar-cost averaging (multiple buys same symbol different dates)', async () => {
      await ingestBrokerage({
        transactions: [],
        investmentActivity: [
          {
            date: '2025-02-03',
            activityType: 'buy',
            symbol: 'VTI',
            quantity: 20,
            price: 255.0,
            amount: -5100.0,
          },
          {
            date: '2025-03-03',
            activityType: 'buy',
            symbol: 'VTI',
            quantity: 20,
            price: 248.0,
            amount: -4960.0,
          },
          {
            date: '2025-04-01',
            activityType: 'buy',
            symbol: 'VTI',
            quantity: 20,
            price: 262.0,
            amount: -5240.0,
          },
        ],
        balances: [],
        holdings: [],
      });

      const { data } = await db()
        .from('investment_activity')
        .select('*')
        .eq('account_id', brokerageId)
        .eq('symbol', 'VTI')
        .eq('activity_type', 'buy')
        .order('date');

      expect(data).toHaveLength(4); // initial + 3 DCA buys
      // Verify prices differ (DCA)
      const prices = data!.map((a: any) => a.price);
      expect(new Set(prices).size).toBeGreaterThan(1);
    });

    it('handles fractional share purchases', async () => {
      await ingestBrokerage({
        transactions: [],
        investmentActivity: [
          {
            date: '2025-01-15',
            activityType: 'buy',
            symbol: 'AMZN',
            quantity: 0.534,
            price: 187.25,
            amount: -99.99,
          },
          {
            date: '2025-02-15',
            activityType: 'buy',
            symbol: 'AMZN',
            quantity: 0.521,
            price: 191.94,
            amount: -100.0,
          },
          {
            date: '2025-03-15',
            activityType: 'buy',
            symbol: 'GOOGL',
            quantity: 0.583,
            price: 171.53,
            amount: -100.0,
          },
        ],
        balances: [],
        holdings: [],
      });

      const { data } = await db()
        .from('investment_activity')
        .select('quantity, symbol')
        .eq('account_id', brokerageId)
        .eq('symbol', 'AMZN')
        .order('date');

      expect(data).toHaveLength(2);
      const quantities = data!.map((a: any) => a.quantity).sort();
      expect(quantities).toEqual([0.521, 0.534]);
    });
  });

  // ── SELLING ──

  describe('selling positions', () => {
    it('handles partial sell', async () => {
      await ingestBrokerage({
        transactions: [],
        investmentActivity: [
          {
            date: '2025-04-15',
            activityType: 'sell',
            symbol: 'AAPL',
            quantity: 10,
            price: 195.0,
            amount: 1950.0,
            commission: 0,
          },
        ],
        balances: [],
        holdings: [],
      });

      const { data } = await db()
        .from('investment_activity')
        .select('*')
        .eq('account_id', brokerageId)
        .eq('symbol', 'AAPL')
        .order('date');

      expect(data).toHaveLength(2); // 1 buy + 1 sell
      const sell = data!.find((a: any) => a.activity_type === 'sell');
      expect(sell!.quantity).toBe(10);
      expect(sell!.amount).toBe(1950.0); // positive = money into account
    });

    it('handles full position liquidation', async () => {
      await ingestBrokerage({
        transactions: [],
        investmentActivity: [
          {
            date: '2025-05-01',
            activityType: 'sell',
            symbol: 'MSFT',
            quantity: 15,
            price: 390.0,
            amount: 5850.0,
          },
        ],
        balances: [],
        holdings: [],
      });

      const { data } = await db()
        .from('investment_activity')
        .select('activity_type, quantity, amount')
        .eq('account_id', brokerageId)
        .eq('symbol', 'MSFT')
        .order('date');

      expect(data).toHaveLength(2);
      expect(data![0].activity_type).toBe('buy');
      expect(data![0].quantity).toBe(15);
      expect(data![1].activity_type).toBe('sell');
      expect(data![1].quantity).toBe(15); // sold all
    });

    it('handles sell with commission', async () => {
      await ingestBrokerage({
        transactions: [],
        investmentActivity: [
          {
            date: '2025-05-10',
            activityType: 'sell',
            symbol: 'AAPL',
            quantity: 5,
            price: 192.0,
            amount: 955.05,
            commission: 4.95,
          },
        ],
        balances: [],
        holdings: [],
      });

      const { data } = await db()
        .from('investment_activity')
        .select('*')
        .eq('account_id', brokerageId)
        .eq('symbol', 'AAPL')
        .eq('activity_type', 'sell')
        .order('date');

      expect(data).toHaveLength(2);
      const withComm = data!.find((a: any) => a.commission === 4.95);
      expect(withComm).toBeTruthy();
    });
  });

  // ── DIVIDENDS ──

  describe('dividend handling', () => {
    it('records cash dividends across multiple symbols', async () => {
      await ingestBrokerage({
        transactions: [],
        investmentActivity: [
          {
            date: '2025-03-15',
            activityType: 'dividend',
            symbol: 'VTI',
            amount: 85.2,
            description: 'Ordinary Dividend',
          },
          {
            date: '2025-03-15',
            activityType: 'dividend',
            symbol: 'VXUS',
            amount: 42.0,
            description: 'Ordinary Dividend',
          },
          {
            date: '2025-03-15',
            activityType: 'dividend',
            symbol: 'BND',
            amount: 18.75,
            description: 'Interest Income',
          },
          {
            date: '2025-03-20',
            activityType: 'dividend',
            symbol: 'AAPL',
            amount: 6.0,
            description: 'Ordinary Dividend',
          },
        ],
        balances: [],
        holdings: [],
      });

      const { data } = await db()
        .from('investment_activity')
        .select('symbol, amount, description')
        .eq('account_id', brokerageId)
        .eq('activity_type', 'dividend')
        .order('symbol');

      expect(data!.length).toBeGreaterThanOrEqual(4);
      // Dividends should have positive amounts (cash in)
      for (const div of data!) {
        expect((div as any).amount).toBeGreaterThan(0);
      }
    });

    it('records dividend reinvestment (DRIP) as paired entries', async () => {
      await ingestBrokerage({
        transactions: [],
        investmentActivity: [
          {
            date: '2025-06-15',
            activityType: 'dividend',
            symbol: 'VTI',
            amount: 92.4,
            description: 'Q2 Ordinary Dividend',
          },
          {
            date: '2025-06-15',
            activityType: 'reinvestment',
            symbol: 'VTI',
            quantity: 0.345,
            price: 267.83,
            amount: -92.4,
            description: 'Dividend Reinvestment',
          },
        ],
        balances: [],
        holdings: [],
      });

      const { data } = await db()
        .from('investment_activity')
        .select('*')
        .eq('account_id', brokerageId)
        .eq('date', '2025-06-15')
        .eq('symbol', 'VTI');

      const div = data!.find((a: any) => a.activity_type === 'dividend');
      const reinvest = data!.find((a: any) => a.activity_type === 'reinvestment');

      expect(div).toBeTruthy();
      expect(reinvest).toBeTruthy();
      // Dividend in + reinvestment out should net to zero
      expect(div!.amount + reinvest!.amount).toBeCloseTo(0, 2);
      expect(reinvest!.quantity).toBe(0.345);
    });

    it('handles return of capital distribution', async () => {
      await ingestBrokerage({
        transactions: [],
        investmentActivity: [
          {
            date: '2025-06-20',
            activityType: 'return_of_capital',
            symbol: 'VNQ',
            amount: 12.5,
            description: 'Return of Capital',
          },
        ],
        balances: [],
        holdings: [],
      });

      const { data } = await db()
        .from('investment_activity')
        .select('*')
        .eq('account_id', brokerageId)
        .eq('activity_type', 'return_of_capital')
        .single();

      expect(data!.symbol).toBe('VNQ');
      expect(data!.amount).toBe(12.5);
    });
  });

  // ── STOCK SPLITS ──

  describe('stock splits', () => {
    it('records a forward stock split', async () => {
      // AAPL 4:1 split scenario
      await ingestBrokerage({
        transactions: [],
        investmentActivity: [
          {
            date: '2025-07-01',
            activityType: 'split',
            symbol: 'AAPL',
            quantity: 30, // gained 30 shares (had 10 remaining, 4:1 split = +30)
            amount: 0,
            description: 'Forward Split 4:1',
          },
        ],
        balances: [],
        holdings: [],
      });

      const { data } = await db()
        .from('investment_activity')
        .select('*')
        .eq('account_id', brokerageId)
        .eq('activity_type', 'split')
        .single();

      expect(data!.symbol).toBe('AAPL');
      expect(data!.quantity).toBe(30);
      expect(data!.amount).toBe(0); // splits are non-cash events
    });
  });

  // ── TRANSFERS ──

  describe('account transfers', () => {
    it('records transfer in (rollover from old 401k)', async () => {
      await ingestRetirement({
        transactions: [],
        investmentActivity: [
          {
            date: '2025-02-01',
            activityType: 'transfer_in',
            symbol: 'VTI',
            quantity: 200,
            price: 252.0,
            amount: 50400.0,
            description: 'Rollover from Previous Employer',
          },
          {
            date: '2025-02-01',
            activityType: 'transfer_in',
            symbol: 'BND',
            quantity: 150,
            price: 71.0,
            amount: 10650.0,
            description: 'Rollover from Previous Employer',
          },
        ],
        balances: [{ date: '2025-02-01', balance: 61050.0 }],
        holdings: [],
      });

      const { data } = await db()
        .from('investment_activity')
        .select('*')
        .eq('account_id', retirementId)
        .eq('activity_type', 'transfer_in');

      expect(data).toHaveLength(2);
      const total = data!.reduce((sum: number, a: any) => sum + a.amount, 0);
      expect(total).toBe(61050.0);
    });

    it('records transfer out', async () => {
      await ingestBrokerage({
        transactions: [],
        investmentActivity: [
          {
            date: '2025-07-15',
            activityType: 'transfer_out',
            symbol: 'BND',
            quantity: 25,
            price: 73.0,
            amount: -1825.0,
            description: 'Transfer to HSA',
          },
        ],
        balances: [],
        holdings: [],
      });

      const { data } = await db()
        .from('investment_activity')
        .select('*')
        .eq('account_id', brokerageId)
        .eq('activity_type', 'transfer_out')
        .single();

      expect(data!.amount).toBe(-1825.0); // negative = out of account
    });

    it('records corresponding transfer in on receiving account', async () => {
      await ingestHsa({
        transactions: [],
        investmentActivity: [
          {
            date: '2025-07-15',
            activityType: 'transfer_in',
            symbol: 'BND',
            quantity: 25,
            price: 73.0,
            amount: 1825.0,
            description: 'Transfer from Brokerage',
          },
        ],
        balances: [{ date: '2025-07-15', balance: 1825.0 }],
        holdings: [],
      });

      const { data } = await db()
        .from('investment_activity')
        .select('*')
        .eq('account_id', hsaId)
        .eq('activity_type', 'transfer_in')
        .single();

      expect(data!.amount).toBe(1825.0);
      expect(data!.symbol).toBe('BND');
    });
  });

  // ── FEES ──

  describe('account fees', () => {
    it('records account-level fee (no symbol)', async () => {
      await ingestBrokerage({
        transactions: [],
        investmentActivity: [
          {
            date: '2025-06-30',
            activityType: 'fee',
            amount: -35.0,
            description: 'Advisory Fee Q2 2025',
          },
        ],
        balances: [],
        holdings: [],
      });

      const { data } = await db()
        .from('investment_activity')
        .select('*')
        .eq('account_id', brokerageId)
        .eq('activity_type', 'fee')
        .single();

      expect(data!.symbol).toBeNull();
      expect(data!.amount).toBe(-35.0);
      expect(data!.quantity).toBeNull();
    });

    it('records interest income (margin/cash sweep)', async () => {
      await ingestBrokerage({
        transactions: [],
        investmentActivity: [
          {
            date: '2025-06-30',
            activityType: 'interest',
            amount: 4.23,
            description: 'Cash Sweep Interest',
          },
        ],
        balances: [],
        holdings: [],
      });

      const { data } = await db()
        .from('investment_activity')
        .select('*')
        .eq('account_id', brokerageId)
        .eq('activity_type', 'interest')
        .single();

      expect(data!.amount).toBe(4.23);
      expect(data!.symbol).toBeNull();
    });
  });

  // ── HOLDINGS SNAPSHOTS OVER TIME ──

  describe('holdings snapshots over time', () => {
    it('records Jan snapshot', async () => {
      await ingestBrokerage({
        transactions: [],
        investmentActivity: [],
        balances: [{ date: '2025-01-31', balance: 34500.0 }],
        holdings: [
          {
            asOf: '2025-01-31',
            symbol: 'VTI',
            quantity: 50,
            price: 252.0,
            marketValue: 12600.0,
            costBasis: 12500.0,
            assetClass: 'equity',
          },
          {
            asOf: '2025-01-31',
            symbol: 'VXUS',
            quantity: 100,
            price: 59.0,
            marketValue: 5900.0,
            costBasis: 5800.0,
            assetClass: 'equity',
          },
          {
            asOf: '2025-01-31',
            symbol: 'BND',
            quantity: 75,
            price: 72.5,
            marketValue: 5437.5,
            costBasis: 5400.0,
            assetClass: 'fixed_income',
          },
          {
            asOf: '2025-01-31',
            symbol: 'AAPL',
            quantity: 25,
            price: 188.0,
            marketValue: 4700.0,
            costBasis: 4637.5,
            assetClass: 'equity',
          },
          {
            asOf: '2025-01-31',
            symbol: 'MSFT',
            quantity: 15,
            price: 380.0,
            marketValue: 5700.0,
            costBasis: 5625.0,
            assetClass: 'equity',
          },
        ],
      });

      const { data } = await db()
        .from('holding')
        .select('*')
        .eq('account_id', brokerageId)
        .eq('as_of', '2025-01-31')
        .order('symbol');

      expect(data).toHaveLength(5);
    });

    it('records Mar snapshot with changed positions', async () => {
      await ingestBrokerage({
        transactions: [],
        investmentActivity: [],
        balances: [{ date: '2025-03-31', balance: 42000.0 }],
        holdings: [
          {
            asOf: '2025-03-31',
            symbol: 'VTI',
            quantity: 90,
            price: 260.0,
            marketValue: 23400.0,
            costBasis: 22560.0,
            assetClass: 'equity',
          },
          {
            asOf: '2025-03-31',
            symbol: 'VXUS',
            quantity: 100,
            price: 57.5,
            marketValue: 5750.0,
            costBasis: 5800.0,
            assetClass: 'equity',
          },
          {
            asOf: '2025-03-31',
            symbol: 'BND',
            quantity: 75,
            price: 71.0,
            marketValue: 5325.0,
            costBasis: 5400.0,
            assetClass: 'fixed_income',
          },
          {
            asOf: '2025-03-31',
            symbol: 'AAPL',
            quantity: 25,
            price: 192.0,
            marketValue: 4800.0,
            costBasis: 4637.5,
            assetClass: 'equity',
          },
          {
            asOf: '2025-03-31',
            symbol: 'MSFT',
            quantity: 15,
            price: 385.0,
            marketValue: 5775.0,
            costBasis: 5625.0,
            assetClass: 'equity',
          },
          {
            asOf: '2025-03-31',
            symbol: 'AMZN',
            quantity: 1.055,
            price: 190.0,
            marketValue: 200.45,
            costBasis: 199.99,
            assetClass: 'equity',
          },
          {
            asOf: '2025-03-31',
            symbol: 'GOOGL',
            quantity: 0.583,
            price: 175.0,
            marketValue: 102.03,
            costBasis: 100.0,
            assetClass: 'equity',
          },
        ],
      });

      const { data } = await db()
        .from('holding')
        .select('*')
        .eq('account_id', brokerageId)
        .eq('as_of', '2025-03-31')
        .order('symbol');

      expect(data).toHaveLength(7); // added AMZN + GOOGL
      // VTI quantity should reflect DCA buys
      const vti = data!.find((h: any) => h.symbol === 'VTI');
      expect(vti!.quantity).toBe(90);
    });

    it('Jan snapshot is unchanged (separate date)', async () => {
      const { data } = await db()
        .from('holding')
        .select('*')
        .eq('account_id', brokerageId)
        .eq('as_of', '2025-01-31');

      expect(data).toHaveLength(5); // still 5 — Jan unaffected
    });

    it('updates a snapshot in place when re-ingested with new prices', async () => {
      // Price correction for March
      await ingestBrokerage({
        transactions: [],
        investmentActivity: [],
        balances: [],
        holdings: [
          {
            asOf: '2025-03-31',
            symbol: 'VTI',
            quantity: 90,
            price: 261.5,
            marketValue: 23535.0,
            costBasis: 22560.0,
            assetClass: 'equity',
          },
        ],
      });

      const { data } = await db()
        .from('holding')
        .select('*')
        .eq('account_id', brokerageId)
        .eq('as_of', '2025-03-31')
        .eq('symbol', 'VTI')
        .single();

      expect(data!.price).toBe(261.5); // updated
      expect(data!.market_value).toBe(23535.0); // updated

      // Other March holdings untouched
      const { data: allMarch } = await db()
        .from('holding')
        .select('*')
        .eq('account_id', brokerageId)
        .eq('as_of', '2025-03-31');

      expect(allMarch).toHaveLength(7); // still 7
    });

    it('records sold position disappearing from later snapshot', async () => {
      // By May, MSFT was fully sold — should not appear in May holdings
      await ingestBrokerage({
        transactions: [],
        investmentActivity: [],
        balances: [{ date: '2025-05-31', balance: 45000.0 }],
        holdings: [
          {
            asOf: '2025-05-31',
            symbol: 'VTI',
            quantity: 110,
            price: 270.0,
            marketValue: 29700.0,
            costBasis: 27800.0,
            assetClass: 'equity',
          },
          {
            asOf: '2025-05-31',
            symbol: 'VXUS',
            quantity: 100,
            price: 60.0,
            marketValue: 6000.0,
            costBasis: 5800.0,
            assetClass: 'equity',
          },
          {
            asOf: '2025-05-31',
            symbol: 'BND',
            quantity: 75,
            price: 72.0,
            marketValue: 5400.0,
            costBasis: 5400.0,
            assetClass: 'fixed_income',
          },
          {
            asOf: '2025-05-31',
            symbol: 'AAPL',
            quantity: 10,
            price: 198.0,
            marketValue: 1980.0,
            costBasis: 1855.0,
            assetClass: 'equity',
          },
          // No MSFT — sold in May
          {
            asOf: '2025-05-31',
            symbol: 'AMZN',
            quantity: 1.055,
            price: 195.0,
            marketValue: 205.73,
            costBasis: 199.99,
            assetClass: 'equity',
          },
          {
            asOf: '2025-05-31',
            symbol: 'GOOGL',
            quantity: 0.583,
            price: 180.0,
            marketValue: 104.94,
            costBasis: 100.0,
            assetClass: 'equity',
          },
        ],
      });

      const { data: mayHoldings } = await db()
        .from('holding')
        .select('symbol')
        .eq('account_id', brokerageId)
        .eq('as_of', '2025-05-31');

      const symbols = mayHoldings!.map((h: any) => h.symbol);
      expect(symbols).not.toContain('MSFT');
      expect(symbols).toContain('VTI');
      expect(mayHoldings).toHaveLength(6);

      // But MSFT still exists in earlier snapshots
      const { data: marMsft } = await db()
        .from('holding')
        .select('*')
        .eq('account_id', brokerageId)
        .eq('as_of', '2025-03-31')
        .eq('symbol', 'MSFT');

      expect(marMsft).toHaveLength(1);
    });
  });

  // ── ASSET CLASS TRACKING ──

  describe('asset class categorization', () => {
    it('tracks asset classes across holdings', async () => {
      const { data } = await db()
        .from('holding')
        .select('asset_class, symbol')
        .eq('account_id', brokerageId)
        .eq('as_of', '2025-03-31');

      const equities = data!.filter((h: any) => h.asset_class === 'equity');
      const fixedIncome = data!.filter((h: any) => h.asset_class === 'fixed_income');

      expect(equities.length).toBeGreaterThanOrEqual(5); // VTI, VXUS, AAPL, MSFT, AMZN, GOOGL
      expect(fixedIncome.length).toBeGreaterThanOrEqual(1); // BND
    });
  });

  // ── LOT TRACKING ──

  describe('lot tracking', () => {
    it('records lot IDs when provided', async () => {
      await ingestRetirement({
        transactions: [],
        investmentActivity: [
          {
            date: '2025-03-01',
            activityType: 'buy',
            symbol: 'VTI',
            quantity: 10,
            price: 260.0,
            amount: -2600.0,
            lotId: 'LOT-001',
          },
          {
            date: '2025-04-01',
            activityType: 'buy',
            symbol: 'VTI',
            quantity: 10,
            price: 255.0,
            amount: -2550.0,
            lotId: 'LOT-002',
          },
          {
            date: '2025-05-01',
            activityType: 'sell',
            symbol: 'VTI',
            quantity: 5,
            price: 270.0,
            amount: 1350.0,
            lotId: 'LOT-001',
            description: 'Specific lot sale',
          },
        ],
        balances: [],
        holdings: [],
      });

      const { data } = await db()
        .from('investment_activity')
        .select('activity_type, lot_id, quantity')
        .eq('account_id', retirementId)
        .not('lot_id', 'is', null)
        .order('date');

      expect(data).toHaveLength(3);
      expect(data![0].lot_id).toBe('LOT-001');
      expect(data![1].lot_id).toBe('LOT-002');
      // Sell references LOT-001 specifically
      expect(data![2].lot_id).toBe('LOT-001');
      expect(data![2].activity_type).toBe('sell');
    });
  });

  // ── PROVIDER vs MANUAL DEDUP ──

  describe('dedup with provider IDs vs fingerprints', () => {
    it('deduplicates on provider_txn_id when present', async () => {
      await ingestRetirement({
        transactions: [],
        investmentActivity: [
          {
            date: '2025-06-01',
            activityType: 'buy',
            symbol: 'QQQ',
            quantity: 5,
            price: 450.0,
            amount: -2250.0,
            providerTxnId: 'snap_txn_001',
          },
        ],
        balances: [],
        holdings: [],
      });

      // Ingest same provider txn again
      await ingestRetirement({
        transactions: [],
        investmentActivity: [
          {
            date: '2025-06-01',
            activityType: 'buy',
            symbol: 'QQQ',
            quantity: 5,
            price: 450.0,
            amount: -2250.0,
            providerTxnId: 'snap_txn_001',
          },
        ],
        balances: [],
        holdings: [],
      });

      const { data } = await db()
        .from('investment_activity')
        .select('*')
        .eq('account_id', retirementId)
        .eq('symbol', 'QQQ');

      expect(data).toHaveLength(1); // deduped on provider_txn_id
    });

    it('fingerprint dedup works for manual entries without provider IDs', async () => {
      await ingestRetirement({
        transactions: [],
        investmentActivity: [
          { date: '2025-06-10', activityType: 'dividend', symbol: 'QQQ', amount: 8.5 },
        ],
        balances: [],
        holdings: [],
      });

      // Same manual entry again
      await ingestRetirement({
        transactions: [],
        investmentActivity: [
          { date: '2025-06-10', activityType: 'dividend', symbol: 'QQQ', amount: 8.5 },
        ],
        balances: [],
        holdings: [],
      });

      const { data } = await db()
        .from('investment_activity')
        .select('*')
        .eq('account_id', retirementId)
        .eq('symbol', 'QQQ')
        .eq('activity_type', 'dividend');

      expect(data).toHaveLength(1);
    });
  });

  // ── MULTI-ACCOUNT ISOLATION ──

  describe('cross-account isolation', () => {
    it('same symbol in different accounts stays separate', async () => {
      // HSA also holds VTI
      await ingestHsa({
        transactions: [],
        investmentActivity: [
          {
            date: '2025-03-01',
            activityType: 'buy',
            symbol: 'VTI',
            quantity: 5,
            price: 260.0,
            amount: -1300.0,
          },
        ],
        balances: [],
        holdings: [
          {
            asOf: '2025-03-31',
            symbol: 'VTI',
            quantity: 5,
            price: 260.0,
            marketValue: 1300.0,
            costBasis: 1300.0,
            assetClass: 'equity',
          },
        ],
      });

      const { data: hsaVti } = await db()
        .from('holding')
        .select('*')
        .eq('account_id', hsaId)
        .eq('symbol', 'VTI');

      const { data: brokerageVti } = await db()
        .from('holding')
        .select('*')
        .eq('account_id', brokerageId)
        .eq('symbol', 'VTI')
        .eq('as_of', '2025-03-31');

      expect(hsaVti).toHaveLength(1);
      expect(hsaVti![0].quantity).toBe(5);
      expect(brokerageVti).toHaveLength(1);
      expect(brokerageVti![0].quantity).toBe(90); // brokerage has way more
    });

    it('household-level query aggregates across accounts', async () => {
      const { data } = await db()
        .from('holding')
        .select('account_id, symbol, quantity, market_value')
        .eq('household_id', householdId)
        .eq('symbol', 'VTI')
        .order('market_value', { ascending: false });

      // VTI in brokerage + retirement (transfer_in) + HSA
      expect(data!.length).toBeGreaterThanOrEqual(2);
      const totalValue = data!.reduce((sum: number, h: any) => sum + h.market_value, 0);
      expect(totalValue).toBeGreaterThan(0);
    });
  });

  // ── BALANCE HISTORY ──

  describe('balance history across snapshots', () => {
    it('tracks balance changes over time', async () => {
      const { data } = await db()
        .from('balance_snapshot')
        .select('date, balance')
        .eq('account_id', brokerageId)
        .order('date');

      expect(data!.length).toBeGreaterThanOrEqual(3); // Jan, Mar, May
      // Balances should generally increase (we kept buying)
      const first = data![0].balance;
      const last = data![data!.length - 1].balance;
      expect(last).toBeGreaterThan(first);
    });
  });
});
