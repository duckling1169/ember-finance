import { Hono } from 'hono';
import { supabase } from '../lib/supabase.js';
import { ACCOUNT_TYPES, LIABILITY_TYPES, type AccountType } from '../types/index.js';
import type { AuthEnv } from '../middleware/auth.js';

export const accountsRoute = new Hono<AuthEnv>();

// List accounts for a household
accountsRoute.get('/:householdId', async (c) => {
  const householdId = c.req.param('householdId');

  const { data, error } = await supabase
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

  const { data, error } = await supabase
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
  return c.json(data, 201);
});

// Update account
accountsRoute.patch('/:householdId/:accountId', async (c) => {
  const { householdId, accountId } = c.req.param();
  const body = await c.req.json();

  // Don't allow changing household_id
  delete body.household_id;
  delete body.id;

  const { data, error } = await supabase
    .from('account')
    .update(body)
    .eq('id', accountId)
    .eq('household_id', householdId)
    .select()
    .single();

  if (error) return c.json({ error: error.message }, 500);
  return c.json(data);
});
