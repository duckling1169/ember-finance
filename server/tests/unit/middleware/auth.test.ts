import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';

// Mock the supabase lib before importing the middleware
const mockGetUser = vi.fn();
const mockServiceQuery = {
  from: vi.fn(),
};

vi.mock('../../../src/lib/supabase.js', () => ({
  supabase: {
    from: (...args: unknown[]) => mockServiceQuery.from(...args),
    rpc: vi.fn().mockResolvedValue({ data: null, error: { message: 'rpc unavailable' } }),
  },
  createUserClient: () => ({
    auth: { getUser: mockGetUser },
  }),
}));

const { requireAuth, requireMember, requireHouseholdMember } =
  await import('../../../src/middleware/auth.js');
import type { AuthEnv } from '../../../src/middleware/auth.js';

/** Build a chainable query stub resolving to the given result. */
function queryResolving(result: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'limit']) {
    chain[m] = vi.fn(() => chain);
  }
  chain.single = vi.fn(() => Promise.resolve(result));
  chain.maybeSingle = vi.fn(() => Promise.resolve(result));
  return chain;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('requireAuth', () => {
  function buildApp() {
    const app = new Hono<AuthEnv>();
    app.use('*', requireAuth);
    app.get('/protected', (c) => c.json({ user: c.get('authUser') }));
    return app;
  }

  it('rejects requests without an Authorization header', async () => {
    const res = await buildApp().request('/protected');
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toContain('Authorization');
  });

  it('rejects non-Bearer Authorization headers', async () => {
    const res = await buildApp().request('/protected', {
      headers: { Authorization: 'Basic abc123' },
    });
    expect(res.status).toBe(401);
  });

  it('rejects invalid or expired tokens', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: 'expired' } });
    const res = await buildApp().request('/protected', {
      headers: { Authorization: 'Bearer bad-token' },
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toContain('Invalid or expired');
  });

  it('sets authUser and continues for valid tokens', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'u1', email: 'a@b.test' } },
      error: null,
    });
    const res = await buildApp().request('/protected', {
      headers: { Authorization: 'Bearer good-token' },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user).toEqual({ id: 'u1', email: 'a@b.test' });
  });
});

describe('requireMember', () => {
  function buildApp() {
    const app = new Hono<AuthEnv>();
    app.use('*', async (c, next) => {
      c.set('authUser', { id: 'u1', email: 'a@b.test' });
      await next();
    });
    app.use('*', requireMember);
    app.get('/me', (c) =>
      c.json({
        householdId: c.get('householdId'),
        memberId: c.get('memberId'),
        memberRole: c.get('memberRole'),
      }),
    );
    return app;
  }

  it('returns 404 when the user has no household', async () => {
    mockServiceQuery.from.mockReturnValue(
      queryResolving({ data: null, error: { message: 'no rows' } }),
    );
    const res = await buildApp().request('/me');
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toContain('No household');
  });

  it('sets household context for members', async () => {
    mockServiceQuery.from.mockReturnValue(
      queryResolving({
        data: { id: 'mem1', household_id: 'hh1', role: 'owner' },
        error: null,
      }),
    );
    const res = await buildApp().request('/me');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      householdId: 'hh1',
      memberId: 'mem1',
      memberRole: 'owner',
    });
  });
});

describe('requireHouseholdMember', () => {
  function buildApp() {
    const app = new Hono<AuthEnv>();
    app.use('*', async (c, next) => {
      c.set('authUser', { id: 'u1', email: 'a@b.test' });
      await next();
    });
    app.use('/h/:householdId', requireHouseholdMember);
    app.get('/h/:householdId', (c) =>
      c.json({ householdId: c.get('householdId'), memberId: c.get('memberId') }),
    );
    return app;
  }

  it('rejects non-members with 403', async () => {
    mockServiceQuery.from.mockReturnValue(
      queryResolving({ data: null, error: { message: 'no rows' } }),
    );
    const res = await buildApp().request('/h/hh-other');
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain('not a member');
  });

  it('sets context for household members', async () => {
    mockServiceQuery.from.mockReturnValue(queryResolving({ data: { id: 'mem1' }, error: null }));
    const res = await buildApp().request('/h/hh1');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ householdId: 'hh1', memberId: 'mem1' });
  });
});
