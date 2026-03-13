import { Hono } from 'hono';
import { supabase } from '../lib/supabase.js';
import type { AuthEnv } from '../middleware/auth.js';

interface FinnhubQuote {
  c: number; // current price
  h: number; // high
  l: number; // low
  o: number; // open
  pc: number; // previous close
  t: number; // timestamp
}

interface QuoteResult {
  price: number;
  previousClose: number;
  change: number;
  changePercent: number;
}

const FINNHUB_BASE = 'https://finnhub.io/api/v1';
const MAX_SYMBOLS = 50;

async function fetchFinnhubQuote(symbol: string, apiKey: string): Promise<QuoteResult | null> {
  try {
    const res = await fetch(
      `${FINNHUB_BASE}/quote?symbol=${encodeURIComponent(symbol)}&token=${apiKey}`,
    );

    if (!res.ok) return null;

    const data = (await res.json()) as FinnhubQuote;

    // Finnhub returns all zeros for unknown symbols
    if (!data.c && !data.pc) return null;

    const change = data.c - data.pc;
    const changePercent = data.pc !== 0 ? (change / data.pc) * 100 : 0;

    return {
      price: data.c,
      previousClose: data.pc,
      change: Math.round(change * 100) / 100,
      changePercent: Math.round(changePercent * 100) / 100,
    };
  } catch {
    return null;
  }
}

export const quotesRoute = new Hono<AuthEnv>();

quotesRoute.get('/', async (c) => {
  const symbolsParam = c.req.query('symbols');
  if (!symbolsParam) {
    return c.json({ error: 'Missing required query parameter: symbols' }, 400);
  }

  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey) {
    return c.json({ error: 'Quote service not configured' }, 503);
  }

  const symbols = symbolsParam
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);

  if (symbols.length === 0) {
    return c.json({ error: 'No valid symbols provided' }, 400);
  }

  if (symbols.length > MAX_SYMBOLS) {
    return c.json({ error: `Maximum ${MAX_SYMBOLS} symbols per request` }, 400);
  }

  // Fetch all quotes in parallel
  const results = await Promise.all(
    symbols.map(async (symbol) => {
      const quote = await fetchFinnhubQuote(symbol, apiKey);
      return { symbol, quote };
    }),
  );

  // Build response and collect rows for cache upsert
  const quotes: Record<string, QuoteResult | null> = {};
  const cacheRows: {
    symbol: string;
    price: number;
    prev_close: number;
    day_change_pct: number;
    source: string;
    updated_at: string;
  }[] = [];

  for (const { symbol, quote } of results) {
    quotes[symbol] = quote;

    if (quote) {
      cacheRows.push({
        symbol,
        price: quote.price,
        prev_close: quote.previousClose,
        day_change_pct: quote.changePercent,
        source: 'finnhub',
        updated_at: new Date().toISOString(),
      });
    }
  }

  // Upsert successful quotes into security_price cache (fire-and-forget)
  if (cacheRows.length > 0) {
    supabase
      .from('security_price')
      .upsert(cacheRows, { onConflict: 'symbol' })
      .then(({ error }) => {
        if (error) {
          console.error('security_price cache upsert failed:', error.message);
        }
      });
  }

  return c.json({ quotes });
});
