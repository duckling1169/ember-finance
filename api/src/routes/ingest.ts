import { Hono } from 'hono';
import { supabase } from '../lib/supabase.js';
import { processIngest } from '../services/ingest.js';
import { ManualAdapter } from '../adapters/manual.js';
import { CsvAdapter, detectCsvFormat } from '../adapters/csv.js';
import type { Account, AccountSource } from '../types/index.js';
import type { AuthEnv } from '../middleware/auth.js';

export const ingestRoute = new Hono<AuthEnv>();

const MAX_CSV_SIZE = 10 * 1024 * 1024; // 10 MB

// Helper: get or create a source for a given provider, scoped to account
async function getOrCreateSource(householdId: string, accountId: string, provider: string) {
  const { data: existing, error: lookupErr } = await supabase
    .from('account_source')
    .select('*')
    .eq('account_id', accountId)
    .eq('household_id', householdId)
    .eq('provider', provider)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (lookupErr) throw new Error(`Source lookup failed: ${lookupErr.message}`);
  if (existing) return existing;

  const { data: newSource, error: createErr } = await supabase
    .from('account_source')
    .insert({ account_id: accountId, household_id: householdId, provider })
    .select()
    .single();

  if (createErr) throw new Error(`Source creation failed: ${createErr.message}`);
  return newSource;
}

// Manual entry — submit normalized data directly
ingestRoute.post('/manual/:householdId/:accountId', async (c) => {
  const { householdId, accountId } = c.req.param();
  const body = await c.req.json();

  // Verify account exists (service-role — ingest is a privileged operation)
  const { data: account, error: accError } = await supabase
    .from('account')
    .select('*')
    .eq('id', accountId)
    .eq('household_id', householdId)
    .single();

  if (accError || !account) return c.json({ error: 'Account not found' }, 404);

  try {
    const source = await getOrCreateSource(householdId, accountId, 'manual');
    const adapter = new ManualAdapter(body);
    const result = await adapter.sync(account as Account, source as AccountSource);

    const ingestResult = await processIngest(
      {
        householdId,
        accountId,
        sourceId: source.id,
        sourceType: 'manual_entry',
        triggeredBy: c.get('memberId'),
      },
      result,
    );

    return c.json(ingestResult, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ error: message }, 500);
  }
});

// CSV upload — parse file and ingest
ingestRoute.post('/csv/:householdId/:accountId', async (c) => {
  const { householdId, accountId } = c.req.param();

  const formData = await c.req.formData();
  const file = formData.get('file') as File | null;
  let format = formData.get('format') as string | null;

  if (!file) return c.json({ error: 'No file provided' }, 400);

  if (file.size > MAX_CSV_SIZE) {
    return c.json(
      { error: `File too large. Maximum size is ${MAX_CSV_SIZE / 1024 / 1024} MB.` },
      400,
    );
  }

  // Verify account exists
  const { data: account, error: accError } = await supabase
    .from('account')
    .select('*')
    .eq('id', accountId)
    .eq('household_id', householdId)
    .single();

  if (accError || !account) return c.json({ error: 'Account not found' }, 404);

  try {
    const source = await getOrCreateSource(householdId, accountId, 'csv');
    const buffer = Buffer.from(await file.arrayBuffer());

    // Auto-detect format if not provided
    if (!format) {
      const detected = detectCsvFormat(buffer.toString('utf-8'), account.account_type);
      if (!detected) {
        return c.json({ error: 'Could not auto-detect CSV format. Please specify a format.' }, 400);
      }
      format = detected;
    }

    const adapter = new CsvAdapter();
    const formatOpts = JSON.stringify({ format, accountType: account.account_type });
    const result = await adapter.parse!(buffer, formatOpts);

    const ingestResult = await processIngest(
      {
        householdId,
        accountId,
        sourceId: source.id,
        sourceType: 'csv_upload',
        sourceRef: file.name,
        triggeredBy: c.get('memberId'),
      },
      result,
    );

    return c.json(ingestResult, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ error: message }, 400);
  }
});

// Sync a specific source (for provider adapters — Phase 3)
ingestRoute.post('/sync/:householdId/:sourceId', async (c) => {
  return c.json({ error: 'Provider sync not yet implemented' }, 501);
});
