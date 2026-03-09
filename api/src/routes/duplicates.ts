import { Hono } from 'hono';
import { supabase } from '../lib/supabase.js';

export const duplicatesRoute = new Hono();

// List hidden transactions for an account
duplicatesRoute.get('/transactions/:householdId/:accountId', async (c) => {
  const { householdId, accountId } = c.req.param();

  const { data, error } = await supabase
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

  const { data, error } = await supabase
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

  // Find visible transactions where (date, amount) appears more than once
  const { data: txns, error } = await supabase
    .from('transaction')
    .select('*')
    .eq('household_id', householdId)
    .eq('account_id', accountId)
    .eq('is_hidden', false)
    .order('date', { ascending: false });

  if (error) return c.json({ error: error.message }, 500);

  // Group by (date, amount) and return only groups with >1 record
  const groups = new Map<string, typeof txns>();
  for (const txn of txns!) {
    const key = `${txn.date}|${txn.amount}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(txn);
  }

  const dupeGroups = Array.from(groups.entries())
    .filter(([, g]) => g.length > 1)
    .map(([key, records]) => ({
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
  const body = await c.req.json().catch(() => ({})) as { reason?: string };

  const { data, error } = await supabase
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

  const { data, error } = await supabase
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
  const body = await c.req.json().catch(() => ({})) as { reason?: string };

  const { data, error } = await supabase
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

  const { data, error } = await supabase
    .from('investment_activity')
    .update({ is_hidden: false, hidden_reason: null })
    .eq('id', id)
    .select()
    .single();

  if (error) return c.json({ error: error.message }, 500);
  return c.json(data);
});
