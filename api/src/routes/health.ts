import { Hono } from 'hono';
import { supabase } from '../lib/supabase';

export const healthRoute = new Hono();

healthRoute.get('/', async (c) => {
  // Quick DB ping
  const { error } = await supabase.from('household').select('id').limit(1);

  return c.json({
    status: error ? 'degraded' : 'ok',
    db: error ? error.message : 'connected',
    timestamp: new Date().toISOString(),
  });
});
