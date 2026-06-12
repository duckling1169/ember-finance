import { Hono } from 'hono';
import { supabase } from '../lib/supabase';
import { env } from '../lib/env';
import type { AuthEnv } from '../middleware/auth';

interface TiingoEOD {
  adjClose: number;
  adjHigh: number;
  adjLow: number;
  adjOpen: number;
  adjVolume: number;
  close: number;
  date: string;
  divCash: number;
  high: number;
  low: number;
  open: number;
  splitFactor: number;
  volume: number;
}

interface QuoteResult {
  price: number;
  previousClose: number;
  change: number;
  changePercent: number;
}

const TIINGO_BASE = 'https://api.tiingo.com/tiingo/daily';
const MAX_SYMBOLS = 50;

async function fetchTiingoQuote(symbol: string, apiKey: string): Promise<QuoteResult | null> {
  try {
    // Request last 2 trading days so we get a real previous close
    const url = `${TIINGO_BASE}/${encodeURIComponent(symbol)}/prices?startDate=${twoDaysAgo()}&sort=date`;
    const res = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Token ${apiKey}`,
      },
    });

    if (!res.ok) return null;

    const data = (await res.json()) as TiingoEOD[];

    if (!data || data.length === 0 || !data[data.length - 1].close) return null;

    const latest = data[data.length - 1];
    const prevClose = data.length >= 2 ? data[data.length - 2].close : latest.open;
    const change = latest.close - prevClose;
    const changePercent = prevClose !== 0 ? (change / prevClose) * 100 : 0;

    return {
      price: latest.close,
      previousClose: prevClose,
      change: Math.round(change * 100) / 100,
      changePercent: Math.round(changePercent * 100) / 100,
    };
  } catch {
    return null;
  }
}

/** Returns a date string ~5 calendar days ago to ensure we capture 2 trading days */
function twoDaysAgo(): string {
  const d = new Date();
  d.setDate(d.getDate() - 5);
  return d.toISOString().slice(0, 10);
}

export const quotesRoute = new Hono<AuthEnv>();

quotesRoute.get('/', async (c) => {
  const symbolsParam = c.req.query('symbols');
  if (!symbolsParam) {
    return c.json({ error: 'Missing required query parameter: symbols' }, 400);
  }

  const apiKey = env.tiingoApiKey;
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
      const quote = await fetchTiingoQuote(symbol, apiKey);
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
        source: 'tiingo',
        updated_at: new Date().toISOString(),
      });
    }
  }

  // Upsert successful quotes into the security_price cache. A cache failure
  // shouldn't fail the request — log it and return the quotes anyway.
  if (cacheRows.length > 0) {
    const { error } = await supabase
      .from('security_price')
      .upsert(cacheRows, { onConflict: 'symbol' });
    if (error) {
      console.error('security_price cache upsert failed:', error.message);
    }
  }

  return c.json({ quotes });
});
