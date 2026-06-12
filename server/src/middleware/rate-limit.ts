import type { Context, MiddlewareHandler } from 'hono';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

interface RateLimitOptions {
  /** Window duration in seconds (default: 60) */
  windowSec?: number;
  /** Max requests per window (default: 100) */
  max?: number;
  /** Key extractor — defaults to IP, falls back to auth user ID */
  keyFn?: (c: Context) => string;
  /** How often to purge expired entries, in ms (default: 60_000) */
  cleanupIntervalMs?: number;
}

/**
 * In-memory fixed-window rate limiter for Hono.
 *
 * Each unique key (IP or user) gets `max` requests per `windowSec` seconds.
 * Expired entries are purged on a periodic timer to prevent memory leaks.
 */
export function rateLimit(opts: RateLimitOptions = {}): MiddlewareHandler {
  const { windowSec = 60, max = 100, keyFn = defaultKeyFn, cleanupIntervalMs = 60_000 } = opts;

  const windowMs = windowSec * 1000;
  const store = new Map<string, RateLimitEntry>();

  // Periodic cleanup of expired entries
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (now >= entry.resetAt) {
        store.delete(key);
      }
    }
  }, cleanupIntervalMs);

  // Allow the process to exit without waiting for the timer
  if (timer.unref) {
    timer.unref();
  }

  return async (c, next) => {
    const key = keyFn(c);
    const now = Date.now();

    let entry = store.get(key);

    // If no entry or window expired, start a fresh window
    if (!entry || now >= entry.resetAt) {
      entry = { count: 0, resetAt: now + windowMs };
      store.set(key, entry);
    }

    entry.count++;

    // Set informational headers
    const remaining = Math.max(0, max - entry.count);
    const retryAfterSec = Math.ceil((entry.resetAt - now) / 1000);

    c.header('X-RateLimit-Limit', String(max));
    c.header('X-RateLimit-Remaining', String(remaining));
    c.header('X-RateLimit-Reset', String(Math.ceil(entry.resetAt / 1000)));

    if (entry.count > max) {
      c.header('Retry-After', String(retryAfterSec));
      return c.json({ error: 'Too many requests. Please try again later.' }, 429);
    }

    await next();
  };
}

/** Default key: client IP. Rate limiting runs before auth, so requests
 *  are bucketed per-IP (x-forwarded-for must come from a trusted proxy). */
function defaultKeyFn(c: Context): string {
  const forwarded = c.req.header('x-forwarded-for');
  if (forwarded) return `ip:${forwarded.split(',')[0].trim()}`;

  const realIp = c.req.header('x-real-ip');
  if (realIp) return `ip:${realIp}`;

  // Last resort: remote address from the raw request
  const connInfo = (c.env as Record<string, unknown>)?.incoming;
  if (connInfo && typeof connInfo === 'object') {
    const socket = (connInfo as Record<string, unknown>).socket as
      | { remoteAddress?: string }
      | undefined;
    if (socket?.remoteAddress) return `ip:${socket.remoteAddress}`;
  }

  return 'ip:unknown';
}
