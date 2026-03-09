import type { Context, Next } from 'hono';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createUserClient, supabase } from '../lib/supabase.js';

export interface AuthUser {
  id: string;
  email: string;
}

export type AuthEnv = {
  Variables: {
    authUser: AuthUser;
    userClient: SupabaseClient;
    householdId: string;
  };
};

/**
 * Extracts the Supabase user from the Authorization header.
 * Sets `authUser` and `userClient` on the context.
 */
export async function requireAuth(c: Context, next: Next) {
  const header = c.req.header('Authorization');
  if (!header?.startsWith('Bearer ')) {
    return c.json({ error: 'Missing or invalid Authorization header' }, 401);
  }

  const token = header.slice(7);
  const client = createUserClient(token);
  const { data, error } = await client.auth.getUser(token);

  if (error || !data.user) {
    return c.json({ error: 'Invalid or expired token' }, 401);
  }

  c.set('authUser', { id: data.user.id, email: data.user.email! } as AuthUser);
  c.set('userClient', client);
  await next();
}

/**
 * Verifies the authenticated user is a member of the household specified
 * in the `:householdId` route param. Sets `householdId` on context.
 * Must run after `requireAuth`.
 */
export async function requireHouseholdMember(c: Context, next: Next) {
  const authUser = c.get('authUser') as AuthUser;
  const householdId = c.req.param('householdId');

  if (!householdId) {
    return c.json({ error: 'Missing householdId' }, 400);
  }

  const { data: member, error } = await supabase
    .from('member')
    .select('id')
    .eq('household_id', householdId)
    .eq('auth_user_id', authUser.id)
    .single();

  if (error || !member) {
    return c.json({ error: 'Forbidden: not a member of this household' }, 403);
  }

  c.set('householdId', householdId);
  await next();
}

/**
 * For routes with only a record `:id` param (no householdId),
 * looks up the record's household_id and verifies membership.
 */
export function requireRecordOwnership(table: 'transaction' | 'investment_activity') {
  return async (c: Context, next: Next) => {
    const authUser = c.get('authUser') as AuthUser;
    const id = c.req.param('id');

    const { data: record, error } = await supabase
      .from(table)
      .select('household_id')
      .eq('id', id)
      .single();

    if (error || !record) {
      return c.json({ error: 'Record not found' }, 404);
    }

    const { data: member } = await supabase
      .from('member')
      .select('id')
      .eq('household_id', record.household_id)
      .eq('auth_user_id', authUser.id)
      .single();

    if (!member) {
      return c.json({ error: 'Forbidden: not a member of this household' }, 403);
    }

    c.set('householdId', record.household_id);
    await next();
  };
}
