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

// Versioned API — canonical v1 routes
const v1 = createApiRouter();
app.route('/api/v1', v1);

// Backward compatibility — mount the same router at /api
app.route('/api', createApiRouter());

serve({ fetch: app.fetch, port: env.port }, (info) => {
  console.warn(`Ember API running on http://localhost:${info.port}`);
});

export default app;
