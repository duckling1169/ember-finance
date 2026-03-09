import { createClient } from '@supabase/supabase-js';
import { env } from './env.js';

// Service role client — bypasses RLS, for server-side operations only
export const supabase = createClient(env.supabaseUrl, env.supabaseServiceRoleKey);

// Creates a client scoped to a specific user's JWT — respects RLS
export function createUserClient(accessToken: string) {
  return createClient(env.supabaseUrl, env.supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}
