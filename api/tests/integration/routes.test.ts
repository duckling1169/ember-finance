import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Hono } from 'hono';
import { accountsRoute } from '../../src/routes/accounts.js';
import { ingestRoute } from '../../src/routes/ingest.js';
import {
  createTestHousehold,
  cleanupTestHousehold,
  stubAuth,
  stubHouseholdMember,
} from '../helpers.js';
import type { AuthEnv } from '../../src/middleware/auth.js';

// Build a test app with stub auth + household member middleware
const app = new Hono<AuthEnv>();
app.use('/api/*', stubAuth());
app.use('/api/accounts/:householdId', stubHouseholdMember());
app.use('/api/accounts/:householdId/*', stubHouseholdMember());
app.use('/api/ingest/manual/:householdId/*', stubHouseholdMember());
app.use('/api/ingest/sync/:householdId/*', stubHouseholdMember());
app.route('/api/accounts', accountsRoute);
app.route('/api/ingest', ingestRoute);

function req(method: string, path: string, body?: unknown) {
  const init: RequestInit = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) init.body = JSON.stringify(body);
  return app.request(path, init);
}

describe('API routes', () => {
  let householdId: string;
  let accountId: string;

  beforeAll(async () => {
    const ctx = await createTestHousehold();
    householdId = ctx.householdId;
  });

  afterAll(async () => {
    await cleanupTestHousehold(householdId);
  });

  describe('POST /api/accounts/:householdId', () => {
    it('creates an account and returns 201', async () => {
      const res = await req('POST', `/api/accounts/${householdId}`, {
        name: 'Route Test Checking',
        institution: 'Chase',
        account_type: 'checking',
      });

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.name).toBe('Route Test Checking');
      expect(data.is_liability).toBe(false);
      accountId = data.id;
    });

    it('auto-sets is_liability for credit accounts', async () => {
      const res = await req('POST', `/api/accounts/${householdId}`, {
        name: 'Test Credit Card',
        account_type: 'credit',
      });

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.is_liability).toBe(true);
    });

    it('rejects invalid account_type', async () => {
      const res = await req('POST', `/api/accounts/${householdId}`, {
        name: 'Bad Account',
        account_type: 'invalid_type',
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('Invalid account_type');
    });
  });

  describe('GET /api/accounts/:householdId', () => {
    it('lists accounts for the household', async () => {
      const res = await req('GET', `/api/accounts/${householdId}`);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('PATCH /api/accounts/:householdId/:accountId', () => {
    it('updates account name', async () => {
      const res = await req('PATCH', `/api/accounts/${householdId}/${accountId}`, {
        name: 'Updated Checking',
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.name).toBe('Updated Checking');
    });

    it('cannot change household_id', async () => {
      const res = await req('PATCH', `/api/accounts/${householdId}/${accountId}`, {
        household_id: '00000000-0000-0000-0000-000000000000',
        name: 'Sneaky Update',
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.household_id).toBe(householdId); // unchanged
    });
  });

  describe('POST /api/ingest/manual/:householdId/:accountId', () => {
    it('ingests manual transactions via API', async () => {
      const res = await req('POST', `/api/ingest/manual/${householdId}/${accountId}`, {
        transactions: [{ date: '2025-06-01', amount: -25.0, description: 'Route test txn' }],
      });

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.rawIngestId).toBeTruthy();
      expect(data.recordCount).toBe(1);
    });

    it('ingests manual balances via API', async () => {
      const res = await req('POST', `/api/ingest/manual/${householdId}/${accountId}`, {
        balances: [{ date: '2025-06-01', balance: 1000.0 }],
      });

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.recordCount).toBe(1);
    });

    it('returns 404 for nonexistent account', async () => {
      const res = await req(
        'POST',
        `/api/ingest/manual/${householdId}/00000000-0000-0000-0000-000000000000`,
        { transactions: [] },
      );

      expect(res.status).toBe(404);
    });

    it('auto-creates manual source if none exists', async () => {
      // Create a fresh account with no sources
      const accRes = await req('POST', `/api/accounts/${householdId}`, {
        name: 'No Source Account',
        account_type: 'savings',
      });
      const newAccountId = (await accRes.json()).id;

      const res = await req('POST', `/api/ingest/manual/${householdId}/${newAccountId}`, {
        transactions: [{ date: '2025-06-01', amount: 50, description: 'Auto source test' }],
      });

      expect(res.status).toBe(201);

      // Verify source was auto-created via account detail endpoint
      const detailRes = await req('GET', `/api/accounts/${householdId}/${newAccountId}`);
      expect(detailRes.status).toBe(200);
      const detail = await detailRes.json();
      expect(detail.sources.length).toBeGreaterThanOrEqual(1);
      expect(detail.sources[0].provider).toBe('manual');
    });
  });

  describe('POST /api/ingest/manual (legacy UI payload compatibility)', () => {
    let manualAccountId: string;

    it('creates a fresh account for UI-style manual entry tests', async () => {
      const res = await req('POST', `/api/accounts/${householdId}`, {
        name: 'Manual Entry Test Account',
        account_type: 'checking',
      });
      expect(res.status).toBe(201);
      manualAccountId = (await res.json()).id;
    });

    it('entry_type=current creates a balance snapshot', async () => {
      const res = await req('POST', `/api/ingest/manual/${householdId}/${manualAccountId}`, {
        entry_type: 'current',
        amount: 5000,
        description: 'Updated balance',
      });

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.rawIngestId).toBeTruthy();
      expect(data.recordCount).toBe(1);

      // Verify balance snapshot was created
      const balRes = await req('GET', `/api/accounts/${householdId}/${manualAccountId}/balances`);
      const balances = await balRes.json();
      expect(balances.length).toBeGreaterThanOrEqual(1);
      const latest = balances[balances.length - 1];
      expect(Number(latest.balance)).toBe(5000);
    });

    it('entry_type=delta creates a transaction', async () => {
      const res = await req('POST', `/api/ingest/manual/${householdId}/${manualAccountId}`, {
        entry_type: 'delta',
        amount: -42.5,
        description: 'Coffee shop',
      });

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.rawIngestId).toBeTruthy();
      expect(data.recordCount).toBe(1);

      // Verify transaction was created
      const db = (await import('../helpers.js')).getTestClient();
      const { data: txns } = await db
        .from('transaction')
        .select('*')
        .eq('account_id', manualAccountId)
        .eq('description', 'Coffee shop');
      expect(txns).toBeTruthy();
      expect(txns!.length).toBeGreaterThanOrEqual(1);
      expect(Number(txns![0].amount)).toBe(-42.5);
    });

    it('entry_type=delta uses default description when none provided', async () => {
      const res = await req('POST', `/api/ingest/manual/${householdId}/${manualAccountId}`, {
        entry_type: 'delta',
        amount: 100,
      });

      expect(res.status).toBe(201);

      const db = (await import('../helpers.js')).getTestClient();
      const { data: txns } = await db
        .from('transaction')
        .select('*')
        .eq('account_id', manualAccountId)
        .eq('description', 'Manual entry');
      expect(txns).toBeTruthy();
      expect(txns!.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('POST /api/ingest/sync/:householdId/:sourceId', () => {
    it('returns 501 (not yet implemented)', async () => {
      const res = await req('POST', `/api/ingest/sync/${householdId}/fake-source-id`);
      expect(res.status).toBe(501);
    });
  });

  describe('household isolation', () => {
    it('rejects requests for a nonexistent household', async () => {
      const fakeId = '00000000-0000-0000-0000-999999999999';
      const res = await req('GET', `/api/accounts/${fakeId}`);
      expect(res.status).toBe(403);
    });
  });
});
