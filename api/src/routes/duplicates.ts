import { Hono } from 'hono';
import type { AuthEnv } from '../middleware/auth.js';

export const duplicatesRoute = new Hono<AuthEnv>();

// List hidden transactions for an account
duplicatesRoute.get('/transactions/:householdId/:accountId', async (c) => {
  const { householdId, accountId } = c.req.param();
  const db = c.get('userClient');

  const { data, error } = await db
    .from('transaction')
    .select('*')
    .eq('household_id', householdId)
    .eq('account_id', accountId)
    .eq('is_hidden', true)
    .order('date', { ascending: false });

  if (error) return c.json({ error: error.message }, 500);
  return c.json(data);
});

// List hidden investment activity for an account
duplicatesRoute.get('/activity/:householdId/:accountId', async (c) => {
  const { householdId, accountId } = c.req.param();
  const db = c.get('userClient');

  const { data, error } = await db
    .from('investment_activity')
    .select('*')
    .eq('household_id', householdId)
    .eq('account_id', accountId)
    .eq('is_hidden', true)
    .order('date', { ascending: false });

  if (error) return c.json({ error: error.message }, 500);
  return c.json(data);
});

// List potential duplicates (visible records sharing date+amount) for manual review
duplicatesRoute.get('/review/:householdId/:accountId', async (c) => {
  const { householdId, accountId } = c.req.param();
  const db = c.get('userClient');

  const { data, error } = await db
    .from('duplicate_candidates_txn')
    .select('*')
    .eq('household_id', householdId)
    .eq('account_id', accountId)
    .order('date', { ascending: false });

  if (error) return c.json({ error: error.message }, 500);

  // Group the pre-filtered results for the response shape
  const groups = new Map<string, typeof data>();
  for (const txn of data!) {
    const key = `${txn.date}|${txn.amount}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(txn);
  }

  const dupeGroups = Array.from(groups.entries()).map(([key, records]) => ({
    key,
    date: records[0].date,
    amount: records[0].amount,
    records,
  }));

  return c.json(dupeGroups);
});

// Hide a transaction (user marks as duplicate)
duplicatesRoute.post('/hide/transaction/:id', async (c) => {
  const id = c.req.param('id');
  const db = c.get('userClient');
  const body = (await c.req.json().catch(() => ({}))) as { reason?: string };

  const { data, error } = await db
    .from('transaction')
    .update({
      is_hidden: true,
      hidden_reason: body.reason || 'manual',
    })
    .eq('id', id)
    .select()
    .single();

  if (error) return c.json({ error: error.message }, 500);
  return c.json(data);
});

// Unhide a transaction (user overrides auto-detection)
duplicatesRoute.post('/unhide/transaction/:id', async (c) => {
  const id = c.req.param('id');
  const db = c.get('userClient');

  const { data, error } = await db
    .from('transaction')
    .update({ is_hidden: false, hidden_reason: null })
    .eq('id', id)
    .select()
    .single();

  if (error) return c.json({ error: error.message }, 500);
  return c.json(data);
});

// Hide investment activity
duplicatesRoute.post('/hide/activity/:id', async (c) => {
  const id = c.req.param('id');
  const db = c.get('userClient');
  const body = (await c.req.json().catch(() => ({}))) as { reason?: string };

  const { data, error } = await db
    .from('investment_activity')
    .update({
      is_hidden: true,
      hidden_reason: body.reason || 'manual',
    })
    .eq('id', id)
    .select()
    .single();

  if (error) return c.json({ error: error.message }, 500);
  return c.json(data);
});

// Unhide investment activity
duplicatesRoute.post('/unhide/activity/:id', async (c) => {
  const id = c.req.param('id');
  const db = c.get('userClient');

  const { data, error } = await db
    .from('investment_activity')
    .update({ is_hidden: false, hidden_reason: null })
    .eq('id', id)
    .select()
    .single();

  if (error) return c.json({ error: error.message }, 500);
  return c.json(data);
});
