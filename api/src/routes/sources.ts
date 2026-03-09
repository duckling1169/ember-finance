import { Hono } from 'hono';
import { supabase } from '../lib/supabase.js';
import type { Provider } from '../types/index.js';
import type { AuthEnv } from '../middleware/auth.js';

export const sourcesRoute = new Hono<AuthEnv>();

// List sources for an account
sourcesRoute.get('/:householdId/:accountId', async (c) => {
  const { householdId, accountId } = c.req.param();

  const { data, error } = await supabase
    .from('account_source')
    .select('id, account_id, provider, provider_account_id, is_active, last_synced, created_at')
    .eq('household_id', householdId)
    .eq('account_id', accountId)
    .order('created_at', { ascending: true });

  if (error) return c.json({ error: error.message }, 500);
  return c.json(data);
});

// Create a source (manual, csv — provider sources created via linking flow)
sourcesRoute.post('/:householdId/:accountId', async (c) => {
  const { householdId, accountId } = c.req.param();
  const body = await c.req.json<{
    provider: Provider;
    provider_account_id?: string;
  }>();

  const { data, error } = await supabase
    .from('account_source')
    .insert({
      account_id: accountId,
      household_id: householdId,
      provider: body.provider,
      provider_account_id: body.provider_account_id || null,
    })
    .select()
    .single();

  if (error) return c.json({ error: error.message }, 500);
  return c.json(data, 201);
});
