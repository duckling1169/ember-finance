import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Hono } from 'hono';
import { planningRoute } from '../../src/routes/planning.js';
import { createTestHousehold, cleanupTestHousehold, stubAuth, stubMember } from '../helpers.js';
import type { AuthEnv } from '../../src/middleware/auth.js';

let householdId: string;
let memberId: string;

// Build a test app with stub auth + member middleware
const app = new Hono<AuthEnv>();
app.use('/api/*', stubAuth());
app.use('/api/planning/*', stubMember());
app.route('/api/planning', planningRoute);

function req(method: string, path: string, body?: unknown) {
  const init: RequestInit = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) init.body = JSON.stringify(body);
  return app.request(path, init);
}

describe('Planning API', () => {
  beforeAll(async () => {
    const ctx = await createTestHousehold();
    householdId = ctx.householdId;
    memberId = ctx.memberId;
  });

  afterAll(async () => {
    await cleanupTestHousehold(householdId);
  });

  // ── Cashflow Items ──

  let itemId: string;
  let oneTimeItemId: string;

  describe('POST /api/planning/items', () => {
    it('creates a recurring salary inflow', async () => {
      const res = await req('POST', '/api/planning/items', {
        member_id: memberId,
        name: 'Base Salary',
        direction: 'inflow',
        bucket: 'salary',
        amount: 8000,
        frequency: 'monthly',
        start_date: '2025-01-01',
      });

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.name).toBe('Base Salary');
      expect(data.direction).toBe('inflow');
      expect(data.bucket).toBe('salary');
      expect(Number(data.amount)).toBe(8000);
      expect(data.is_recurring).toBe(true);
      expect(data.include_in_projection).toBe(true);
      expect(data.member_id).toBe(memberId);
      itemId = data.id;
    });

    it('creates a one-time expense with correct defaults', async () => {
      const res = await req('POST', '/api/planning/items', {
        name: 'Moving Expenses',
        direction: 'outflow',
        bucket: 'expense',
        amount: 5000,
        frequency: 'one_time',
        start_date: '2025-06-15',
      });

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.is_recurring).toBe(false);
      expect(data.include_in_projection).toBe(false);
      expect(data.member_id).toBeNull();
      oneTimeItemId = data.id;
    });

    it('creates an employer match inflow', async () => {
      const res = await req('POST', '/api/planning/items', {
        member_id: memberId,
        name: 'Employer 401k Match',
        direction: 'inflow',
        bucket: 'employer_match',
        tax_treatment: 'pre_tax',
        amount: 500,
        frequency: 'monthly',
        start_date: '2025-01-01',
      });

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.bucket).toBe('employer_match');
      expect(data.tax_treatment).toBe('pre_tax');
    });

    it('rejects invalid direction', async () => {
      const res = await req('POST', '/api/planning/items', {
        name: 'Bad',
        direction: 'sideways',
        bucket: 'salary',
        amount: 100,
        frequency: 'monthly',
        start_date: '2025-01-01',
      });
      expect(res.status).toBe(400);
    });

    it('rejects invalid bucket', async () => {
      const res = await req('POST', '/api/planning/items', {
        name: 'Bad',
        direction: 'inflow',
        bucket: 'fake_bucket',
        amount: 100,
        frequency: 'monthly',
        start_date: '2025-01-01',
      });
      expect(res.status).toBe(400);
    });

    it('rejects zero amount', async () => {
      const res = await req('POST', '/api/planning/items', {
        name: 'Bad',
        direction: 'inflow',
        bucket: 'salary',
        amount: 0,
        frequency: 'monthly',
        start_date: '2025-01-01',
      });
      expect(res.status).toBe(400);
    });

    it('rejects negative amount', async () => {
      const res = await req('POST', '/api/planning/items', {
        name: 'Bad',
        direction: 'outflow',
        bucket: 'expense',
        amount: -100,
        frequency: 'monthly',
        start_date: '2025-01-01',
      });
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/planning/items', () => {
    it('lists all items for household', async () => {
      const res = await req('GET', '/api/planning/items');
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.length).toBe(3);
    });

    it('filters by member_id', async () => {
      const res = await req('GET', `/api/planning/items?member_id=${memberId}`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.length).toBe(2); // salary + employer match
      expect(data.every((d: { member_id: string }) => d.member_id === memberId)).toBe(true);
    });
  });

  describe('PATCH /api/planning/items/:itemId', () => {
    it('updates item fields', async () => {
      const res = await req('PATCH', `/api/planning/items/${itemId}`, {
        amount: 9000,
        name: 'Updated Salary',
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(Number(data.amount)).toBe(9000);
      expect(data.name).toBe('Updated Salary');
    });

    it('rejects update with no valid fields', async () => {
      const res = await req('PATCH', `/api/planning/items/${itemId}`, {
        household_id: 'sneaky',
      });
      expect(res.status).toBe(400);
    });

    it('rejects invalid amount in update', async () => {
      const res = await req('PATCH', `/api/planning/items/${itemId}`, {
        amount: -50,
      });
      expect(res.status).toBe(400);
    });
  });

  describe('DELETE /api/planning/items/:itemId', () => {
    it('deletes the one-time item', async () => {
      const res = await req('DELETE', `/api/planning/items/${oneTimeItemId}`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it('returns 404 for already-deleted item', async () => {
      const res = await req('DELETE', `/api/planning/items/${oneTimeItemId}`);
      expect(res.status).toBe(404);
    });

    it('returns 404 for nonexistent item', async () => {
      const res = await req('DELETE', '/api/planning/items/00000000-0000-0000-0000-000000000000');
      expect(res.status).toBe(404);
    });
  });

  // ── Scenarios ──

  let scenarioId: string;

  describe('POST /api/planning/scenarios', () => {
    it('creates a base scenario', async () => {
      const res = await req('POST', '/api/planning/scenarios', {
        name: 'Current Plan',
        is_base: true,
        assumptions: { inflation_rate: 0.03, return_rate: 0.07 },
      });

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.name).toBe('Current Plan');
      expect(data.is_base).toBe(true);
      expect(data.assumptions.inflation_rate).toBe(0.03);
      scenarioId = data.id;
    });

    it('creates a non-base scenario', async () => {
      const res = await req('POST', '/api/planning/scenarios', {
        name: 'Early Retirement',
      });

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.is_base).toBe(false);
      expect(data.assumptions).toEqual({});
    });

    it('rejects scenario without name', async () => {
      const res = await req('POST', '/api/planning/scenarios', {});
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/planning/scenarios', () => {
    it('lists all scenarios', async () => {
      const res = await req('GET', '/api/planning/scenarios');
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.length).toBe(2);
    });
  });

  describe('PATCH /api/planning/scenarios/:scenarioId', () => {
    it('updates scenario assumptions', async () => {
      const res = await req('PATCH', `/api/planning/scenarios/${scenarioId}`, {
        assumptions: { inflation_rate: 0.025, return_rate: 0.06 },
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.assumptions.inflation_rate).toBe(0.025);
    });

    it('renames scenario', async () => {
      const res = await req('PATCH', `/api/planning/scenarios/${scenarioId}`, {
        name: 'Base Plan (Updated)',
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.name).toBe('Base Plan (Updated)');
    });

    it('rejects update with no valid fields', async () => {
      const res = await req('PATCH', `/api/planning/scenarios/${scenarioId}`, {
        household_id: 'sneaky',
      });
      expect(res.status).toBe(400);
    });
  });
});
