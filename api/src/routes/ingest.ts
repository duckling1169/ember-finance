import { Hono } from 'hono';
import { supabase } from '../lib/supabase.js';
import { processIngest } from '../services/ingest.js';
import { ManualAdapter } from '../adapters/manual.js';
import type { Account, AccountSource } from '../types/index.js';

export const ingestRoute = new Hono();

// Manual entry — submit normalized data directly
ingestRoute.post('/manual/:householdId/:accountId', async (c) => {
  const { householdId, accountId } = c.req.param();
  const body = await c.req.json();

  // Verify account exists first
  const { data: account, error: accError } = await supabase
    .from('account')
    .select('*')
    .eq('id', accountId)
    .eq('household_id', householdId)
    .single();

  if (accError || !account) return c.json({ error: 'Account not found' }, 404);

  // Get or create a manual source for this account
  let { data: source } = await supabase
    .from('account_source')
    .select('*')
    .eq('account_id', accountId)
    .eq('household_id', householdId)
    .eq('provider', 'manual')
    .single();

  if (!source) {
    const { data: newSource, error } = await supabase
      .from('account_source')
      .insert({
        account_id: accountId,
        household_id: householdId,
        provider: 'manual',
      })
      .select()
      .single();

    if (error) return c.json({ error: error.message }, 500);
    source = newSource;
  }

  try {
    const adapter = new ManualAdapter(body);
    const result = await adapter.sync(account as Account, source as AccountSource);

    const ingestResult = await processIngest(
      {
        householdId,
        accountId,
        sourceId: source.id,
        sourceType: 'manual_entry',
      },
      result,
    );

    return c.json(ingestResult, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ error: message }, 500);
  }
});

// Sync a specific source (for provider adapters — Phase 3)
ingestRoute.post('/sync/:householdId/:sourceId', async (c) => {
  return c.json({ error: 'Provider sync not yet implemented' }, 501);
});
