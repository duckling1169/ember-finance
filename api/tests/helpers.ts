import { createClient } from '@supabase/supabase-js';

// Service role client for test setup/teardown
export function getTestClient() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

// Create a test household + member, return IDs for use in tests
export async function createTestHousehold() {
  const db = getTestClient();

  const { data: household, error: hErr } = await db
    .from('household')
    .insert({ name: `Test Household ${Date.now()}` })
    .select()
    .single();

  if (hErr) throw new Error(`Failed to create test household: ${hErr.message}`);

  const { data: member, error: mErr } = await db
    .from('member')
    .insert({
      household_id: household.id,
      display_name: 'Test User',
      role: 'owner',
    })
    .select()
    .single();

  if (mErr) throw new Error(`Failed to create test member: ${mErr.message}`);

  return { householdId: household.id, memberId: member.id, db };
}

// Create a test account under a household
export async function createTestAccount(
  householdId: string,
  overrides: Record<string, unknown> = {},
) {
  const db = getTestClient();

  const defaults = {
    household_id: householdId,
    name: 'Test Checking',
    account_type: 'checking',
    currency: 'USD',
    is_liability: false,
  };

  const { data, error } = await db
    .from('account')
    .insert({ ...defaults, ...overrides })
    .select()
    .single();

  if (error) throw new Error(`Failed to create test account: ${error.message}`);
  return data;
}

// Create a test account_source
export async function createTestSource(
  accountId: string,
  householdId: string,
  provider: string = 'manual',
) {
  const db = getTestClient();

  const { data, error } = await db
    .from('account_source')
    .insert({
      account_id: accountId,
      household_id: householdId,
      provider,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create test source: ${error.message}`);
  return data;
}

// Clean up all test data for a household (cascading)
export async function cleanupTestHousehold(householdId: string) {
  const db = getTestClient();

  // Delete in reverse dependency order
  await db.from('net_worth_snapshot').delete().eq('household_id', householdId);
  await db.from('balance_snapshot').delete().eq('household_id', householdId);
  await db.from('holding').delete().eq('household_id', householdId);
  await db.from('investment_activity').delete().eq('household_id', householdId);
  await db.from('transaction').delete().eq('household_id', householdId);
  await db.from('raw_ingest').delete().eq('household_id', householdId);
  await db.from('account_source').delete().eq('household_id', householdId);
  await db.from('account').delete().eq('household_id', householdId);
  await db.from('member').delete().eq('household_id', householdId);
  await db.from('household').delete().eq('id', householdId);
}
