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
import { onboardingRoute } from './routes/onboarding.js';
import { settingsRoute } from './routes/settings.js';
import { requireAuth } from './middleware/auth.js';

const app = new Hono();

// Middleware
app.use('*', logger());
app.use('*', cors({ origin: env.corsOrigin }));

// Auth-protected routes — apply before route registration
app.use('/api/onboarding', requireAuth); // POST /api/onboarding
app.use('/api/onboarding/*', requireAuth); // POST /api/onboarding/accept-invite
app.use('/api/settings', requireAuth); // catch root (if any)
app.use('/api/settings/*', requireAuth); // all settings sub-routes

// Routes
app.route('/health', healthRoute);
app.route('/api/onboarding', onboardingRoute);
app.route('/api/settings', settingsRoute);
app.route('/api/accounts', accountsRoute);
app.route('/api/sources', sourcesRoute);
app.route('/api/ingest', ingestRoute);
app.route('/api/duplicates', duplicatesRoute);

serve({ fetch: app.fetch, port: env.port }, (info) => {
  console.warn(`FIRE API running on http://localhost:${info.port}`);
});

export default app;
