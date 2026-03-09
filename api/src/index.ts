import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { env } from './lib/env.js';
import { healthRoute } from './routes/health.js';
import { accountsRoute } from './routes/accounts.js';
import { sourcesRoute } from './routes/sources.js';
import { ingestRoute } from './routes/ingest.js';
import { duplicatesRoute } from './routes/duplicates.js';

const app = new Hono();

// Middleware
app.use('*', logger());
app.use('*', cors({ origin: env.corsOrigin }));

// Routes
app.route('/health', healthRoute);
app.route('/api/accounts', accountsRoute);
app.route('/api/sources', sourcesRoute);
app.route('/api/ingest', ingestRoute);
app.route('/api/duplicates', duplicatesRoute);

serve({ fetch: app.fetch, port: env.port }, (info) => {
  console.warn(`FIRE API running on http://localhost:${info.port}`);
});

export default app;
