import { serve } from '@hono/node-server';
import { env } from './lib/env';
import app from './app';

// Local development server. In production the same `app` is mounted as a single
// Vercel Function via the Next.js catch-all route at src/app/api/[[...route]]/route.ts,
// so this entry point is only used for `npm run dev:api`.
serve({ fetch: app.fetch, port: env.port }, (info) => {
  console.warn(`Ember API running on http://localhost:${info.port}`);
});

export default app;
