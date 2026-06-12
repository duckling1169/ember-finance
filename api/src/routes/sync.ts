import { Hono } from 'hono';
import type { AuthEnv } from '../middleware/auth';

export const syncRoute = new Hono<AuthEnv>();

// ── Delta sync for mobile clients ──
// Returns all records changed since a given timestamp, scoped to household.
// GET /api/sync?since=<ISO-8601-timestamp>

syncRoute.get('/', async (c) => {
  const since = c.req.query('since');

  if (!since) {
    return c.json({ error: 'Missing required query parameter: since' }, 400);
  }

  // Validate ISO-8601 timestamp
  const sinceDate = new Date(since);
  if (isNaN(sinceDate.getTime())) {
    return c.json({ error: 'Invalid timestamp format. Use ISO-8601.' }, 400);
  }

  const db = c.get('userClient');
  const householdId = c.get('householdId');
  const sinceISO = sinceDate.toISOString();

  // Capture server time before queries for consistent next-sync cursor
  const syncedAt = new Date().toISOString();

  // Query all tables in parallel. Tables with updated_at use that column;
  // tables with only created_at use created_at instead.
  const [
    accountsRes,
    transactionsRes,
    investmentActivityRes,
    holdingsRes,
    balanceSnapshotsRes,
    incomeSourcesRes,
    cashflowItemsRes,
    planningScenariosRes,
  ] = await Promise.all([
    // account — only created_at
    db.from('account').select('*').eq('household_id', householdId).gt('created_at', sinceISO),

    // transaction — only created_at
    db
      .from('transaction')
      .select('*')
      .eq('household_id', householdId)
      .gt('created_at', sinceISO)
      .order('created_at', { ascending: true })
      .limit(1000),

    // investment_activity — only created_at
    db
      .from('investment_activity')
      .select('*')
      .eq('household_id', householdId)
      .gt('created_at', sinceISO)
      .order('created_at', { ascending: true })
      .limit(1000),

    // holding — only created_at
    db.from('holding').select('*').eq('household_id', householdId).gt('created_at', sinceISO),

    // balance_snapshot — only created_at
    db
      .from('balance_snapshot')
      .select('*')
      .eq('household_id', householdId)
      .gt('created_at', sinceISO),

    // income_source — has updated_at
    db.from('income_source').select('*').eq('household_id', householdId).gt('updated_at', sinceISO),

    // cashflow_item — has updated_at
    db.from('cashflow_item').select('*').eq('household_id', householdId).gt('updated_at', sinceISO),

    // planning_scenario — has updated_at
    db
      .from('planning_scenario')
      .select('*')
      .eq('household_id', householdId)
      .gt('updated_at', sinceISO),
  ]);

  // Check for any query errors
  const errors: string[] = [];
  if (accountsRes.error) errors.push(`accounts: ${accountsRes.error.message}`);
  if (transactionsRes.error) errors.push(`transactions: ${transactionsRes.error.message}`);
  if (investmentActivityRes.error)
    errors.push(`investment_activity: ${investmentActivityRes.error.message}`);
  if (holdingsRes.error) errors.push(`holdings: ${holdingsRes.error.message}`);
  if (balanceSnapshotsRes.error)
    errors.push(`balance_snapshots: ${balanceSnapshotsRes.error.message}`);
  if (incomeSourcesRes.error) errors.push(`income_sources: ${incomeSourcesRes.error.message}`);
  if (cashflowItemsRes.error) errors.push(`cashflow_items: ${cashflowItemsRes.error.message}`);
  if (planningScenariosRes.error)
    errors.push(`planning_scenarios: ${planningScenariosRes.error.message}`);

  if (errors.length > 0) {
    return c.json({ error: 'Sync query failed', details: errors }, 500);
  }

  return c.json({
    synced_at: syncedAt,
    changes: {
      accounts: accountsRes.data ?? [],
      transactions: transactionsRes.data ?? [],
      investment_activity: investmentActivityRes.data ?? [],
      holdings: holdingsRes.data ?? [],
      balance_snapshots: balanceSnapshotsRes.data ?? [],
      income_sources: incomeSourcesRes.data ?? [],
      cashflow_items: cashflowItemsRes.data ?? [],
      planning_scenarios: planningScenariosRes.data ?? [],
    },
  });
});
