import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { env } from './lib/env.js';
import { healthRoute } from './routes/health.js';
import { accountsRoute } from './routes/accounts.js';
import { holdingsRoute } from './routes/holdings.js';
import { ingestRoute } from './routes/ingest.js';
import { activityRoute } from './routes/activity.js';
import { duplicatesRoute } from './routes/duplicates.js';
import { onboardingRoute } from './routes/onboarding.js';
import { settingsRoute } from './routes/settings.js';
import { planningRoute } from './routes/planning.js';
import {
  requireAuth,
  requireMember,
  requireHouseholdMember,
  requireRecordOwnership,
} from './middleware/auth.js';
import { rateLimit } from './middleware/rate-limit.js';

const app = new Hono();

// Middleware
app.use('*', logger());
app.use('*', cors({ origin: env.corsOrigin }));

// Rate limiting — applied before auth so brute-force attempts are blocked
app.use('*', rateLimit({ windowSec: 60, max: 100 }));

// Stricter rate limit for auth-adjacent endpoints
app.use('/api/onboarding/*', rateLimit({ windowSec: 60, max: 10 }));

// Auth on all /api/* routes
app.use('/api/*', requireAuth);

// Settings: resolve member/household from auth (no :householdId in path)
app.use('/api/settings/*', requireMember);

// Household membership verification for routes with :householdId
app.use('/api/accounts/:householdId', requireHouseholdMember);
app.use('/api/accounts/:householdId/*', requireHouseholdMember);
app.use('/api/activity/transactions/:householdId', requireHouseholdMember);
app.use('/api/activity/investments/:householdId', requireHouseholdMember);
app.use('/api/holdings/:householdId', requireHouseholdMember);
app.use('/api/ingest/manual/:householdId/*', requireHouseholdMember);
app.use('/api/ingest/csv/:householdId/*', requireHouseholdMember);
app.use('/api/ingest/sync/:householdId/*', requireHouseholdMember);
app.use('/api/duplicates/transactions/:householdId/*', requireHouseholdMember);
app.use('/api/duplicates/activity/:householdId/*', requireHouseholdMember);
app.use('/api/duplicates/review/:householdId/*', requireHouseholdMember);

// Planning: resolve member/household from auth (no :householdId in path)
app.use('/api/planning/*', requireMember);

// Record ownership for duplicate hide/unhide (no householdId in path)
app.use('/api/duplicates/hide/transaction/:id', requireRecordOwnership('transaction'));
app.use('/api/duplicates/unhide/transaction/:id', requireRecordOwnership('transaction'));
app.use('/api/duplicates/hide/activity/:id', requireRecordOwnership('investment_activity'));
app.use('/api/duplicates/unhide/activity/:id', requireRecordOwnership('investment_activity'));

// Routes
app.route('/health', healthRoute);
app.route('/api/onboarding', onboardingRoute);
app.route('/api/settings', settingsRoute);
app.route('/api/accounts', accountsRoute);
app.route('/api/activity', activityRoute);
app.route('/api/holdings', holdingsRoute);
app.route('/api/ingest', ingestRoute);
app.route('/api/duplicates', duplicatesRoute);
app.route('/api/planning', planningRoute);

serve({ fetch: app.fetch, port: env.port }, (info) => {
  console.warn(`Ember API running on http://localhost:${info.port}`);
});

export default app;
