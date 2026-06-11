import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { env } from './lib/env.js';
import { createApiRouter } from './router.js';
import { healthRoute } from './routes/health.js';

const app = new Hono();

// Global middleware
app.use('*', logger());
app.use('*', cors({ origin: env.corsOrigins }));

// Health check (not versioned)
app.route('/health', healthRoute);

// One router instance mounted at both paths so middleware state
// (e.g. rate-limit windows) is shared.
const api = createApiRouter();
app.route('/api/v1', api);
app.route('/api', api);

app.notFound((c) => c.json({ error: 'Not found' }, 404));

app.onError((err, c) => {
  // Malformed JSON bodies are a client error, not a server fault
  if (err instanceof SyntaxError) {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }
  console.error(`Unhandled error on ${c.req.method} ${c.req.path}:`, err);
  return c.json({ error: 'Internal server error' }, 500);
});

serve({ fetch: app.fetch, port: env.port }, (info) => {
  console.warn(`Ember API running on http://localhost:${info.port}`);
});

export default app;
