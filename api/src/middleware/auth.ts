import type { Context, Next } from 'hono';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createUserClient } from '../lib/supabase.js';

export interface AuthUser {
  id: string;
  email: string;
}

export type AuthEnv = {
  Variables: {
    authUser: AuthUser;
    userClient: SupabaseClient;
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
