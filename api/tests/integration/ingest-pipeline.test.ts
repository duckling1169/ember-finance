import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  createTestHousehold,
  createTestAccount,
  createTestSource,
  cleanupTestHousehold,
  getTestClient,
} from '../helpers.js';
import { processIngest } from '../../src/services/ingest.js';
import type { IngestResult } from '../../src/types/index.js';

describe('ingest pipeline (DB integration)', () => {
  let householdId: string;
  let checkingAccountId: string;
  let brokerageAccountId: string;
  let checkingSourceId: string;
  let brokerageSourceId: string;

  beforeAll(async () => {
    const ctx = await createTestHousehold();
    householdId = ctx.householdId;

    const checking = await createTestAccount(householdId, {
      name: 'Test Checking',
      account_type: 'checking',
    });
    checkingAccountId = checking.id;

    const brokerage = await createTestAccount(householdId, {
      name: 'Test Brokerage',
      account_type: 'brokerage',
    });
    brokerageAccountId = brokerage.id;

    const checkingSrc = await createTestSource(checkingAccountId, householdId, 'manual');
    checkingSourceId = checkingSrc.id;

    const brokerageSrc = await createTestSource(brokerageAccountId, householdId, 'manual');
    brokerageSourceId = brokerageSrc.id;
  });

  afterAll(async () => {
    await cleanupTestHousehold(householdId);
  });

  describe('transactions', () => {
    it('ingests cash transactions', async () => {
      const result: IngestResult = {
        transactions: [
          { date: '2025-01-15', amount: -42.50, description: 'Grocery Store' },
          { date: '2025-01-16', amount: 3000, description: 'Paycheck', category: 'income' },
          { date: '2025-01-17', amount: -1200, description: 'Rent', isTransfer: true },
        ],
        investmentActivity: [],
        balances: [],
        holdings: [],
      };

      const ingest = await processIngest(
        {
          householdId,
          accountId: checkingAccountId,
          sourceId: checkingSourceId,
          sourceType: 'manual_entry',
        },
        result
      );

      expect(ingest.rawIngestId).toBeTruthy();
      expect(ingest.recordCount).toBe(3);

      // Verify transactions in DB
      const db = getTestClient();
      const { data: txns } = await db
        .from('transaction')
        .select('*')
        .eq('account_id', checkingAccountId)
        .order('date', { ascending: true });

      expect(txns).toHaveLength(3);
      expect(txns![0].amount).toBe(-42.50);
      expect(txns![0].description).toBe('Grocery Store');
      expect(txns![0].fingerprint).toBeTruthy();
      expect(txns![1].category).toBe('income');
      expect(txns![2].is_transfer).toBe(true);
    });

    it('deduplicates transactions on re-ingest (same fingerprint)', async () => {
      const result: IngestResult = {
        transactions: [
          { date: '2025-01-15', amount: -42.50, description: 'Grocery Store' },
        ],
        investmentActivity: [],
        balances: [],
        holdings: [],
      };

      // Ingest same transaction again
      await processIngest(
        {
          householdId,
          accountId: checkingAccountId,
          sourceId: checkingSourceId,
          sourceType: 'manual_entry',
        },
        result
      );

      const db = getTestClient();
      const { data: txns } = await db
        .from('transaction')
        .select('*')
        .eq('account_id', checkingAccountId)
        .eq('description', 'Grocery Store');

      // Should still be 1, not 2
      expect(txns).toHaveLength(1);
    });

    it('allows different transactions on same date', async () => {
      const result: IngestResult = {
        transactions: [
          { date: '2025-01-15', amount: -15.00, description: 'Coffee' },
        ],
        investmentActivity: [],
        balances: [],
        holdings: [],
      };

      await processIngest(
        {
          householdId,
          accountId: checkingAccountId,
          sourceId: checkingSourceId,
          sourceType: 'manual_entry',
        },
        result
      );

      const db = getTestClient();
      const { data: txns } = await db
        .from('transaction')
        .select('*')
        .eq('account_id', checkingAccountId)
        .eq('date', '2025-01-15');

      // Original grocery + new coffee
      expect(txns!.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('investment activity', () => {
    it('ingests buy/sell/dividend activity', async () => {
      const result: IngestResult = {
        transactions: [],
        investmentActivity: [
          {
            date: '2025-01-10',
            activityType: 'buy',
            symbol: 'VTI',
            quantity: 10,
            price: 250.00,
            amount: -2500.00,
            commission: 0,
          },
          {
            date: '2025-01-20',
            activityType: 'dividend',
            symbol: 'VTI',
            amount: 15.50,
            description: 'Quarterly dividend',
          },
          {
            date: '2025-01-25',
            activityType: 'sell',
            symbol: 'VTI',
            quantity: 2,
            price: 255.00,
            amount: 510.00,
            commission: 0,
          },
        ],
        balances: [],
        holdings: [],
      };

      const ingest = await processIngest(
        {
          householdId,
          accountId: brokerageAccountId,
          sourceId: brokerageSourceId,
          sourceType: 'manual_entry',
        },
        result
      );

      expect(ingest.recordCount).toBe(3);

      const db = getTestClient();
      const { data: activities } = await db
        .from('investment_activity')
        .select('*')
        .eq('account_id', brokerageAccountId)
        .order('date', { ascending: true });

      expect(activities).toHaveLength(3);
      expect(activities![0].activity_type).toBe('buy');
      expect(activities![0].quantity).toBe(10);
      expect(activities![0].price).toBe(250.00);
      expect(activities![1].activity_type).toBe('dividend');
      expect(activities![1].amount).toBe(15.50);
      expect(activities![2].activity_type).toBe('sell');
    });

    it('deduplicates investment activity', async () => {
      const result: IngestResult = {
        transactions: [],
        investmentActivity: [
          {
            date: '2025-01-10',
            activityType: 'buy',
            symbol: 'VTI',
            quantity: 10,
            price: 250.00,
            amount: -2500.00,
          },
        ],
        balances: [],
        holdings: [],
      };

      await processIngest(
        {
          householdId,
          accountId: brokerageAccountId,
          sourceId: brokerageSourceId,
          sourceType: 'manual_entry',
        },
        result
      );

      const db = getTestClient();
      const { data } = await db
        .from('investment_activity')
        .select('*')
        .eq('account_id', brokerageAccountId)
        .eq('activity_type', 'buy')
        .eq('symbol', 'VTI');

      expect(data).toHaveLength(1);
    });
  });

  describe('holdings', () => {
    it('ingests holdings snapshot', async () => {
      const result: IngestResult = {
        transactions: [],
        investmentActivity: [],
        balances: [],
        holdings: [
          {
            asOf: '2025-01-31',
            symbol: 'VTI',
            name: 'Vanguard Total Stock Market ETF',
            quantity: 8,
            price: 255.00,
            marketValue: 2040.00,
            costBasis: 2000.00,
            assetClass: 'equity',
          },
          {
            asOf: '2025-01-31',
            symbol: 'BND',
            name: 'Vanguard Total Bond Market ETF',
            quantity: 50,
            price: 72.00,
            marketValue: 3600.00,
            costBasis: 3500.00,
            assetClass: 'fixed_income',
          },
        ],
      };

      await processIngest(
        {
          householdId,
          accountId: brokerageAccountId,
          sourceId: brokerageSourceId,
          sourceType: 'manual_entry',
        },
        result
      );

      const db = getTestClient();
      const { data: holdings } = await db
        .from('holding')
        .select('*')
        .eq('account_id', brokerageAccountId)
        .eq('as_of', '2025-01-31')
        .order('symbol');

      expect(holdings).toHaveLength(2);
      expect(holdings![0].symbol).toBe('BND');
      expect(holdings![0].asset_class).toBe('fixed_income');
      expect(holdings![1].symbol).toBe('VTI');
      expect(holdings![1].market_value).toBe(2040.00);
    });

    it('updates holdings on re-ingest (upsert replaces)', async () => {
      const result: IngestResult = {
        transactions: [],
        investmentActivity: [],
        balances: [],
        holdings: [
          {
            asOf: '2025-01-31',
            symbol: 'VTI',
            name: 'Vanguard Total Stock Market ETF',
            quantity: 8,
            price: 260.00,       // price changed
            marketValue: 2080.00, // value changed
            costBasis: 2000.00,
            assetClass: 'equity',
          },
        ],
      };

      await processIngest(
        {
          householdId,
          accountId: brokerageAccountId,
          sourceId: brokerageSourceId,
          sourceType: 'manual_entry',
        },
        result
      );

      const db = getTestClient();
      const { data } = await db
        .from('holding')
        .select('*')
        .eq('account_id', brokerageAccountId)
        .eq('as_of', '2025-01-31')
        .eq('symbol', 'VTI')
        .single();

      // Should be updated, not duplicated
      expect(data!.price).toBe(260.00);
      expect(data!.market_value).toBe(2080.00);
    });
  });

  describe('balances', () => {
    it('ingests balance snapshots', async () => {
      const result: IngestResult = {
        transactions: [],
        investmentActivity: [],
        balances: [
          { date: '2025-01-31', balance: 5432.10, available: 5432.10 },
        ],
        holdings: [],
      };

      await processIngest(
        {
          householdId,
          accountId: checkingAccountId,
          sourceId: checkingSourceId,
          sourceType: 'manual_entry',
        },
        result
      );

      const db = getTestClient();
      const { data } = await db
        .from('balance_snapshot')
        .select('*')
        .eq('account_id', checkingAccountId)
        .eq('date', '2025-01-31')
        .single();

      expect(data!.balance).toBe(5432.10);
      expect(data!.available).toBe(5432.10);
      expect(data!.source).toBe('manual');
    });
  });

  describe('raw_ingest tracking', () => {
    it('marks successful ingest as processed', async () => {
      const result: IngestResult = {
        transactions: [{ date: '2025-02-01', amount: -10, description: 'Test' }],
        investmentActivity: [],
        balances: [],
        holdings: [],
      };

      const ingest = await processIngest(
        {
          householdId,
          accountId: checkingAccountId,
          sourceId: checkingSourceId,
          sourceType: 'manual_entry',
          sourceRef: 'test-ref-123',
        },
        result
      );

      const db = getTestClient();
      const { data } = await db
        .from('raw_ingest')
        .select('*')
        .eq('id', ingest.rawIngestId)
        .single();

      expect(data!.status).toBe('processed');
      expect(data!.processed_at).toBeTruthy();
      expect(data!.source_type).toBe('manual_entry');
      expect(data!.source_ref).toBe('test-ref-123');
      expect(data!.record_count).toBe(1);
      expect(data!.error).toBeNull();
    });

    it('updates last_synced on account_source', async () => {
      const db = getTestClient();
      const { data } = await db
        .from('account_source')
        .select('last_synced')
        .eq('id', checkingSourceId)
        .single();

      expect(data!.last_synced).toBeTruthy();
    });

    it('preserves raw payload in raw_ingest', async () => {
      const db = getTestClient();
      const { data } = await db
        .from('raw_ingest')
        .select('payload')
        .eq('household_id', householdId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      expect(data!.payload).toHaveProperty('transactions');
      expect(data!.payload).toHaveProperty('investmentActivity');
      expect(data!.payload).toHaveProperty('balances');
      expect(data!.payload).toHaveProperty('holdings');
    });
  });

  describe('mixed ingest', () => {
    it('ingests transactions + balances + holdings in one call', async () => {
      const result: IngestResult = {
        transactions: [
          { date: '2025-03-01', amount: -100, description: 'Mixed test txn' },
        ],
        investmentActivity: [
          { date: '2025-03-01', activityType: 'buy', symbol: 'VXUS', amount: -500, quantity: 5, price: 100 },
        ],
        balances: [
          { date: '2025-03-01', balance: 10000 },
        ],
        holdings: [
          { asOf: '2025-03-01', symbol: 'VXUS', quantity: 5, marketValue: 500 },
        ],
      };

      const ingest = await processIngest(
        {
          householdId,
          accountId: brokerageAccountId,
          sourceId: brokerageSourceId,
          sourceType: 'manual_entry',
        },
        result
      );

      expect(ingest.recordCount).toBe(4);
    });
  });
});
