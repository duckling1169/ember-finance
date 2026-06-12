import { Hono } from 'hono';
import type { AuthEnv } from '../middleware/auth';
import { resolveAssumptionValues } from '../engine/assumptions';
import { computeComposition } from '../engine/composition';
import type {
  Account,
  AllocationBucket,
  AllocationTarget,
  AssumptionDefault,
  AssumptionRecord,
  PortfolioCompositionResponse,
} from '../types/index';

export const portfolioRoute = new Hono<AuthEnv>();

// ── Portfolio composition (buckets, drift, asset location) ──

portfolioRoute.get('/:householdId/composition', async (c) => {
  const householdId = c.req.param('householdId');
  const db = c.get('userClient');
  const asOf = new Date().toISOString().slice(0, 10);

  const [positionsRes, balancesRes, accountsRes, defaultsRes, recordsRes] = await Promise.all([
    db.from('current_positions').select('*').eq('household_id', householdId).gt('quantity', 0),
    db.from('latest_account_balances').select('*').eq('household_id', householdId),
    db.from('account').select('*').eq('household_id', householdId).eq('is_active', true),
    db.from('assumption_default').select('*'),
    db.from('assumption_record').select('*').eq('household_id', householdId),
  ]);

  if (positionsRes.error) return c.json({ error: positionsRes.error.message }, 500);
  if (balancesRes.error) return c.json({ error: balancesRes.error.message }, 500);
  if (accountsRes.error) return c.json({ error: accountsRes.error.message }, 500);
  if (defaultsRes.error) return c.json({ error: defaultsRes.error.message }, 500);
  if (recordsRes.error) return c.json({ error: recordsRes.error.message }, 500);

  // Household-baseline resolution (no scenario): allocation targets and
  // symbol overrides describe the actual portfolio, not a hypothetical.
  const resolved = resolveAssumptionValues(
    (defaultsRes.data ?? []) as AssumptionDefault[],
    (recordsRes.data ?? []) as AssumptionRecord[],
    null,
    asOf,
  );

  const targetsEntry = resolved.get('allocation.targets');
  const overridesEntry = resolved.get('allocation.symbol_overrides');

  const targets = Array.isArray(targetsEntry?.value)
    ? (targetsEntry.value as AllocationTarget[])
    : [];
  const overrides =
    overridesEntry?.value && typeof overridesEntry.value === 'object'
      ? (overridesEntry.value as Record<string, AllocationBucket>)
      : {};

  const accounts = (accountsRes.data ?? []) as Account[];
  const activeAccountIds = new Set(accounts.map((a) => a.id));

  const balanceByAccount = new Map<string, number>(
    ((balancesRes.data ?? []) as { account_id: string; balance: number }[]).map((b) => [
      b.account_id,
      Number(b.balance ?? 0),
    ]),
  );

  // Cash sleeve: positive balances of active, non-liability bank accounts
  const cashAccounts = accounts
    .filter(
      (a) => (a.account_type === 'checking' || a.account_type === 'savings') && !a.is_liability,
    )
    .map((a) => ({
      account_id: a.id,
      name: a.name,
      balance: balanceByAccount.get(a.id) ?? 0,
    }))
    .filter((a) => a.balance > 0);

  // Security positions, restricted to active accounts
  const positions = (
    (positionsRes.data ?? []) as {
      symbol: string;
      name: string | null;
      account_id: string;
      live_market_value: number | null;
      asset_class:
        | 'equity'
        | 'fixed_income'
        | 'cash'
        | 'crypto'
        | 'real_estate'
        | 'commodity'
        | 'other'
        | null;
    }[]
  )
    .filter((p) => activeAccountIds.has(p.account_id))
    .map((p) => ({
      symbol: p.symbol,
      name: p.name,
      account_id: p.account_id,
      market_value: Number(p.live_market_value ?? 0),
      asset_class: p.asset_class,
    }));

  const composition = computeComposition({
    positions,
    cashAccounts,
    accounts: accounts.map((a) => ({
      id: a.id,
      name: a.name,
      account_type: a.account_type,
      tax_treatment: a.tax_treatment,
    })),
    overrides,
    targets,
  });

  const response: PortfolioCompositionResponse = {
    ...composition,
    as_of: asOf,
    targets_effective_date: targetsEntry?.effective_date ?? null,
    targets_source: targetsEntry?.source ?? 'default',
  };

  return c.json(response);
});
