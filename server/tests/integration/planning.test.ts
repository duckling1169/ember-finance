import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Hono } from 'hono';
import { planningRoute } from '../../src/routes/planning.js';
import {
  createTestHousehold,
  createTestAccount,
  cleanupTestHousehold,
  stubAuth,
  stubMember,
} from '../helpers.js';
import type { AuthEnv } from '../../src/middleware/auth.js';

let householdId: string;
let memberId: string;
let testAccountId: string;

// Build a test app with stub auth + member middleware
const app = new Hono<AuthEnv>();
app.use('/api/*', stubAuth());
app.use(
  '/api/planning/*',
  stubMember(() => ({ householdId, memberId })),
);
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
    const account = await createTestAccount(householdId, {
      name: 'Test 401k',
      account_type: 'retirement',
    });
    testAccountId = account.id;
  });

  afterAll(async () => {
    await cleanupTestHousehold(householdId);
  });

  // ── Income Sources ──

  let incomeSourceId: string;

  describe('POST /api/planning/income-sources', () => {
    it('creates an employment income source', async () => {
      const res = await req('POST', '/api/planning/income-sources', {
        member_id: memberId,
        name: 'Day Job',
        type: 'employment',
        gross_amount: 125000,
        frequency: 'annual',
      });

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.name).toBe('Day Job');
      expect(data.type).toBe('employment');
      expect(Number(data.gross_amount)).toBe(125000);
      expect(data.frequency).toBe('annual');
      expect(data.is_active).toBe(true);
      expect(data.member_id).toBe(memberId);
      incomeSourceId = data.id;
    });

    it('creates a passive income source', async () => {
      const res = await req('POST', '/api/planning/income-sources', {
        member_id: memberId,
        name: 'Rental Income',
        type: 'passive',
        gross_amount: 2000,
        frequency: 'monthly',
      });

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.type).toBe('passive');
    });

    it('rejects missing member_id', async () => {
      const res = await req('POST', '/api/planning/income-sources', {
        name: 'Bad',
        type: 'employment',
        gross_amount: 1000,
        frequency: 'monthly',
      });
      expect(res.status).toBe(400);
    });

    it('rejects invalid type', async () => {
      const res = await req('POST', '/api/planning/income-sources', {
        member_id: memberId,
        name: 'Bad',
        type: 'magic',
        gross_amount: 1000,
        frequency: 'monthly',
      });
      expect(res.status).toBe(400);
    });

    it('rejects zero gross_amount', async () => {
      const res = await req('POST', '/api/planning/income-sources', {
        member_id: memberId,
        name: 'Bad',
        type: 'employment',
        gross_amount: 0,
        frequency: 'monthly',
      });
      expect(res.status).toBe(400);
    });

    it('rejects invalid frequency', async () => {
      const res = await req('POST', '/api/planning/income-sources', {
        member_id: memberId,
        name: 'Bad',
        type: 'employment',
        gross_amount: 1000,
        frequency: 'weekly',
      });
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/planning/income-sources', () => {
    it('lists all income sources', async () => {
      const res = await req('GET', '/api/planning/income-sources');
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.length).toBe(2);
    });

    it('filters by member_id', async () => {
      const res = await req('GET', `/api/planning/income-sources?member_id=${memberId}`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.length).toBe(2);
      expect(data.every((d: { member_id: string }) => d.member_id === memberId)).toBe(true);
    });
  });

  describe('PATCH /api/planning/income-sources/:sourceId', () => {
    it('updates income source fields', async () => {
      const res = await req('PATCH', `/api/planning/income-sources/${incomeSourceId}`, {
        gross_amount: 135000,
        name: 'Day Job (Raise)',
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(Number(data.gross_amount)).toBe(135000);
      expect(data.name).toBe('Day Job (Raise)');
    });

    it('deactivates income source', async () => {
      const res = await req('PATCH', `/api/planning/income-sources/${incomeSourceId}`, {
        is_active: false,
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.is_active).toBe(false);
    });

    it('rejects update with no valid fields', async () => {
      const res = await req('PATCH', `/api/planning/income-sources/${incomeSourceId}`, {
        household_id: 'sneaky',
      });
      expect(res.status).toBe(400);
    });

    it('rejects invalid gross_amount in update', async () => {
      const res = await req('PATCH', `/api/planning/income-sources/${incomeSourceId}`, {
        gross_amount: -50,
      });
      expect(res.status).toBe(400);
    });
  });

  describe('DELETE /api/planning/income-sources/:sourceId', () => {
    it('returns 404 for nonexistent source', async () => {
      const res = await req(
        'DELETE',
        '/api/planning/income-sources/00000000-0000-0000-0000-000000000000',
      );
      expect(res.status).toBe(404);
    });
  });

  // ── Cashflow Items ──

  let itemId: string;
  let oneTimeItemId: string;

  describe('POST /api/planning/flows', () => {
    it('creates a recurring savings contribution', async () => {
      const res = await req('POST', '/api/planning/flows', {
        member_id: memberId,
        name: 'Brokerage Contribution',
        direction: 'outflow',
        bucket: 'savings',
        amount: 8000,
        frequency: 'monthly',
        start_date: '2025-01-01',
      });

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.name).toBe('Brokerage Contribution');
      expect(data.direction).toBe('outflow');
      expect(data.bucket).toBe('savings');
      expect(Number(data.amount)).toBe(8000);
      expect(data.is_recurring).toBe(true);
      expect(data.include_in_projection).toBe(true);
      expect(data.member_id).toBe(memberId);
      expect(data.income_source_id).toBeNull();
      expect(data.destination_account_id).toBeNull();
      itemId = data.id;
    });

    it('creates a one-time expense with correct defaults', async () => {
      const res = await req('POST', '/api/planning/flows', {
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
      const res = await req('POST', '/api/planning/flows', {
        member_id: memberId,
        name: 'Employer 401k Match',
        direction: 'inflow',
        bucket: 'employer_match',
        amount: 500,
        frequency: 'monthly',
        start_date: '2025-01-01',
      });

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.bucket).toBe('employer_match');
    });

    it('creates a cashflow item with income_source_id and destination_account_id', async () => {
      const res = await req('POST', '/api/planning/flows', {
        member_id: memberId,
        name: '401k Deferral',
        direction: 'outflow',
        bucket: 'savings',
        amount: 1875,
        frequency: 'monthly',
        start_date: '2025-01-01',
        income_source_id: incomeSourceId,
        destination_account_id: testAccountId,
      });

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.income_source_id).toBe(incomeSourceId);
      expect(data.destination_account_id).toBe(testAccountId);
    });

    it('rejects invalid direction', async () => {
      const res = await req('POST', '/api/planning/flows', {
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
      const res = await req('POST', '/api/planning/flows', {
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
      const res = await req('POST', '/api/planning/flows', {
        name: 'Bad',
        direction: 'inflow',
        bucket: 'savings',
        amount: 0,
        frequency: 'monthly',
        start_date: '2025-01-01',
      });
      expect(res.status).toBe(400);
    });

    it('rejects negative amount', async () => {
      const res = await req('POST', '/api/planning/flows', {
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

  describe('GET /api/planning/flows', () => {
    it('lists all items for household', async () => {
      const res = await req('GET', '/api/planning/flows');
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.length).toBe(4);
    });

    it('filters by member_id', async () => {
      const res = await req('GET', `/api/planning/flows?member_id=${memberId}`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.length).toBe(3); // brokerage contribution + employer match + 401k deferral
      expect(data.every((d: { member_id: string }) => d.member_id === memberId)).toBe(true);
    });
  });

  describe('PATCH /api/planning/flows/:itemId', () => {
    it('updates item fields', async () => {
      const res = await req('PATCH', `/api/planning/flows/${itemId}`, {
        amount: 9000,
        name: 'Updated Contribution',
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(Number(data.amount)).toBe(9000);
      expect(data.name).toBe('Updated Contribution');
    });

    it('updates routing fields', async () => {
      const res = await req('PATCH', `/api/planning/flows/${itemId}`, {
        income_source_id: incomeSourceId,
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.income_source_id).toBe(incomeSourceId);
    });

    it('clears routing fields with null', async () => {
      const res = await req('PATCH', `/api/planning/flows/${itemId}`, {
        income_source_id: null,
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.income_source_id).toBeNull();
    });

    it('rejects update with no valid fields', async () => {
      const res = await req('PATCH', `/api/planning/flows/${itemId}`, {
        household_id: 'sneaky',
      });
      expect(res.status).toBe(400);
    });

    it('rejects invalid amount in update', async () => {
      const res = await req('PATCH', `/api/planning/flows/${itemId}`, {
        amount: -50,
      });
      expect(res.status).toBe(400);
    });
  });

  describe('DELETE /api/planning/flows/:itemId', () => {
    it('deletes the one-time item', async () => {
      const res = await req('DELETE', `/api/planning/flows/${oneTimeItemId}`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it('returns 404 for already-deleted item', async () => {
      const res = await req('DELETE', `/api/planning/flows/${oneTimeItemId}`);
      expect(res.status).toBe(404);
    });

    it('returns 404 for nonexistent item', async () => {
      const res = await req('DELETE', '/api/planning/flows/00000000-0000-0000-0000-000000000000');
      expect(res.status).toBe(404);
    });
  });

  // ── Scenarios ──

  let scenarioId: string;
  let altScenarioId: string;

  describe('POST /api/planning/scenarios', () => {
    it('creates a base scenario', async () => {
      const res = await req('POST', '/api/planning/scenarios', {
        name: 'Current Plan',
        is_base: true,
      });

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.name).toBe('Current Plan');
      expect(data.is_base).toBe(true);
      scenarioId = data.id;
    });

    it('creates a non-base scenario', async () => {
      const res = await req('POST', '/api/planning/scenarios', {
        name: 'Early Retirement',
      });

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.is_base).toBe(false);
      altScenarioId = data.id;
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

  // ── Assumptions ──

  describe('Assumptions API', () => {
    it('GET /assumptions returns seeded defaults with provenance', async () => {
      const res = await req('GET', '/api/planning/assumptions');
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.as_of).toMatch(/^\d{4}-\d{2}-\d{2}$/);

      const byKey = Object.fromEntries(
        data.assumptions.map((a: { key: string }) => [a.key, a]),
      ) as Record<string, { value: unknown; source: string; effective_date: string }>;

      expect(byKey['real_return_rate'].value).toBe(0.06);
      expect(byKey['real_return_rate'].source).toBe('default');

      const brackets = byKey['tax.federal_brackets'].value as {
        year: number;
        brackets: Record<string, unknown[]>;
      };
      expect(brackets.year).toBe(2025);
      expect(brackets.brackets.single.length).toBe(7);
      expect(byKey['tax.federal_brackets'].effective_date).toBe('2025-01-01');

      // Rule-shaped params are present as dated defaults too
      expect(byKey['tax.aca']).toBeDefined();
      expect(byKey['tax.irmaa']).toBeDefined();
      expect(byKey['tax.niit']).toBeDefined();
      expect(byKey['tax.amt']).toBeDefined();
      expect(byKey['tax.retirement_limits']).toBeDefined();
      expect(byKey['tax.rmd_ages']).toBeDefined();
    });

    let recordId: string;

    it('POST /assumptions creates a household record (base scenario writes to baseline)', async () => {
      const res = await req('POST', '/api/planning/assumptions', {
        key: 'withdrawal_rate',
        value: 0.035,
        scenario_id: scenarioId, // base scenario → stored household-level
        effective_date: '2026-01-01',
        note: 'more conservative SWR',
      });
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.scenario_id).toBeNull();
      expect(data.value).toBe(0.035);
      expect(data.created_by).toBe(memberId);
      recordId = data.id;
    });

    it('resolved value now comes from the household layer', async () => {
      const res = await req('GET', '/api/planning/assumptions');
      const data = await res.json();
      const wr = data.assumptions.find((a: { key: string }) => a.key === 'withdrawal_rate');
      expect(wr.value).toBe(0.035);
      expect(wr.source).toBe('household');
      expect(wr.record_id).toBe(recordId);
    });

    it('scenario-scoped record overrides only its scenario', async () => {
      const createRes = await req('POST', '/api/planning/assumptions', {
        key: 'withdrawal_rate',
        value: 0.03,
        scenario_id: altScenarioId,
      });
      expect(createRes.status).toBe(201);
      const created = await createRes.json();
      expect(created.scenario_id).toBe(altScenarioId);

      const altRes = await req('GET', `/api/planning/assumptions?scenario_id=${altScenarioId}`);
      const altData = await altRes.json();
      const altWr = altData.assumptions.find((a: { key: string }) => a.key === 'withdrawal_rate');
      expect(altWr.value).toBe(0.03);
      expect(altWr.source).toBe('scenario');

      const baseRes = await req('GET', '/api/planning/assumptions');
      const baseData = await baseRes.json();
      const baseWr = baseData.assumptions.find((a: { key: string }) => a.key === 'withdrawal_rate');
      expect(baseWr.value).toBe(0.035);
    });

    it('GET /assumptions/:key/history lists records and defaults', async () => {
      const res = await req('GET', '/api/planning/assumptions/withdrawal_rate/history');
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.key).toBe('withdrawal_rate');
      const sources = data.history.map((h: { source: string }) => h.source);
      expect(sources).toContain('household');
      expect(sources).toContain('default');
      // newest effective_date first
      expect(data.history[0].effective_date >= data.history[1].effective_date).toBe(true);
    });

    it('rejects unknown keys', async () => {
      const res = await req('POST', '/api/planning/assumptions', {
        key: 'made_up_key',
        value: 1,
      });
      expect(res.status).toBe(400);
    });

    it('rejects percent-style rate values', async () => {
      const res = await req('POST', '/api/planning/assumptions', {
        key: 'real_return_rate',
        value: 6, // must be 0.06
      });
      expect(res.status).toBe(400);
    });

    it('rejects malformed federal bracket tables', async () => {
      const res = await req('POST', '/api/planning/assumptions', {
        key: 'tax.federal_brackets',
        value: { year: 2026, brackets: { single: [{ min: 0, max: null, rate: 0.1 }] } },
      });
      expect(res.status).toBe(400); // missing other filing statuses
    });

    it('rejects invalid effective_date', async () => {
      const res = await req('POST', '/api/planning/assumptions', {
        key: 'inflation_rate',
        value: 0.025,
        effective_date: 'not-a-date',
      });
      expect(res.status).toBe(400);
    });

    it('a tax-table edit changes the engine tax year stamp', async () => {
      // Stamp before: seeded 2025 tables
      const before = await req('GET', '/api/planning/cashflow-summary');
      expect(before.status).toBe(200);
      const beforeData = await before.json();
      expect(beforeData.waterfall.members[0].tax_breakdown.tax_year).toBe(2025);
      expect(beforeData.assumptions_detail.length).toBeGreaterThan(0);

      // Edit: 2026 flat-tax table (data edit, no code change)
      const flat = (rate: number) => [{ min: 0, max: null, rate }];
      const editRes = await req('POST', '/api/planning/assumptions', {
        key: 'tax.federal_brackets',
        value: {
          year: 2026,
          brackets: {
            single: flat(0.2),
            married_jointly: flat(0.2),
            married_separately: flat(0.2),
            head_of_household: flat(0.2),
          },
        },
      });
      expect(editRes.status).toBe(201);
      const edited = await editRes.json();

      const after = await req('GET', '/api/planning/cashflow-summary');
      const afterData = await after.json();
      expect(afterData.waterfall.members[0].tax_breakdown.tax_year).toBe(2026);

      // Clean up so later assertions see seeded tables again
      const delRes = await req('DELETE', `/api/planning/assumptions/records/${edited.id}`);
      expect(delRes.status).toBe(200);
    });

    it('DELETE /assumptions/records/:id reverts resolution to the default layer', async () => {
      const res = await req('DELETE', `/api/planning/assumptions/records/${recordId}`);
      expect(res.status).toBe(200);

      const after = await req('GET', '/api/planning/assumptions');
      const data = await after.json();
      const wr = data.assumptions.find((a: { key: string }) => a.key === 'withdrawal_rate');
      expect(wr.value).toBe(0.04);
      expect(wr.source).toBe('default');
    });

    it('DELETE returns 404 for unknown record', async () => {
      const res = await req(
        'DELETE',
        '/api/planning/assumptions/records/00000000-0000-0000-0000-000000000000',
      );
      expect(res.status).toBe(404);
    });
  });
});
