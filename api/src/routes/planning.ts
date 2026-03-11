import { Hono } from 'hono';
import {
  CASHFLOW_BUCKETS,
  CASHFLOW_FREQUENCIES,
  INCOME_SOURCE_TYPES,
  type CashflowBucket,
  type CashflowFrequency,
  type CashflowDirection,
  type IncomeSourceType,
  type CreateCashflowItemInput,
  type UpdateCashflowItemInput,
  type CreateIncomeSourceInput,
  type UpdateIncomeSourceInput,
  type CreatePlanningScenarioInput,
  type UpdatePlanningScenarioInput,
} from '../types/index.js';
import type { AuthEnv } from '../middleware/auth.js';

export const planningRoute = new Hono<AuthEnv>();

// ── Income Sources ──

const INCOME_SOURCE_UPDATABLE_FIELDS = new Set([
  'name',
  'type',
  'gross_amount',
  'frequency',
  'is_active',
]);

planningRoute.get('/income-sources', async (c) => {
  const householdId = c.get('householdId');
  const db = c.get('userClient');
  const memberFilter = c.req.query('member_id');

  let query = db
    .from('income_source')
    .select('*')
    .eq('household_id', householdId)
    .order('created_at', { ascending: true });

  if (memberFilter) {
    query = query.eq('member_id', memberFilter);
  }

  const { data, error } = await query;

  if (error) return c.json({ error: error.message }, 500);
  return c.json(data);
});

planningRoute.post('/income-sources', async (c) => {
  const householdId = c.get('householdId');
  const db = c.get('userClient');
  const body = await c.req.json<CreateIncomeSourceInput>();

  if (!body.name) return c.json({ error: 'name is required' }, 400);
  if (!body.member_id) return c.json({ error: 'member_id is required' }, 400);
  if (!body.type || !INCOME_SOURCE_TYPES.includes(body.type as IncomeSourceType)) {
    return c.json({ error: `Invalid type: ${body.type}` }, 400);
  }
  if (!body.frequency || !CASHFLOW_FREQUENCIES.includes(body.frequency as CashflowFrequency)) {
    return c.json({ error: `Invalid frequency: ${body.frequency}` }, 400);
  }
  if (body.gross_amount === undefined || body.gross_amount <= 0) {
    return c.json({ error: 'gross_amount must be positive' }, 400);
  }

  const { data, error } = await db
    .from('income_source')
    .insert({
      household_id: householdId,
      member_id: body.member_id,
      name: body.name,
      type: body.type,
      gross_amount: body.gross_amount,
      frequency: body.frequency,
      is_active: body.is_active ?? true,
    })
    .select()
    .single();

  if (error) return c.json({ error: error.message }, 500);
  return c.json(data, 201);
});

planningRoute.patch('/income-sources/:sourceId', async (c) => {
  const householdId = c.get('householdId');
  const sourceId = c.req.param('sourceId');
  const db = c.get('userClient');
  const body = await c.req.json<UpdateIncomeSourceInput>();

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const key of Object.keys(body)) {
    if (INCOME_SOURCE_UPDATABLE_FIELDS.has(key)) {
      update[key] = (body as Record<string, unknown>)[key];
    }
  }

  if (Object.keys(update).length === 1) {
    return c.json({ error: 'No valid fields to update' }, 400);
  }

  if (update.type && !INCOME_SOURCE_TYPES.includes(update.type as IncomeSourceType)) {
    return c.json({ error: `Invalid type: ${update.type}` }, 400);
  }
  if (update.frequency && !CASHFLOW_FREQUENCIES.includes(update.frequency as CashflowFrequency)) {
    return c.json({ error: `Invalid frequency: ${update.frequency}` }, 400);
  }
  if (update.gross_amount !== undefined && (update.gross_amount as number) <= 0) {
    return c.json({ error: 'gross_amount must be positive' }, 400);
  }

  const { data, error } = await db
    .from('income_source')
    .update(update)
    .eq('id', sourceId)
    .eq('household_id', householdId)
    .select()
    .single();

  if (error) {
    return c.json({ error: error.message }, error.code === 'PGRST116' ? 404 : 500);
  }

  return c.json(data);
});

planningRoute.delete('/income-sources/:sourceId', async (c) => {
  const householdId = c.get('householdId');
  const sourceId = c.req.param('sourceId');
  const db = c.get('userClient');

  const { error, count } = await db
    .from('income_source')
    .delete({ count: 'exact' })
    .eq('id', sourceId)
    .eq('household_id', householdId);

  if (error) return c.json({ error: error.message }, 500);
  if (count === 0) return c.json({ error: 'Income source not found' }, 404);
  return c.json({ success: true });
});

// ── Cashflow Items ──

const VALID_DIRECTIONS: CashflowDirection[] = ['inflow', 'outflow'];

const CASHFLOW_UPDATABLE_FIELDS = new Set([
  'name',
  'direction',
  'bucket',
  'tax_treatment',
  'amount',
  'frequency',
  'is_recurring',
  'include_in_projection',
  'start_date',
  'end_date',
  'income_source_id',
  'destination_account_id',
]);

planningRoute.get('/items', async (c) => {
  const householdId = c.get('householdId');
  const db = c.get('userClient');
  const memberFilter = c.req.query('member_id');

  let query = db
    .from('cashflow_item')
    .select('*')
    .eq('household_id', householdId)
    .order('created_at', { ascending: true });

  if (memberFilter) {
    query = query.eq('member_id', memberFilter);
  }

  const { data, error } = await query;

  if (error) return c.json({ error: error.message }, 500);
  return c.json(data);
});

planningRoute.post('/items', async (c) => {
  const householdId = c.get('householdId');
  const db = c.get('userClient');
  const body = await c.req.json<CreateCashflowItemInput>();

  // Validate required fields
  if (!body.name) return c.json({ error: 'name is required' }, 400);
  if (!body.direction || !VALID_DIRECTIONS.includes(body.direction)) {
    return c.json({ error: `Invalid direction: ${body.direction}` }, 400);
  }
  if (!body.bucket || !CASHFLOW_BUCKETS.includes(body.bucket as CashflowBucket)) {
    return c.json({ error: `Invalid bucket: ${body.bucket}` }, 400);
  }
  if (!body.frequency || !CASHFLOW_FREQUENCIES.includes(body.frequency as CashflowFrequency)) {
    return c.json({ error: `Invalid frequency: ${body.frequency}` }, 400);
  }
  if (body.amount === undefined || body.amount <= 0) {
    return c.json({ error: 'amount must be positive' }, 400);
  }
  if (!body.start_date) return c.json({ error: 'start_date is required' }, 400);

  // Default: one-time items have include_in_projection=false
  const isRecurring = body.is_recurring ?? body.frequency !== 'one_time';
  const includeInProjection = body.include_in_projection ?? isRecurring;

  const { data, error } = await db
    .from('cashflow_item')
    .insert({
      household_id: householdId,
      member_id: body.member_id || null,
      name: body.name,
      direction: body.direction,
      bucket: body.bucket,
      tax_treatment: body.tax_treatment || 'taxable',
      amount: body.amount,
      frequency: body.frequency,
      is_recurring: isRecurring,
      include_in_projection: includeInProjection,
      start_date: body.start_date,
      end_date: body.end_date || null,
      income_source_id: body.income_source_id || null,
      destination_account_id: body.destination_account_id || null,
    })
    .select()
    .single();

  if (error) return c.json({ error: error.message }, 500);
  return c.json(data, 201);
});

planningRoute.patch('/items/:itemId', async (c) => {
  const householdId = c.get('householdId');
  const itemId = c.req.param('itemId');
  const db = c.get('userClient');
  const body = await c.req.json<UpdateCashflowItemInput>();

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const key of Object.keys(body)) {
    if (CASHFLOW_UPDATABLE_FIELDS.has(key)) {
      update[key] = (body as Record<string, unknown>)[key];
    }
  }

  if (Object.keys(update).length === 1) {
    return c.json({ error: 'No valid fields to update' }, 400);
  }

  // Validate fields if provided
  if (update.direction && !VALID_DIRECTIONS.includes(update.direction as CashflowDirection)) {
    return c.json({ error: `Invalid direction: ${update.direction}` }, 400);
  }
  if (update.bucket && !CASHFLOW_BUCKETS.includes(update.bucket as CashflowBucket)) {
    return c.json({ error: `Invalid bucket: ${update.bucket}` }, 400);
  }
  if (update.frequency && !CASHFLOW_FREQUENCIES.includes(update.frequency as CashflowFrequency)) {
    return c.json({ error: `Invalid frequency: ${update.frequency}` }, 400);
  }
  if (update.amount !== undefined && (update.amount as number) <= 0) {
    return c.json({ error: 'amount must be positive' }, 400);
  }

  const { data, error } = await db
    .from('cashflow_item')
    .update(update)
    .eq('id', itemId)
    .eq('household_id', householdId)
    .select()
    .single();

  if (error) {
    return c.json({ error: error.message }, error.code === 'PGRST116' ? 404 : 500);
  }

  return c.json(data);
});

planningRoute.delete('/items/:itemId', async (c) => {
  const householdId = c.get('householdId');
  const itemId = c.req.param('itemId');
  const db = c.get('userClient');

  const { error, count } = await db
    .from('cashflow_item')
    .delete({ count: 'exact' })
    .eq('id', itemId)
    .eq('household_id', householdId);

  if (error) return c.json({ error: error.message }, 500);
  if (count === 0) return c.json({ error: 'Item not found' }, 404);
  return c.json({ success: true });
});

// ── Scenarios ──

planningRoute.get('/scenarios', async (c) => {
  const householdId = c.get('householdId');
  const db = c.get('userClient');

  const { data, error } = await db
    .from('planning_scenario')
    .select('*')
    .eq('household_id', householdId)
    .order('created_at', { ascending: true });

  if (error) return c.json({ error: error.message }, 500);
  return c.json(data);
});

planningRoute.post('/scenarios', async (c) => {
  const householdId = c.get('householdId');
  const db = c.get('userClient');
  const body = await c.req.json<CreatePlanningScenarioInput>();

  if (!body.name) return c.json({ error: 'name is required' }, 400);

  const { data, error } = await db
    .from('planning_scenario')
    .insert({
      household_id: householdId,
      name: body.name,
      is_base: body.is_base ?? false,
      assumptions: body.assumptions ?? {},
    })
    .select()
    .single();

  if (error) return c.json({ error: error.message }, 500);
  return c.json(data, 201);
});

planningRoute.patch('/scenarios/:scenarioId', async (c) => {
  const householdId = c.get('householdId');
  const scenarioId = c.req.param('scenarioId');
  const db = c.get('userClient');
  const body = await c.req.json<UpdatePlanningScenarioInput>();

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.name !== undefined) update.name = body.name;
  if (body.is_base !== undefined) update.is_base = body.is_base;
  if (body.assumptions !== undefined) update.assumptions = body.assumptions;

  if (Object.keys(update).length === 1) {
    return c.json({ error: 'No valid fields to update' }, 400);
  }

  const { data, error } = await db
    .from('planning_scenario')
    .update(update)
    .eq('id', scenarioId)
    .eq('household_id', householdId)
    .select()
    .single();

  if (error) {
    return c.json({ error: error.message }, error.code === 'PGRST116' ? 404 : 500);
  }

  return c.json(data);
});
