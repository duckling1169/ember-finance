import { Hono } from 'hono';
import type { AuthEnv } from '../middleware/auth.js';

export const activityRoute = new Hono<AuthEnv>();

// ── Transactions for a household (cross-account, visible only) ──
// Supports ?accountId=...&from=YYYY-MM-DD&to=YYYY-MM-DD&limit=100&offset=0

activityRoute.get('/transactions/:householdId', async (c) => {
  const householdId = c.req.param('householdId');
  const db = c.get('userClient');
  const accountId = c.req.query('accountId');
  const from = c.req.query('from');
  const to = c.req.query('to');
  const limit = parseInt(c.req.query('limit') || '100', 10);
  const offset = parseInt(c.req.query('offset') || '0', 10);

  let query = db
    .from('transaction')
    .select('*')
    .eq('household_id', householdId)
    .eq('is_hidden', false);

  if (accountId) query = query.eq('account_id', accountId);
  if (from) query = query.gte('date', from);
  if (to) query = query.lte('date', to);

  const { data, error } = await query
    .order('date', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) return c.json({ error: error.message }, 500);
  return c.json(data);
});

// ── Investment activity for a household (cross-account, visible only) ──
// Supports ?accountId=...&from=YYYY-MM-DD&to=YYYY-MM-DD&symbol=...&activityType=...&limit=100&offset=0

activityRoute.get('/investments/:householdId', async (c) => {
  const householdId = c.req.param('householdId');
  const db = c.get('userClient');
  const accountId = c.req.query('accountId');
  const from = c.req.query('from');
  const to = c.req.query('to');
  const symbol = c.req.query('symbol');
  const activityType = c.req.query('activityType');
  const limit = parseInt(c.req.query('limit') || '100', 10);
  const offset = parseInt(c.req.query('offset') || '0', 10);

  let query = db
    .from('investment_activity')
    .select('*')
    .eq('household_id', householdId)
    .eq('is_hidden', false);

  if (accountId) query = query.eq('account_id', accountId);
  if (from) query = query.gte('date', from);
  if (to) query = query.lte('date', to);
  if (symbol) query = query.eq('symbol', symbol);
  if (activityType) query = query.eq('activity_type', activityType);

  const { data, error } = await query
    .order('date', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) return c.json({ error: error.message }, 500);
  return c.json(data);
});
