import { Hono } from 'hono';
import type { AuthEnv } from '../middleware/auth.js';

export const historyRoute = new Hono<AuthEnv>();

// ── Unified timeline via account_timeline view ──

historyRoute.get('/:householdId/:accountId', async (c) => {
  const { householdId, accountId } = c.req.param();
  const db = c.get('userClient');
  const limit = parseInt(c.req.query('limit') || '50', 10);
  const offset = parseInt(c.req.query('offset') || '0', 10);

  const { data, error } = await db
    .from('account_timeline')
    .select('id, kind, event_type, detail, triggered_by, created_at')
    .eq('household_id', householdId)
    .eq('account_id', accountId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) return c.json({ error: error.message }, 500);
  return c.json(data);
});

// ── Account events only ──

historyRoute.get('/events/:householdId/:accountId', async (c) => {
  const { householdId, accountId } = c.req.param();
  const db = c.get('userClient');

  const { data, error } = await db
    .from('account_event')
    .select('*')
    .eq('household_id', householdId)
    .eq('account_id', accountId)
    .order('created_at', { ascending: false });

  if (error) return c.json({ error: error.message }, 500);
  return c.json(data);
});

// ── Balance snapshots ──

historyRoute.get('/balances/:householdId/:accountId', async (c) => {
  const { householdId, accountId } = c.req.param();
  const db = c.get('userClient');

  const { data, error } = await db
    .from('balance_snapshot')
    .select('id, date, balance, available, source, created_at')
    .eq('household_id', householdId)
    .eq('account_id', accountId)
    .order('date', { ascending: true });

  if (error) return c.json({ error: error.message }, 500);
  return c.json(data);
});

historyRoute.get('/balances/:householdId/:accountId/latest', async (c) => {
  const { householdId, accountId } = c.req.param();
  const db = c.get('userClient');

  const { data, error } = await db
    .from('balance_snapshot')
    .select('id, date, balance, available, source, created_at')
    .eq('household_id', householdId)
    .eq('account_id', accountId)
    .order('date', { ascending: false })
    .limit(1)
    .single();

  if (error) return c.json({ error: error.message }, 500);
  return c.json(data);
});
