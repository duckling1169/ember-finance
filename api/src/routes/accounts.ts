import { Hono } from 'hono';
import { ACCOUNT_TYPES, LIABILITY_TYPES, type AccountType } from '../types/index.js';
import type { AuthEnv } from '../middleware/auth.js';

export const accountsRoute = new Hono<AuthEnv>();

// Allowed fields for account updates
const UPDATABLE_FIELDS = new Set([
  'name',
  'institution',
  'account_type',
  'member_id',
  'currency',
  'meta',
  'is_active',
]);

// List accounts for a household
accountsRoute.get('/:householdId', async (c) => {
  const householdId = c.req.param('householdId');
  const db = c.get('userClient');

  const { data, error } = await db
    .from('account')
    .select('*')
    .eq('household_id', householdId)
    .eq('is_active', true)
    .order('created_at', { ascending: true });

  if (error) return c.json({ error: error.message }, 500);
  return c.json(data);
});

// Create account
accountsRoute.post('/:householdId', async (c) => {
  const householdId = c.req.param('householdId');
  const db = c.get('userClient');
  const body = await c.req.json<{
    name: string;
    institution?: string;
    account_type: AccountType;
    member_id?: string;
    currency?: string;
    meta?: Record<string, unknown>;
  }>();

  if (!ACCOUNT_TYPES.includes(body.account_type)) {
    return c.json({ error: `Invalid account_type: ${body.account_type}` }, 400);
  }

  const { data, error } = await db
    .from('account')
    .insert({
      household_id: householdId,
      name: body.name,
      institution: body.institution || null,
      account_type: body.account_type,
      member_id: body.member_id || null,
      currency: body.currency || 'USD',
      meta: body.meta || {},
      is_liability: LIABILITY_TYPES.includes(body.account_type),
    })
    .select()
    .single();

  if (error) return c.json({ error: error.message }, 500);

  // Log account_created event
  await db.from('account_event').insert({
    household_id: householdId,
    account_id: data.id,
    event_type: 'account_created',
    triggered_by: c.get('memberId') || null,
    detail: {
      name: data.name,
      institution: data.institution,
      account_type: data.account_type,
    },
  });

  return c.json(data, 201);
});

// Update account
accountsRoute.patch('/:householdId/:accountId', async (c) => {
  const { householdId, accountId } = c.req.param();
  const db = c.get('userClient');
  const body = await c.req.json();

  // Whitelist allowed fields
  const update: Record<string, unknown> = {};
  for (const key of Object.keys(body)) {
    if (UPDATABLE_FIELDS.has(key)) {
      update[key] = body[key];
    }
  }

  if (Object.keys(update).length === 0) {
    return c.json({ error: 'No valid fields to update' }, 400);
  }

  // Recompute is_liability if account_type changed
  if (update.account_type) {
    update.is_liability = LIABILITY_TYPES.includes(update.account_type as AccountType);
  }

  const { data, error } = await db
    .from('account')
    .update(update)
    .eq('id', accountId)
    .eq('household_id', householdId)
    .select()
    .single();

  if (error) return c.json({ error: error.message }, 500);

  // Log account_updated event
  await db.from('account_event').insert({
    household_id: householdId,
    account_id: accountId,
    event_type: 'account_updated',
    triggered_by: c.get('memberId') || null,
    detail: { fields_changed: Object.keys(update) },
  });

  return c.json(data);
});

// Soft-delete account
accountsRoute.delete('/:householdId/:accountId', async (c) => {
  const { householdId, accountId } = c.req.param();
  const db = c.get('userClient');

  const { data, error } = await db
    .from('account')
    .update({ is_active: false })
    .eq('id', accountId)
    .eq('household_id', householdId)
    .select()
    .single();

  if (error) return c.json({ error: error.message }, 500);

  await db.from('account_event').insert({
    household_id: householdId,
    account_id: accountId,
    event_type: 'account_deactivated',
    triggered_by: c.get('memberId') || null,
    detail: { name: data.name },
  });

  return c.json({ success: true });
});
