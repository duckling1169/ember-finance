import { Hono } from 'hono';
import type { Provider } from '../types/index.js';
import type { AuthEnv } from '../middleware/auth.js';

export const sourcesRoute = new Hono<AuthEnv>();

// List sources for an account
sourcesRoute.get('/:householdId/:accountId', async (c) => {
  const { householdId, accountId } = c.req.param();
  const db = c.get('userClient');

  const { data, error } = await db
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
  const db = c.get('userClient');
  const body = await c.req.json<{
    provider: Provider;
    provider_account_id?: string;
  }>();

  const { data, error } = await db
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

  // Log source event
  const isApiProvider = ['teller', 'snaptrade'].includes(body.provider);
  await db.from('account_event').insert({
    household_id: householdId,
    account_id: accountId,
    event_type: isApiProvider ? 'link_connected' : 'source_added',
    triggered_by: c.get('memberId') || null,
    detail: { provider: body.provider, source_id: data.id },
  });

  return c.json(data, 201);
});
