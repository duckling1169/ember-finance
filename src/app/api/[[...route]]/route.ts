import { handle } from 'hono/vercel';
import app from '../../../../api/src/app';

// The entire Hono API is served by this single Vercel Function. Mounting the
// app behind one optional catch-all route keeps the deployment at ONE function
// regardless of how many Hono routes exist (Vercel Hobby caps at 12).
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = handle(app);
export const POST = handle(app);
export const PATCH = handle(app);
export const PUT = handle(app);
export const DELETE = handle(app);
export const OPTIONS = handle(app);
