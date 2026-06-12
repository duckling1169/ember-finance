import { createClient } from '@supabase/supabase-js';
import type { Context, Next } from 'hono';

// Service role client for test setup/teardown
export function getTestClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);
}

/**
 * Stub auth middleware for tests. Sets authUser and userClient on context
 * so route handlers can access them without a real JWT.
 */
export function stubAuth(authUserId: string = 'test-user-id') {
  return async (c: Context, next: Next) => {
    c.set('authUser', { id: authUserId, email: 'test@example.com' });
    c.set('userClient', getTestClient());
    await next();
  };
}

/**
 * Stub household member middleware for tests. Since test members have
 * null auth_user_id (can't create real auth.users), this just verifies
 * the household exists and has at least one member. In production,
 * requireHouseholdMember checks auth_user_id matching.
 */
export function stubHouseholdMember() {
  return async (c: Context, next: Next) => {
    const householdId = c.req.param('householdId');

    if (!householdId) {
      return c.json({ error: 'Missing householdId' }, 400);
    }

    const db = getTestClient();
    const { data: member } = await db
      .from('member')
      .select('id')
      .eq('household_id', householdId)
      .limit(1)
      .single();

    if (!member) {
      return c.json({ error: 'Forbidden: not a member of this household' }, 403);
    }

    c.set('householdId', householdId);
    await next();
  };
}

/**
 * Stub requireMember middleware for tests on routes without :householdId.
 * Takes a getter so the test can bind it to its own household/member created
 * in beforeAll (never resolve "any member in the DB" — that races with other
 * test files and can leak writes into real households).
 */
export function stubMember(
  getCtx: () => { householdId: string; memberId: string; memberRole?: string },
) {
  return async (c: Context, next: Next) => {
    const ctx = getCtx();
    c.set('householdId', ctx.householdId);
    c.set('memberId', ctx.memberId);
    c.set('memberRole', ctx.memberRole ?? 'owner');
    await next();
  };
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

// Clean up all test data for a household. Deleting the household row
// cascades through every child table (all FKs are ON DELETE CASCADE).
export async function cleanupTestHousehold(householdId: string) {
  const db = getTestClient();
  const { error } = await db.from('household').delete().eq('id', householdId);
  if (error) throw new Error(`Failed to clean up test household: ${error.message}`);
}
