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
  type CreateExpenseCategoryInput,
  type UpdateExpenseCategoryInput,
} from '../types/index.js';
import type { AuthEnv } from '../middleware/auth.js';
import { computeHouseholdWaterfall } from '../engine/household.js';
import { computeFIMetrics } from '../engine/metrics.js';
import { computeProjection } from '../engine/projections.js';
import { computeSavingsRates } from '../engine/savings.js';
import {
  fetchPlanningData,
  resolveAssumptions,
  assembleWaterfallInput,
  assembleFIMetricsInput,
  assembleProjectionInput,
  assembleSavingsRateInput,
  computeCurrentAge,
} from '../services/planning-engine.js';

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
  'source_account_id',
  'destination_account_id',
  'category',
  'is_essential',
]);

planningRoute.get('/flows', async (c) => {
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

planningRoute.post('/flows', async (c) => {
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
      source_account_id: body.source_account_id || null,
      destination_account_id: body.destination_account_id || null,
      category: body.category || null,
      is_essential: body.is_essential ?? true,
    })
    .select()
    .single();

  if (error) return c.json({ error: error.message }, 500);
  return c.json(data, 201);
});

planningRoute.patch('/flows/:flowId', async (c) => {
  const householdId = c.get('householdId');
  const flowId = c.req.param('flowId');
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
    .eq('id', flowId)
    .eq('household_id', householdId)
    .select()
    .single();

  if (error) {
    return c.json({ error: error.message }, error.code === 'PGRST116' ? 404 : 500);
  }

  return c.json(data);
});

planningRoute.delete('/flows/:flowId', async (c) => {
  const householdId = c.get('householdId');
  const flowId = c.req.param('flowId');
  const db = c.get('userClient');

  const { error, count } = await db
    .from('cashflow_item')
    .delete({ count: 'exact' })
    .eq('id', flowId)
    .eq('household_id', householdId);

  if (error) return c.json({ error: error.message }, 500);
  if (count === 0) return c.json({ error: 'Item not found' }, 404);
  return c.json({ success: true });
});

// ── Expense Categories ──

planningRoute.get('/expense-categories', async (c) => {
  const householdId = c.get('householdId');
  const db = c.get('userClient');

  const { data, error } = await db
    .from('expense_category')
    .select('*')
    .eq('household_id', householdId)
    .order('name', { ascending: true });

  if (error) return c.json({ error: error.message }, 500);
  return c.json(data);
});

planningRoute.post('/expense-categories', async (c) => {
  const householdId = c.get('householdId');
  const db = c.get('userClient');
  const body = await c.req.json<CreateExpenseCategoryInput>();

  if (!body.name?.trim()) return c.json({ error: 'name is required' }, 400);

  const { data, error } = await db
    .from('expense_category')
    .insert({
      household_id: householdId,
      name: body.name.trim(),
      is_essential: body.is_essential ?? true,
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') return c.json({ error: 'Category name already exists' }, 409);
    return c.json({ error: error.message }, 500);
  }
  return c.json(data, 201);
});

planningRoute.patch('/expense-categories/:categoryId', async (c) => {
  const householdId = c.get('householdId');
  const categoryId = c.req.param('categoryId');
  const db = c.get('userClient');
  const body = await c.req.json<UpdateExpenseCategoryInput>();

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.name !== undefined) update.name = body.name.trim();
  if (body.is_essential !== undefined) update.is_essential = body.is_essential;

  if (Object.keys(update).length === 1) {
    return c.json({ error: 'No valid fields to update' }, 400);
  }

  // Get old category name for bulk-updating items
  const { data: oldCat } = await db
    .from('expense_category')
    .select('name')
    .eq('id', categoryId)
    .eq('household_id', householdId)
    .single();

  if (!oldCat) return c.json({ error: 'Category not found' }, 404);

  const { data, error } = await db
    .from('expense_category')
    .update(update)
    .eq('id', categoryId)
    .eq('household_id', householdId)
    .select()
    .single();

  if (error) {
    if (error.code === '23505') return c.json({ error: 'Category name already exists' }, 409);
    return c.json({ error: error.message }, error.code === 'PGRST116' ? 404 : 500);
  }

  // Bulk-update matching cashflow items when is_essential or name changes
  const itemUpdate: Record<string, unknown> = {};
  if (body.is_essential !== undefined) itemUpdate.is_essential = body.is_essential;
  if (body.name !== undefined && body.name.trim() !== oldCat.name) {
    itemUpdate.category = body.name.trim();
  }

  if (Object.keys(itemUpdate).length > 0) {
    await db
      .from('cashflow_item')
      .update(itemUpdate)
      .eq('household_id', householdId)
      .eq('category', oldCat.name);
  }

  return c.json(data);
});

planningRoute.delete('/expense-categories/:categoryId', async (c) => {
  const householdId = c.get('householdId');
  const categoryId = c.req.param('categoryId');
  const db = c.get('userClient');

  // Get the category name to null out references on items
  const { data: cat } = await db
    .from('expense_category')
    .select('name')
    .eq('id', categoryId)
    .eq('household_id', householdId)
    .single();

  if (!cat) return c.json({ error: 'Category not found' }, 404);

  // Null out category on matching items
  await db
    .from('cashflow_item')
    .update({ category: null })
    .eq('household_id', householdId)
    .eq('category', cat.name);

  const { error } = await db
    .from('expense_category')
    .delete()
    .eq('id', categoryId)
    .eq('household_id', householdId);

  if (error) return c.json({ error: error.message }, 500);
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

// ── Computation Endpoints ──

planningRoute.get('/cashflow-summary', async (c) => {
  const householdId = c.get('householdId');
  const db = c.get('userClient');
  const scenarioId = c.req.query('scenario_id');

  try {
    const data = await fetchPlanningData(db, householdId, scenarioId);
    const waterfallInput = assembleWaterfallInput(data);
    const waterfall = computeHouseholdWaterfall(waterfallInput);
    const assumptions = resolveAssumptions(data.scenario);

    return c.json({
      scenario: { id: data.scenario.id, name: data.scenario.name, assumptions },
      waterfall,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return c.json({ error: message }, 500);
  }
});

planningRoute.get('/projections', async (c) => {
  const householdId = c.get('householdId');
  const db = c.get('userClient');
  const scenarioId = c.req.query('scenario_id');

  try {
    const data = await fetchPlanningData(db, householdId, scenarioId);
    const waterfallInput = assembleWaterfallInput(data);
    const waterfall = computeHouseholdWaterfall(waterfallInput);
    const assumptions = resolveAssumptions(data.scenario);
    const projectionInput = assembleProjectionInput(waterfall, data, assumptions);

    const primaryMember = data.members[0];
    const currentAge = primaryMember ? computeCurrentAge(primaryMember.birthday) : undefined;

    const projection = computeProjection(
      projectionInput,
      currentAge != null ? Math.floor(currentAge) : undefined,
    );

    return c.json({
      scenario: { id: data.scenario.id, name: data.scenario.name, assumptions },
      fi_portfolio_value: data.fi_portfolio_value,
      projection,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return c.json({ error: message }, 500);
  }
});

planningRoute.get('/metrics', async (c) => {
  const householdId = c.get('householdId');
  const db = c.get('userClient');
  const scenarioId = c.req.query('scenario_id');

  try {
    const data = await fetchPlanningData(db, householdId, scenarioId);
    const waterfallInput = assembleWaterfallInput(data);
    const waterfall = computeHouseholdWaterfall(waterfallInput);
    const assumptions = resolveAssumptions(data.scenario);

    const metricsInput = assembleFIMetricsInput(waterfall, data, assumptions);
    if (!metricsInput) {
      return c.json(
        { error: 'Cannot compute FI metrics: primary member birthday is required' },
        400,
      );
    }

    const metrics = computeFIMetrics(metricsInput);
    const savingsInput = assembleSavingsRateInput(waterfall, data);
    const savings_rates = computeSavingsRates(savingsInput);

    return c.json({
      scenario: { id: data.scenario.id, name: data.scenario.name, assumptions },
      fi_portfolio_value: data.fi_portfolio_value,
      inputs: metricsInput,
      metrics,
      savings_rates,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return c.json({ error: message }, 500);
  }
});
