import { Hono } from 'hono';
import {
  ACCOUNT_TYPES,
  INVESTMENT_ACCOUNT_TYPES,
  LIABILITY_TYPES,
  type AccountType,
} from '../types/index.js';
import type { AuthEnv } from '../middleware/auth.js';

export const accountsRoute = new Hono<AuthEnv>();

const UPDATABLE_FIELDS = new Set([
  'name',
  'institution',
  'account_type',
  'member_id',
  'currency',
  'meta',
  'is_active',
  'include_in_fi_portfolio',
]);

// ── List accounts (enriched with latest balance + source status) ──

accountsRoute.get('/:householdId', async (c) => {
  const householdId = c.req.param('householdId');
  const db = c.get('userClient');

  // Fetch accounts, latest balances (via view), and sources in parallel
  const [accountsRes, balancesRes, sourcesRes] = await Promise.all([
    db
      .from('account')
      .select('*')
      .eq('household_id', householdId)
      .eq('is_active', true)
      .order('created_at', { ascending: true }),
    db
      .from('latest_account_balances')
      .select('account_id, balance, date')
      .eq('household_id', householdId),
    db
      .from('account_source')
      .select('account_id, provider, is_active, last_synced')
      .eq('household_id', householdId),
  ]);

  if (accountsRes.error) return c.json({ error: accountsRes.error.message }, 500);

  const accounts = accountsRes.data || [];

  // Build lookup maps
  const balanceMap = new Map<string, { balance: number; date: string }>();
  if (balancesRes.data) {
    for (const b of balancesRes.data as { account_id: string; balance: number; date: string }[]) {
      balanceMap.set(b.account_id, { balance: b.balance, date: b.date });
    }
  }

  const sourceMap = new Map<string, { linked: boolean; last_synced: string | null }>();
  if (sourcesRes.data) {
    for (const s of sourcesRes.data as {
      account_id: string;
      provider: string;
      is_active: boolean;
      last_synced: string | null;
    }[]) {
      const existing = sourceMap.get(s.account_id);
      const isLinked = s.is_active && ['teller', 'snaptrade'].includes(s.provider);
      const lastSynced = s.last_synced;
      sourceMap.set(s.account_id, {
        linked: existing?.linked || isLinked,
        last_synced: !existing?.last_synced
          ? lastSynced
          : lastSynced && lastSynced > existing.last_synced
            ? lastSynced
            : existing.last_synced,
      });
    }
  }

  // Enrich accounts
  const enriched = accounts.map((a: Record<string, unknown>) => {
    const bal = balanceMap.get(a.id as string);
    const src = sourceMap.get(a.id as string);
    const meta = (a.meta || {}) as Record<string, unknown>;
    return {
      ...a,
      balance: bal?.balance ?? 0,
      balance_date: bal?.date ?? null,
      linked: src?.linked ?? false,
      last_synced: src?.last_synced ?? null,
      tax_bucket: meta.tax_bucket ?? 'after_tax',
    };
  });

  return c.json(enriched);
});

// ── Household net worth history (aggregate balance snapshots across all accounts) ──
// Supports ?from=YYYY-MM-DD&to=YYYY-MM-DD for date range filtering.

accountsRoute.get('/:householdId/history/net-worth', async (c) => {
  const householdId = c.req.param('householdId');
  const db = c.get('userClient');
  const from = c.req.query('from');
  const to = c.req.query('to');

  // Fetch active accounts and their balance snapshots in parallel
  const [accountsRes, snapshotsQuery] = await Promise.all([
    db
      .from('account')
      .select('id, is_liability')
      .eq('household_id', householdId)
      .eq('is_active', true),
    (() => {
      let q = db
        .from('balance_snapshot')
        .select('account_id, date, balance')
        .eq('household_id', householdId)
        .order('date', { ascending: true });
      if (from) q = q.gte('date', from);
      if (to) q = q.lte('date', to);
      return q;
    })(),
  ]);

  if (accountsRes.error) return c.json({ error: accountsRes.error.message }, 500);
  if (snapshotsQuery.error) return c.json({ error: snapshotsQuery.error.message }, 500);

  const activeIds = new Set((accountsRes.data || []).map((a) => a.id as string));
  const liabilityIds = new Set(
    (accountsRes.data || []).filter((a) => a.is_liability).map((a) => a.id as string),
  );

  // Aggregate by date: sum balances, subtract liabilities
  const byDate = new Map<string, number>();
  for (const s of snapshotsQuery.data || []) {
    if (!activeIds.has(s.account_id)) continue;
    const sign = liabilityIds.has(s.account_id) ? -1 : 1;
    byDate.set(s.date, (byDate.get(s.date) || 0) + sign * Number(s.balance));
  }

  const result = [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, value]) => ({ date, value: Math.round(value * 100) / 100 }));

  return c.json(result);
});

// ── Household investment history (aggregate balance snapshots for investment accounts) ──
// Supports ?from=YYYY-MM-DD&to=YYYY-MM-DD for date range filtering.

accountsRoute.get('/:householdId/history/investments', async (c) => {
  const householdId = c.req.param('householdId');
  const db = c.get('userClient');
  const from = c.req.query('from');
  const to = c.req.query('to');

  // Fetch investment accounts and their balance snapshots in parallel
  const [accountsRes, snapshotsQuery] = await Promise.all([
    db
      .from('account')
      .select('id')
      .eq('household_id', householdId)
      .eq('is_active', true)
      .in('account_type', INVESTMENT_ACCOUNT_TYPES),
    (() => {
      let q = db
        .from('balance_snapshot')
        .select('account_id, date, balance')
        .eq('household_id', householdId)
        .order('date', { ascending: true });
      if (from) q = q.gte('date', from);
      if (to) q = q.lte('date', to);
      return q;
    })(),
  ]);

  if (accountsRes.error) return c.json({ error: accountsRes.error.message }, 500);
  if (snapshotsQuery.error) return c.json({ error: snapshotsQuery.error.message }, 500);

  const investmentIds = new Set((accountsRes.data || []).map((a) => a.id as string));

  // Aggregate by date: sum balances for investment accounts only
  const byDate = new Map<string, number>();
  for (const s of snapshotsQuery.data || []) {
    if (!investmentIds.has(s.account_id)) continue;
    byDate.set(s.date, (byDate.get(s.date) || 0) + Number(s.balance));
  }

  const result = [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, value]) => ({ date, value: Math.round(value * 100) / 100 }));

  return c.json(result);
});

// ── Account detail (full picture: account + balance + holdings + lots + recent history) ──

accountsRoute.get('/:householdId/:accountId', async (c) => {
  const { householdId, accountId } = c.req.param();
  const db = c.get('userClient');

  // Fetch everything in parallel
  // Balance history defaults to last 1 year; use /balances sub-route for custom ranges
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  const balanceFrom = oneYearAgo.toISOString().slice(0, 10);

  const [accountRes, balanceRes, balanceHistoryRes, holdingsRes, lotsRes, sourcesRes, historyRes] =
    await Promise.all([
      db.from('account').select('*').eq('id', accountId).eq('household_id', householdId).single(),
      db
        .from('latest_account_balances')
        .select('balance, available, date, source')
        .eq('household_id', householdId)
        .eq('account_id', accountId)
        .maybeSingle(),
      db
        .from('balance_snapshot')
        .select('date, balance, source')
        .eq('household_id', householdId)
        .eq('account_id', accountId)
        .gte('date', balanceFrom)
        .order('date', { ascending: true }),
      db
        .from('current_positions')
        .select('*')
        .eq('household_id', householdId)
        .eq('account_id', accountId),
      db
        .from('open_tax_lots')
        .select('*')
        .eq('household_id', householdId)
        .eq('account_id', accountId),
      db
        .from('account_source')
        .select('id, provider, provider_account_id, is_active, last_synced, created_at')
        .eq('household_id', householdId)
        .eq('account_id', accountId)
        .order('created_at', { ascending: true }),
      db
        .from('account_timeline')
        .select('id, kind, event_type, detail, triggered_by, created_at')
        .eq('household_id', householdId)
        .eq('account_id', accountId)
        .order('created_at', { ascending: false })
        .limit(50),
    ]);

  if (accountRes.error) {
    return c.json(
      { error: accountRes.error.message },
      accountRes.error.code === 'PGRST116' ? 404 : 500,
    );
  }

  return c.json({
    account: accountRes.data,
    balance: balanceRes.data ?? null,
    balance_history: balanceHistoryRes.data ?? [],
    holdings: holdingsRes.data ?? [],
    lots: lotsRes.data ?? [],
    sources: sourcesRes.data ?? [],
    history: historyRes.data ?? [],
  });
});

// ── Holdings for a single account ──

accountsRoute.get('/:householdId/:accountId/holdings', async (c) => {
  const { householdId, accountId } = c.req.param();
  const db = c.get('userClient');

  const { data, error } = await db
    .from('current_positions')
    .select('*')
    .eq('household_id', householdId)
    .eq('account_id', accountId);

  if (error) return c.json({ error: error.message }, 500);
  return c.json(data);
});

// ── Tax lots for a single account ──

accountsRoute.get('/:householdId/:accountId/lots', async (c) => {
  const { householdId, accountId } = c.req.param();
  const db = c.get('userClient');

  const { data, error } = await db
    .from('open_tax_lots')
    .select('*')
    .eq('household_id', householdId)
    .eq('account_id', accountId);

  if (error) return c.json({ error: error.message }, 500);
  return c.json(data);
});

// ── Balance history for a single account ──
// Supports ?from=YYYY-MM-DD&to=YYYY-MM-DD for date range filtering.

accountsRoute.get('/:householdId/:accountId/balances', async (c) => {
  const { householdId, accountId } = c.req.param();
  const db = c.get('userClient');
  const from = c.req.query('from');
  const to = c.req.query('to');

  let query = db
    .from('balance_snapshot')
    .select('id, date, balance, available, source, created_at')
    .eq('household_id', householdId)
    .eq('account_id', accountId);

  if (from) query = query.gte('date', from);
  if (to) query = query.lte('date', to);

  const { data, error } = await query.order('date', { ascending: true });

  if (error) return c.json({ error: error.message }, 500);
  return c.json(data);
});

// ── History/timeline for a single account ──
// Supports ?limit=50&offset=0&from=YYYY-MM-DD&to=YYYY-MM-DD

accountsRoute.get('/:householdId/:accountId/history', async (c) => {
  const { householdId, accountId } = c.req.param();
  const db = c.get('userClient');
  const limit = parseInt(c.req.query('limit') || '50', 10);
  const offset = parseInt(c.req.query('offset') || '0', 10);
  const from = c.req.query('from');
  const to = c.req.query('to');

  let query = db
    .from('account_timeline')
    .select('id, kind, event_type, detail, triggered_by, created_at')
    .eq('household_id', householdId)
    .eq('account_id', accountId);

  if (from) query = query.gte('created_at', `${from}T00:00:00Z`);
  if (to) query = query.lte('created_at', `${to}T23:59:59Z`);

  const { data, error } = await query
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) return c.json({ error: error.message }, 500);
  return c.json(data);
});

// ── Create account ──

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
      include_in_fi_portfolio: INVESTMENT_ACCOUNT_TYPES.includes(body.account_type),
    })
    .select()
    .single();

  if (error) return c.json({ error: error.message }, 500);

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

// ── Update account ──

accountsRoute.patch('/:householdId/:accountId', async (c) => {
  const { householdId, accountId } = c.req.param();
  const db = c.get('userClient');
  const body = await c.req.json();

  const update: Record<string, unknown> = {};
  for (const key of Object.keys(body)) {
    if (UPDATABLE_FIELDS.has(key)) {
      update[key] = body[key];
    }
  }

  if (Object.keys(update).length === 0) {
    return c.json({ error: 'No valid fields to update' }, 400);
  }

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

  await db.from('account_event').insert({
    household_id: householdId,
    account_id: accountId,
    event_type: 'account_updated',
    triggered_by: c.get('memberId') || null,
    detail: { fields_changed: Object.keys(update) },
  });

  return c.json(data);
});

// ── Soft-delete account ──

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
