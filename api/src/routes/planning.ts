import { Hono } from 'hono';
import {
  AMOUNT_TYPES,
  CASHFLOW_BUCKETS,
  CASHFLOW_FREQUENCIES,
  INCOME_SOURCE_TYPES,
  ASSUMPTION_KEY_SET,
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
  type CreateAssumptionRecordInput,
  type AssumptionDefault,
  type AssumptionRecord,
  type AssumptionHistoryEntry,
} from '../types/index';
import type { AuthEnv } from '../middleware/auth';
import { computeHouseholdWaterfall } from '../engine/household';
import { computeFIMetrics } from '../engine/metrics';
import { computeProjection } from '../engine/projections';
import { computeSavingsRates } from '../engine/savings';
import {
  fetchPlanningData,
  resolvePlanningAssumptions,
  assembleWaterfallInput,
  assembleFIMetricsInput,
  assembleProjectionInput,
  assembleSavingsRateInput,
  computeCurrentAge,
} from '../services/planning-engine';
import { validateAssumptionValue } from '../lib/assumption-validation';
import { resolveAssumptionValues } from '../engine/assumptions';
import type { SupabaseClient } from '@supabase/supabase-js';

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

  // Clear orphaned references on cashflow items
  await db
    .from('cashflow_item')
    .update({ income_source_id: null, updated_at: new Date().toISOString() })
    .eq('household_id', householdId)
    .eq('income_source_id', sourceId);

  return c.json({ success: true });
});

// ── Cashflow Items ──

const VALID_DIRECTIONS: CashflowDirection[] = ['inflow', 'outflow'];

const CASHFLOW_UPDATABLE_FIELDS = new Set([
  'name',
  'direction',
  'bucket',
  'amount',
  'amount_type',
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
  const amountType = body.amount_type ?? 'fixed';
  if (!AMOUNT_TYPES.includes(amountType as never)) {
    return c.json({ error: `Invalid amount_type: ${amountType}` }, 400);
  }
  if (amountType === 'percent') {
    if (!body.income_source_id) {
      return c.json({ error: 'income_source_id is required when amount_type is percent' }, 400);
    }
    if (body.amount > 100) {
      return c.json({ error: 'percent amount must be between 0 and 100' }, 400);
    }
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
      amount: body.amount,
      amount_type: amountType,
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
  if (update.amount_type !== undefined && !AMOUNT_TYPES.includes(update.amount_type as never)) {
    return c.json({ error: `Invalid amount_type: ${update.amount_type}` }, 400);
  }
  if (update.amount_type === 'percent') {
    if (update.amount !== undefined && (update.amount as number) > 100) {
      return c.json({ error: 'percent amount must be between 0 and 100' }, 400);
    }
  }

  // If switching to percent or clearing income_source_id on a percent item, validate
  if (update.amount_type === 'percent' && update.income_source_id === null) {
    return c.json({ error: 'percent-type items require an income source' }, 400);
  }
  if (update.income_source_id === null && update.amount_type === undefined) {
    // Check if existing item is percent type
    const { data: existing } = await db
      .from('cashflow_item')
      .select('amount_type')
      .eq('id', flowId)
      .eq('household_id', householdId)
      .single();
    if (existing?.amount_type === 'percent') {
      return c.json({ error: 'percent-type items require an income source' }, 400);
    }
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

  // Get existing category name for bulk-updating items
  const { data: existingCategory } = await db
    .from('expense_category')
    .select('name')
    .eq('id', categoryId)
    .eq('household_id', householdId)
    .single();

  if (!existingCategory) return c.json({ error: 'Category not found' }, 404);

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
  if (body.name !== undefined && body.name.trim() !== existingCategory.name) {
    itemUpdate.category = body.name.trim();
  }

  if (Object.keys(itemUpdate).length > 0) {
    await db
      .from('cashflow_item')
      .update(itemUpdate)
      .eq('household_id', householdId)
      .eq('category', existingCategory.name);
  }

  return c.json(data);
});

planningRoute.delete('/expense-categories/:categoryId', async (c) => {
  const householdId = c.get('householdId');
  const categoryId = c.req.param('categoryId');
  const db = c.get('userClient');

  // Get the category name to null out references on items
  const { data: category } = await db
    .from('expense_category')
    .select('name')
    .eq('id', categoryId)
    .eq('household_id', householdId)
    .single();

  if (!category) return c.json({ error: 'Category not found' }, 404);

  // Null out category on matching items
  await db
    .from('cashflow_item')
    .update({ category: null })
    .eq('household_id', householdId)
    .eq('category', category.name);

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

// ── Assumptions ──

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Normalize a scenario reference for assumption operations.
 *
 * Base-scenario edits are stored as household-baseline records
 * (scenario_id null) so every scenario inherits them; only non-base
 * scenarios get scenario-scoped overrides. Reads resolve against the
 * base scenario when none is given, matching the computation endpoints.
 */
async function resolveScenarioRef(
  db: SupabaseClient,
  householdId: string,
  scenarioId: string | null | undefined,
): Promise<{ readScenarioId: string | null; writeScenarioId: string | null } | { error: string }> {
  if (!scenarioId) {
    const { data } = await db
      .from('planning_scenario')
      .select('id')
      .eq('household_id', householdId)
      .eq('is_base', true)
      .maybeSingle();
    return { readScenarioId: data?.id ?? null, writeScenarioId: null };
  }

  const { data, error } = await db
    .from('planning_scenario')
    .select('id, is_base')
    .eq('id', scenarioId)
    .eq('household_id', householdId)
    .maybeSingle();

  if (error || !data) return { error: 'Scenario not found' };
  return {
    readScenarioId: data.id,
    writeScenarioId: data.is_base ? null : data.id,
  };
}

planningRoute.get('/assumptions', async (c) => {
  const householdId = c.get('householdId');
  const db = c.get('userClient');
  const scenarioParam = c.req.query('scenario_id');

  const ref = await resolveScenarioRef(db, householdId, scenarioParam);
  if ('error' in ref) return c.json({ error: ref.error }, 404);

  const asOf = new Date().toISOString().slice(0, 10);

  const [defaultsRes, recordsRes] = await Promise.all([
    db.from('assumption_default').select('*'),
    db.from('assumption_record').select('*').eq('household_id', householdId),
  ]);

  if (defaultsRes.error) return c.json({ error: defaultsRes.error.message }, 500);
  if (recordsRes.error) return c.json({ error: recordsRes.error.message }, 500);

  const resolved = resolveAssumptionValues(
    (defaultsRes.data ?? []) as AssumptionDefault[],
    (recordsRes.data ?? []) as AssumptionRecord[],
    ref.readScenarioId,
    asOf,
  );

  return c.json({
    scenario_id: ref.readScenarioId,
    as_of: asOf,
    assumptions: Array.from(resolved.values()).sort((a, b) => a.key.localeCompare(b.key)),
  });
});

planningRoute.get('/assumptions/:key/history', async (c) => {
  const householdId = c.get('householdId');
  const db = c.get('userClient');
  const key = c.req.param('key');
  const scenarioParam = c.req.query('scenario_id');

  if (!ASSUMPTION_KEY_SET.has(key)) {
    return c.json({ error: `Unknown assumption key: ${key}` }, 400);
  }

  const ref = await resolveScenarioRef(db, householdId, scenarioParam);
  if ('error' in ref) return c.json({ error: ref.error }, 404);

  const [defaultsRes, recordsRes] = await Promise.all([
    db.from('assumption_default').select('*').eq('key', key),
    db.from('assumption_record').select('*').eq('household_id', householdId).eq('key', key),
  ]);

  if (defaultsRes.error) return c.json({ error: defaultsRes.error.message }, 500);
  if (recordsRes.error) return c.json({ error: recordsRes.error.message }, 500);

  const records = ((recordsRes.data ?? []) as AssumptionRecord[]).filter(
    (r) => r.scenario_id === null || r.scenario_id === ref.readScenarioId,
  );

  const history: AssumptionHistoryEntry[] = [
    ...records.map((r) => ({
      id: r.id,
      value: r.value,
      effective_date: r.effective_date,
      source: (r.scenario_id ? 'scenario' : 'household') as 'scenario' | 'household',
      scenario_id: r.scenario_id,
      note: r.note,
      created_at: r.created_at,
    })),
    ...((defaultsRes.data ?? []) as AssumptionDefault[]).map((d) => ({
      id: null,
      value: d.value,
      effective_date: d.effective_date,
      source: 'default' as const,
      scenario_id: null,
      note: d.source,
      created_at: d.created_at,
    })),
  ].sort(
    (a, b) =>
      b.effective_date.localeCompare(a.effective_date) || b.created_at.localeCompare(a.created_at),
  );

  return c.json({ key, history });
});

planningRoute.post('/assumptions', async (c) => {
  const householdId = c.get('householdId');
  const memberId = c.get('memberId');
  const db = c.get('userClient');
  const body = await c.req.json<CreateAssumptionRecordInput>();

  if (!body.key || !ASSUMPTION_KEY_SET.has(body.key)) {
    return c.json({ error: `Unknown assumption key: ${body.key}` }, 400);
  }
  if (body.value === undefined) {
    return c.json({ error: 'value is required' }, 400);
  }
  const valueError = validateAssumptionValue(body.key, body.value);
  if (valueError) return c.json({ error: valueError }, 400);

  const effectiveDate = body.effective_date ?? new Date().toISOString().slice(0, 10);
  if (!ISO_DATE.test(effectiveDate) || Number.isNaN(Date.parse(effectiveDate))) {
    return c.json({ error: 'effective_date must be a valid YYYY-MM-DD date' }, 400);
  }

  const ref = await resolveScenarioRef(db, householdId, body.scenario_id);
  if ('error' in ref) return c.json({ error: ref.error }, 404);

  const { data, error } = await db
    .from('assumption_record')
    .insert({
      household_id: householdId,
      scenario_id: ref.writeScenarioId,
      key: body.key,
      value: body.value,
      effective_date: effectiveDate,
      note: body.note ?? null,
      created_by: memberId,
    })
    .select()
    .single();

  if (error) return c.json({ error: error.message }, 500);
  return c.json(data, 201);
});

planningRoute.delete('/assumptions/records/:recordId', async (c) => {
  const householdId = c.get('householdId');
  const recordId = c.req.param('recordId');
  const db = c.get('userClient');

  const { error, count } = await db
    .from('assumption_record')
    .delete({ count: 'exact' })
    .eq('id', recordId)
    .eq('household_id', householdId);

  if (error) return c.json({ error: error.message }, 500);
  if (count === 0) return c.json({ error: 'Assumption record not found' }, 404);
  return c.json({ success: true });
});

// ── Computation Endpoints ──

planningRoute.get('/cashflow-summary', async (c) => {
  const householdId = c.get('householdId');
  const db = c.get('userClient');
  const scenarioId = c.req.query('scenario_id');

  try {
    const planningData = await fetchPlanningData(db, householdId, scenarioId);
    const { assumptions, tax_params, detail } = resolvePlanningAssumptions(planningData);
    const waterfallInput = assembleWaterfallInput(planningData, tax_params);
    const waterfall = computeHouseholdWaterfall(waterfallInput);

    return c.json({
      scenario: { id: planningData.scenario.id, name: planningData.scenario.name, assumptions },
      assumptions_detail: detail,
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
    const planningData = await fetchPlanningData(db, householdId, scenarioId);
    const { assumptions, tax_params, detail } = resolvePlanningAssumptions(planningData);
    const waterfallInput = assembleWaterfallInput(planningData, tax_params);
    const waterfall = computeHouseholdWaterfall(waterfallInput);
    const projectionInput = assembleProjectionInput(waterfall, planningData, assumptions);

    const primaryMember = planningData.members[0];
    const currentAge = primaryMember ? computeCurrentAge(primaryMember.birthday) : undefined;

    const projection = computeProjection(projectionInput, currentAge ?? undefined);

    return c.json({
      scenario: { id: planningData.scenario.id, name: planningData.scenario.name, assumptions },
      assumptions_detail: detail,
      fi_portfolio_value: planningData.fi_portfolio_value,
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
    const planningData = await fetchPlanningData(db, householdId, scenarioId);
    const { assumptions, tax_params, detail } = resolvePlanningAssumptions(planningData);
    const waterfallInput = assembleWaterfallInput(planningData, tax_params);
    const waterfall = computeHouseholdWaterfall(waterfallInput);

    const metricsInput = assembleFIMetricsInput(waterfall, planningData, assumptions);
    if (!metricsInput) {
      return c.json(
        { error: 'Cannot compute FI metrics: primary member birthday is required' },
        400,
      );
    }

    const metrics = computeFIMetrics(metricsInput);
    const savingsInput = assembleSavingsRateInput(waterfall, planningData);
    const savings_rates = computeSavingsRates(savingsInput);

    return c.json({
      scenario: { id: planningData.scenario.id, name: planningData.scenario.name, assumptions },
      assumptions_detail: detail,
      fi_portfolio_value: planningData.fi_portfolio_value,
      inputs: metricsInput,
      metrics,
      savings_rates,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return c.json({ error: message }, 500);
  }
});
