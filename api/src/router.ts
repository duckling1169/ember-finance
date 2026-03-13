import { Hono } from 'hono';
import { accountsRoute } from './routes/accounts.js';
import { holdingsRoute } from './routes/holdings.js';
import { ingestRoute } from './routes/ingest.js';
import { activityRoute } from './routes/activity.js';
import { duplicatesRoute } from './routes/duplicates.js';
import { onboardingRoute } from './routes/onboarding.js';
import { settingsRoute } from './routes/settings.js';
import { planningRoute } from './routes/planning.js';
import { syncRoute } from './routes/sync.js';
import { quotesRoute } from './routes/quotes.js';
import {
  requireAuth,
  requireMember,
  requireHouseholdMember,
  requireRecordOwnership,
} from './middleware/auth.js';
import { rateLimit } from './middleware/rate-limit.js';

/**
 * Creates a fully-configured API router with all middleware and routes.
 *
 * Mounted at both `/api/v1` (canonical) and `/api` (backward compat)
 * so all paths below are relative to the mount point.
 */
export function createApiRouter() {
  const api = new Hono();

  // Rate limiting — applied before auth so brute-force attempts are blocked
  api.use('*', rateLimit({ windowSec: 60, max: 100 }));

  // Stricter rate limit for auth-adjacent endpoints
  api.use('/onboarding/*', rateLimit({ windowSec: 60, max: 10 }));

  // Auth on all routes within this router
  api.use('*', requireAuth);

  // Settings: resolve member/household from auth (no :householdId in path)
  api.use('/settings/*', requireMember);

  // Household membership verification for routes with :householdId
  api.use('/accounts/:householdId', requireHouseholdMember);
  api.use('/accounts/:householdId/*', requireHouseholdMember);
  api.use('/activity/transactions/:householdId', requireHouseholdMember);
  api.use('/activity/investments/:householdId', requireHouseholdMember);
  api.use('/holdings/:householdId', requireHouseholdMember);
  api.use('/ingest/manual/:householdId/*', requireHouseholdMember);
  api.use('/ingest/csv/:householdId/*', requireHouseholdMember);
  api.use('/ingest/sync/:householdId/*', requireHouseholdMember);
  api.use('/duplicates/transactions/:householdId/*', requireHouseholdMember);
  api.use('/duplicates/activity/:householdId/*', requireHouseholdMember);
  api.use('/duplicates/review/:householdId/*', requireHouseholdMember);

  // Planning: resolve member/household from auth (no :householdId in path)
  api.use('/planning/*', requireMember);

  // Sync: resolve member/household from auth (no :householdId in path)
  api.use('/sync', requireMember);

  // Record ownership for duplicate hide/unhide (no householdId in path)
  api.use('/duplicates/hide/transaction/:id', requireRecordOwnership('transaction'));
  api.use('/duplicates/unhide/transaction/:id', requireRecordOwnership('transaction'));
  api.use('/duplicates/hide/activity/:id', requireRecordOwnership('investment_activity'));
  api.use('/duplicates/unhide/activity/:id', requireRecordOwnership('investment_activity'));

  // Routes
  api.route('/onboarding', onboardingRoute);
  api.route('/settings', settingsRoute);
  api.route('/accounts', accountsRoute);
  api.route('/activity', activityRoute);
  api.route('/holdings', holdingsRoute);
  api.route('/ingest', ingestRoute);
  api.route('/duplicates', duplicatesRoute);
  api.route('/planning', planningRoute);
  api.route('/quotes', quotesRoute);
  api.route('/sync', syncRoute);

  return api;
}
