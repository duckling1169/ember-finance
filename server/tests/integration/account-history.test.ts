import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Hono } from 'hono';
import { accountsRoute } from '../../src/routes/accounts.js';
import { ingestRoute } from '../../src/routes/ingest.js';
import {
  createTestHousehold,
  createTestAccount,
  cleanupTestHousehold,
  getTestClient,
  stubAuth,
  stubHouseholdMember,
} from '../helpers.js';
import type { AuthEnv } from '../../src/middleware/auth.js';
import { persistIngest } from '../../src/services/ingest.js';
import { createTestSource } from '../helpers.js';

// Build test app
const app = new Hono<AuthEnv>();
app.use('/api/*', stubAuth());
app.use('/api/accounts/:householdId', stubHouseholdMember());
app.use('/api/accounts/:householdId/*', stubHouseholdMember());
app.use('/api/ingest/manual/:householdId/*', stubHouseholdMember());
app.route('/api/accounts', accountsRoute);
app.route('/api/ingest', ingestRoute);

function req(method: string, path: string, body?: unknown) {
  const init: RequestInit = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) init.body = JSON.stringify(body);
  return app.request(path, init);
}

describe('Account history, timeline, and enrichment', () => {
  let householdId: string;
  let checkingAccountId: string;
  let brokerageAccountId: string;
  let creditAccountId: string;

  beforeAll(async () => {
    const ctx = await createTestHousehold();
    householdId = ctx.householdId;
  });

  afterAll(async () => {
    await cleanupTestHousehold(householdId);
  });

  // ── Timeline event creation ──

  describe('account timeline events', () => {
    it('creates account_created event on POST', async () => {
      const res = await req('POST', `/api/accounts/${householdId}`, {
        name: 'Timeline Checking',
        institution: 'Chase',
        account_type: 'checking',
      });
      expect(res.status).toBe(201);
      checkingAccountId = (await res.json()).id;

      const db = getTestClient();
      const { data: events } = await db
        .from('account_event')
        .select('*')
        .eq('account_id', checkingAccountId)
        .eq('event_type', 'account_created');

      expect(events).toBeTruthy();
      expect(events!.length).toBe(1);
      expect(events![0].detail).toHaveProperty('name', 'Timeline Checking');
      expect(events![0].detail).toHaveProperty('account_type', 'checking');
    });

    it('creates account_updated event on PATCH', async () => {
      const res = await req('PATCH', `/api/accounts/${householdId}/${checkingAccountId}`, {
        name: 'Updated Checking',
      });
      expect(res.status).toBe(200);

      const db = getTestClient();
      const { data: events } = await db
        .from('account_event')
        .select('*')
        .eq('account_id', checkingAccountId)
        .eq('event_type', 'account_updated');

      expect(events).toBeTruthy();
      expect(events!.length).toBe(1);
      expect(events![0].detail).toHaveProperty('fields_changed');
      expect(events![0].detail.fields_changed).toContain('name');
    });

    it('creates account_deactivated event on DELETE', async () => {
      // Create a throwaway account to deactivate
      const createRes = await req('POST', `/api/accounts/${householdId}`, {
        name: 'To Deactivate',
        account_type: 'savings',
      });
      const deactivateId = (await createRes.json()).id;

      const res = await req('DELETE', `/api/accounts/${householdId}/${deactivateId}`);
      expect(res.status).toBe(200);

      const db = getTestClient();
      const { data: events } = await db
        .from('account_event')
        .select('*')
        .eq('account_id', deactivateId)
        .eq('event_type', 'account_deactivated');

      expect(events).toBeTruthy();
      expect(events!.length).toBe(1);
      expect(events![0].detail).toHaveProperty('name', 'To Deactivate');
    });
  });

  // ── Timeline query endpoint ──

  describe('GET /:householdId/:accountId/history', () => {
    it('returns timeline events in descending order', async () => {
      const res = await req('GET', `/api/accounts/${householdId}/${checkingAccountId}/history`);
      expect(res.status).toBe(200);
      const data = await res.json();

      // Should have at least account_created + account_updated events
      expect(data.length).toBeGreaterThanOrEqual(2);

      // Verify descending order
      for (let i = 1; i < data.length; i++) {
        expect(data[i - 1].created_at >= data[i].created_at).toBe(true);
      }
    });

    it('supports limit parameter', async () => {
      const res = await req(
        'GET',
        `/api/accounts/${householdId}/${checkingAccountId}/history?limit=1`,
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.length).toBe(1);
    });

    it('supports offset parameter', async () => {
      const allRes = await req('GET', `/api/accounts/${householdId}/${checkingAccountId}/history`);
      const allData = await allRes.json();

      const offsetRes = await req(
        'GET',
        `/api/accounts/${householdId}/${checkingAccountId}/history?limit=1&offset=1`,
      );
      const offsetData = await offsetRes.json();

      expect(offsetData.length).toBe(1);
      // Offset=1 should return the second event
      if (allData.length > 1) {
        expect(offsetData[0].id).toBe(allData[1].id);
      }
    });
  });

  // ── Balance history ──

  describe('balance history', () => {
    beforeAll(async () => {
      // Create accounts for balance tests
      const brokerage = await createTestAccount(householdId, {
        name: 'Test Brokerage',
        account_type: 'brokerage',
      });
      brokerageAccountId = brokerage.id;

      const credit = await createTestAccount(householdId, {
        name: 'Test Credit Card',
        account_type: 'credit',
        is_liability: true,
      });
      creditAccountId = credit.id;

      // Create sources
      const checkSrc = await createTestSource(checkingAccountId, householdId);
      const brokSrc = await createTestSource(brokerageAccountId, householdId);
      const creditSrc = await createTestSource(creditAccountId, householdId);

      // Ingest balance snapshots for checking
      await persistIngest(
        {
          householdId,
          accountId: checkingAccountId,
          sourceId: checkSrc.id,
          sourceType: 'manual_entry',
        },
        {
          transactions: [],
          investmentActivity: [],
          holdings: [],
          balances: [
            { date: '2025-01-15', balance: 10000 },
            { date: '2025-06-15', balance: 12000 },
            { date: '2025-12-15', balance: 15000 },
          ],
        },
      );

      // Ingest balance snapshots for brokerage (investment account)
      await persistIngest(
        {
          householdId,
          accountId: brokerageAccountId,
          sourceId: brokSrc.id,
          sourceType: 'manual_entry',
        },
        {
          transactions: [],
          investmentActivity: [],
          holdings: [],
          balances: [
            { date: '2025-01-15', balance: 50000 },
            { date: '2025-06-15', balance: 55000 },
            { date: '2025-12-15', balance: 60000 },
          ],
        },
      );

      // Ingest balance snapshots for credit card (liability)
      await persistIngest(
        {
          householdId,
          accountId: creditAccountId,
          sourceId: creditSrc.id,
          sourceType: 'manual_entry',
        },
        {
          transactions: [],
          investmentActivity: [],
          holdings: [],
          balances: [
            { date: '2025-01-15', balance: 2000 },
            { date: '2025-06-15', balance: 3000 },
            { date: '2025-12-15', balance: 1000 },
          ],
        },
      );
    });

    describe('GET /:householdId/:accountId/balances', () => {
      it('returns all balance snapshots in ascending order', async () => {
        const res = await req('GET', `/api/accounts/${householdId}/${checkingAccountId}/balances`);
        expect(res.status).toBe(200);
        const data = await res.json();

        expect(data.length).toBe(3);
        expect(data[0].date).toBe('2025-01-15');
        expect(data[2].date).toBe('2025-12-15');
        expect(Number(data[0].balance)).toBe(10000);
      });

      it('filters by from date', async () => {
        const res = await req(
          'GET',
          `/api/accounts/${householdId}/${checkingAccountId}/balances?from=2025-06-01`,
        );
        const data = await res.json();

        expect(data.length).toBe(2);
        expect(data[0].date).toBe('2025-06-15');
      });

      it('filters by to date', async () => {
        const res = await req(
          'GET',
          `/api/accounts/${householdId}/${checkingAccountId}/balances?to=2025-06-30`,
        );
        const data = await res.json();

        expect(data.length).toBe(2);
        expect(data[1].date).toBe('2025-06-15');
      });

      it('filters by both from and to', async () => {
        const res = await req(
          'GET',
          `/api/accounts/${householdId}/${checkingAccountId}/balances?from=2025-06-01&to=2025-06-30`,
        );
        const data = await res.json();

        expect(data.length).toBe(1);
        expect(data[0].date).toBe('2025-06-15');
        expect(Number(data[0].balance)).toBe(12000);
      });
    });

    // ── Household-level history ──

    describe('GET /:householdId/history/net-worth', () => {
      it('aggregates balances across all accounts (liabilities subtracted)', async () => {
        const res = await req('GET', `/api/accounts/${householdId}/history/net-worth`);
        expect(res.status).toBe(200);
        const data = await res.json();

        // Should have 3 dates
        expect(data.length).toBe(3);

        // Jan 15: checking 10000 + brokerage 50000 - credit 2000 = 58000
        const jan = data.find((d: { date: string }) => d.date === '2025-01-15');
        expect(jan).toBeTruthy();
        expect(jan.value).toBe(58000);

        // Jun 15: 12000 + 55000 - 3000 = 64000
        const jun = data.find((d: { date: string }) => d.date === '2025-06-15');
        expect(jun).toBeTruthy();
        expect(jun.value).toBe(64000);

        // Dec 15: 15000 + 60000 - 1000 = 74000
        const dec = data.find((d: { date: string }) => d.date === '2025-12-15');
        expect(dec).toBeTruthy();
        expect(dec.value).toBe(74000);
      });

      it('supports date range filtering', async () => {
        const res = await req(
          'GET',
          `/api/accounts/${householdId}/history/net-worth?from=2025-06-01&to=2025-06-30`,
        );
        const data = await res.json();

        expect(data.length).toBe(1);
        expect(data[0].date).toBe('2025-06-15');
        expect(data[0].value).toBe(64000);
      });

      it('returns data in ascending date order', async () => {
        const res = await req('GET', `/api/accounts/${householdId}/history/net-worth`);
        const data = await res.json();

        for (let i = 1; i < data.length; i++) {
          expect(data[i].date > data[i - 1].date).toBe(true);
        }
      });
    });

    describe('GET /:householdId/history/investments', () => {
      it('aggregates only investment account balances', async () => {
        const res = await req('GET', `/api/accounts/${householdId}/history/investments`);
        expect(res.status).toBe(200);
        const data = await res.json();

        // Should have 3 dates, only brokerage values
        expect(data.length).toBe(3);

        const jan = data.find((d: { date: string }) => d.date === '2025-01-15');
        expect(jan).toBeTruthy();
        expect(jan.value).toBe(50000);

        const dec = data.find((d: { date: string }) => d.date === '2025-12-15');
        expect(dec).toBeTruthy();
        expect(dec.value).toBe(60000);
      });

      it('supports date range filtering', async () => {
        const res = await req(
          'GET',
          `/api/accounts/${householdId}/history/investments?from=2025-12-01`,
        );
        const data = await res.json();

        expect(data.length).toBe(1);
        expect(data[0].value).toBe(60000);
      });
    });
  });

  // ── Account detail response completeness ──

  describe('GET /:householdId/:accountId (detail)', () => {
    it('includes populated history array', async () => {
      const res = await req('GET', `/api/accounts/${householdId}/${checkingAccountId}`);
      expect(res.status).toBe(200);
      const data = await res.json();

      expect(data.history).toBeDefined();
      expect(Array.isArray(data.history)).toBe(true);
      expect(data.history.length).toBeGreaterThanOrEqual(1);

      // Verify event structure
      const event = data.history[0];
      expect(event).toHaveProperty('id');
      expect(event).toHaveProperty('kind');
      expect(event).toHaveProperty('event_type');
      expect(event).toHaveProperty('created_at');
    });

    it('includes balance_history from the last year', async () => {
      const res = await req('GET', `/api/accounts/${householdId}/${checkingAccountId}`);
      const data = await res.json();

      expect(data.balance_history).toBeDefined();
      expect(Array.isArray(data.balance_history)).toBe(true);
      // We ingested snapshots from 2025, check at least some are returned
      expect(data.balance_history.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ── Account enrichment in list ──

  describe('GET /:householdId (enriched list)', () => {
    it('enriches accounts with balance and source info', async () => {
      const res = await req('GET', `/api/accounts/${householdId}`);
      expect(res.status).toBe(200);
      const data = await res.json();

      // Find the brokerage account
      const brokerage = data.find((a: { id: string }) => a.id === brokerageAccountId);
      expect(brokerage).toBeTruthy();

      // Should have balance from latest balance_snapshot
      expect(brokerage.balance).toBeDefined();
      expect(Number(brokerage.balance)).toBe(60000); // Dec 15 snapshot

      // Should have balance_date
      expect(brokerage.balance_date).toBeDefined();
    });

    it('sets linked=false for manual sources', async () => {
      const res = await req('GET', `/api/accounts/${householdId}`);
      const data = await res.json();

      const checking = data.find((a: { id: string }) => a.id === checkingAccountId);
      expect(checking).toBeTruthy();
      // Manual sources are not considered "linked"
      expect(checking.linked).toBe(false);
    });

    it('includes last_synced from account_source', async () => {
      const res = await req('GET', `/api/accounts/${householdId}`);
      const data = await res.json();

      const brokerage = data.find((a: { id: string }) => a.id === brokerageAccountId);
      expect(brokerage).toBeTruthy();
      // After ingest, last_synced should be set
      expect(brokerage.last_synced).toBeTruthy();
    });
  });
});
