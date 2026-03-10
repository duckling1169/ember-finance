import { Hono } from 'hono';
import type { AuthEnv } from '../middleware/auth.js';

export const holdingsRoute = new Hono<AuthEnv>();

// ── Cross-account holdings for a household ──

holdingsRoute.get('/:householdId', async (c) => {
  const householdId = c.req.param('householdId');
  const db = c.get('userClient');

  const [positionsRes, summaryRes, lotsRes] = await Promise.all([
    db.from('current_positions').select('*').eq('household_id', householdId),
    db.from('household_positions_summary').select('*').eq('household_id', householdId),
    db.from('open_tax_lots').select('*').eq('household_id', householdId),
  ]);

  if (positionsRes.error) return c.json({ error: positionsRes.error.message }, 500);
  if (summaryRes.error) return c.json({ error: summaryRes.error.message }, 500);
  if (lotsRes.error) return c.json({ error: lotsRes.error.message }, 500);

  return c.json({
    positions: positionsRes.data ?? [],
    summary: summaryRes.data ?? [],
    lots: lotsRes.data ?? [],
  });
});
