import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Hono } from 'hono';
import { settingsRoute } from '../../src/routes/settings.js';
import type { AuthEnv } from '../../src/middleware/auth.js';
import { getTestClient, cleanupTestHousehold } from '../helpers.js';

/**
 * Settings tests use a null auth_user_id in DB members (FK to auth.users).
 * To connect the stub auth middleware to the DB member, we override getMember
 * lookups by inserting members without auth_user_id and using a test helper
 * that pre-loads the member into context.
 *
 * Approach: since the settings route calls getMember(authUser.id) which queries
 * member.eq('auth_user_id', authUser.id), and our test members have null
 * auth_user_id, we need a different approach.
 *
 * We'll create a wrapper route that injects the member directly, bypassing
 * the auth_user_id lookup. This tests the route logic without needing real auth.
 */

// We can't use fake auth_user_ids (FK constraint), so we'll test settings routes
// by directly calling the supabase client for DB-dependent tests, and use the
// Hono layer for validation-only tests.

const db = getTestClient();

let householdId: string;
let ownerId: string;
let memberId: string;

// For Hono-level tests, we need a known auth_user_id that exists in auth.users.
// Since we can't create real auth users, we test settings routes that don't depend
// on auth_user_id (validation paths) via Hono and DB-dependent paths directly.

function buildApp(authId: string, email: string) {
  const app = new Hono<AuthEnv>();
  app.use('*', async (c, next) => {
    c.set('authUser', { id: authId, email });
    await next();
  });
  app.route('/api/settings', settingsRoute);
  return app;
}

function req(app: ReturnType<typeof buildApp>, method: string, path: string, body?: unknown) {
  const init: RequestInit = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) init.body = JSON.stringify(body);
  return app.request(path, init);
}

beforeAll(async () => {
  // Create test household with new columns
  const { data: hh, error: hhErr } = await db
    .from('household')
    .insert({
      name: 'Settings Test Household',
      tax_filing_status: 'single',
      state: 'NY',
      currency: 'USD',
    })
    .select()
    .single();
  if (hhErr) throw new Error(`Failed to create household: ${hhErr.message}`);
  householdId = hh.id;

  // Owner member (no auth_user_id — FK constraint)
  const { data: owner, error: ownerErr } = await db
    .from('member')
    .insert({
      household_id: householdId,
      display_name: 'Owner',
      role: 'owner',
      birthday: '1985-03-10',
      target_retirement_age: 55,
      employment_type: 'w2',
      risk_tolerance: 'moderate',
    })
    .select()
    .single();
  if (ownerErr) throw new Error(`Failed to create owner: ${ownerErr.message}`);
  ownerId = owner.id;

  // Second member
  const { data: member, error: memErr } = await db
    .from('member')
    .insert({
      household_id: householdId,
      display_name: 'Partner',
      role: 'owner',
      birthday: '1987-07-22',
      target_retirement_age: 50,
    })
    .select()
    .single();
  if (memErr) throw new Error(`Failed to create member: ${memErr.message}`);
  memberId = member.id;
});

afterAll(async () => {
  await db.from('household_invite').delete().eq('household_id', householdId);
  await cleanupTestHousehold(householdId);
});

// ── Direct DB tests (bypass Hono layer since we can't match auth_user_id) ──

describe('Household settings — DB operations', () => {
  it('reads household with new columns', async () => {
    const { data, error } = await db.from('household').select('*').eq('id', householdId).single();
    expect(error).toBeNull();
    expect(data.name).toBe('Settings Test Household');
    expect(data.tax_filing_status).toBe('single');
    expect(data.state).toBe('NY');
    expect(data.currency).toBe('USD');
  });

  it('updates household settings', async () => {
    const { data, error } = await db
      .from('household')
      .update({
        name: 'Updated Household',
        tax_filing_status: 'married_jointly',
        state: 'CA',
      })
      .eq('id', householdId)
      .select()
      .single();
    expect(error).toBeNull();
    expect(data.name).toBe('Updated Household');
    expect(data.tax_filing_status).toBe('married_jointly');
    expect(data.state).toBe('CA');
  });

  it('clears optional fields', async () => {
    const { data, error } = await db
      .from('household')
      .update({ tax_filing_status: null, state: null })
      .eq('id', householdId)
      .select()
      .single();
    expect(error).toBeNull();
    expect(data.tax_filing_status).toBeNull();
    expect(data.state).toBeNull();
  });

  it('rejects invalid tax filing status at DB level', async () => {
    const { error } = await db
      .from('household')
      .update({ tax_filing_status: 'divorced' })
      .eq('id', householdId);
    expect(error).not.toBeNull();
    expect(error!.message).toContain('chk_household_tax_filing_status');
  });

  it('rejects invalid state at DB level', async () => {
    const { error } = await db
      .from('household')
      .update({ state: 'XYZ' }) // 3 chars, fails length check
      .eq('id', householdId);
    expect(error).not.toBeNull();
  });
});

describe('Member profile — DB operations', () => {
  it('reads member with new columns', async () => {
    const { data, error } = await db.from('member').select('*').eq('id', ownerId).single();
    expect(error).toBeNull();
    expect(data.display_name).toBe('Owner');
    expect(data.birthday).toBe('1985-03-10');
    expect(data.target_retirement_age).toBe(55);
    expect(data.employment_type).toBe('w2');
    expect(data.risk_tolerance).toBe('moderate');
  });

  it('updates member profile fields', async () => {
    const { data, error } = await db
      .from('member')
      .update({
        display_name: 'Updated Owner',
        target_retirement_age: 60,
        employment_type: 'mixed',
      })
      .eq('id', ownerId)
      .select()
      .single();
    expect(error).toBeNull();
    expect(data.display_name).toBe('Updated Owner');
    expect(data.target_retirement_age).toBe(60);
    expect(data.employment_type).toBe('mixed');
  });

  it('clears optional member fields', async () => {
    const { data, error } = await db
      .from('member')
      .update({
        employment_type: null,
        risk_tolerance: null,
      })
      .eq('id', ownerId)
      .select()
      .single();
    expect(error).toBeNull();
    expect(data.employment_type).toBeNull();
    expect(data.risk_tolerance).toBeNull();
  });

  it('rejects invalid employment type at DB level', async () => {
    const { error } = await db
      .from('member')
      .update({ employment_type: 'freelance' })
      .eq('id', ownerId);
    expect(error).not.toBeNull();
    expect(error!.message).toContain('chk_member_employment_type');
  });

  it('rejects invalid risk tolerance at DB level', async () => {
    const { error } = await db.from('member').update({ risk_tolerance: 'yolo' }).eq('id', ownerId);
    expect(error).not.toBeNull();
    expect(error!.message).toContain('chk_member_risk_tolerance');
  });
});

describe('Members management — DB operations', () => {
  it('lists household members', async () => {
    const { data, error } = await db
      .from('member')
      .select('id, display_name, role')
      .eq('household_id', householdId)
      .order('created_at');
    expect(error).toBeNull();
    expect(data!.length).toBe(2);
  });

  it('removes a member', async () => {
    // Create a removable member
    const { data: extra } = await db
      .from('member')
      .insert({
        household_id: householdId,
        display_name: 'Removable',
        role: 'viewer',
      })
      .select()
      .single();

    const { error } = await db.from('member').delete().eq('id', extra!.id);
    expect(error).toBeNull();

    // Verify removal
    const { data: remaining } = await db
      .from('member')
      .select('id')
      .eq('household_id', householdId);
    const ids = remaining!.map((m: { id: string }) => m.id);
    expect(ids).not.toContain(extra!.id);
  });

  it('DB trigger blocks removing last owner', async () => {
    // Remove the partner (second owner) first
    await db.from('member').delete().eq('id', memberId);

    // Try to remove the last owner — trigger should block
    const { error } = await db.from('member').delete().eq('id', ownerId);
    expect(error).not.toBeNull();
    expect(error!.message).toContain('last owner');

    // Re-create partner for other tests
    const { data: newMember } = await db
      .from('member')
      .insert({
        household_id: householdId,
        display_name: 'Partner',
        role: 'owner',
        birthday: '1987-07-22',
        target_retirement_age: 50,
      })
      .select()
      .single();
    memberId = newMember!.id;
  });
});

describe('Invites — DB operations', () => {
  let inviteId: string;

  it('creates an invite', async () => {
    const { data, error } = await db
      .from('household_invite')
      .insert({
        household_id: householdId,
        email: 'invite-test@fire.test',
        invited_by: ownerId,
        role: 'owner',
      })
      .select()
      .single();
    expect(error).toBeNull();
    expect(data!.email).toBe('invite-test@fire.test');
    expect(data!.role).toBe('owner');
    expect(data!.accepted_at).toBeNull();
    inviteId = data!.id;
  });

  it('lists pending (non-expired, non-accepted) invites', async () => {
    const { data, error } = await db
      .from('household_invite')
      .select('*')
      .eq('household_id', householdId)
      .is('accepted_at', null)
      .gt('expires_at', new Date().toISOString());
    expect(error).toBeNull();
    expect(data!.length).toBeGreaterThanOrEqual(1);
  });

  it('marks invite as accepted', async () => {
    const { data, error } = await db
      .from('household_invite')
      .update({ accepted_at: new Date().toISOString() })
      .eq('id', inviteId)
      .select()
      .single();
    expect(error).toBeNull();
    expect(data!.accepted_at).not.toBeNull();
  });

  it('accepted invite no longer appears in pending list', async () => {
    const { data } = await db
      .from('household_invite')
      .select('id')
      .eq('household_id', householdId)
      .is('accepted_at', null)
      .gt('expires_at', new Date().toISOString());
    const ids = data!.map((i: { id: string }) => i.id);
    expect(ids).not.toContain(inviteId);
  });

  it('deletes a pending invite', async () => {
    const { data: invite } = await db
      .from('household_invite')
      .insert({
        household_id: householdId,
        email: 'delete-me@fire.test',
        invited_by: ownerId,
        role: 'owner',
      })
      .select()
      .single();

    const { error } = await db.from('household_invite').delete().eq('id', invite!.id);
    expect(error).toBeNull();
  });
});

// ── Hono-level validation tests (don't hit DB auth_user_id lookup) ──

describe('Settings route — validation (Hono layer)', () => {
  // These use a fake auth_user_id. The getMember() call returns null (no match),
  // so we get 404 for most routes. But we can still test that the routes exist
  // and the auth middleware is not blocking.
  const app = buildApp('00000000-ffff-0000-0000-000000000001', 'test@fire.test');

  it('GET /api/settings/household returns 404 for unknown user', async () => {
    const res = await req(app, 'GET', '/api/settings/household');
    expect(res.status).toBe(404);
  });

  it('GET /api/settings/profile returns 404 for unknown user', async () => {
    const res = await req(app, 'GET', '/api/settings/profile');
    expect(res.status).toBe(404);
  });

  it('GET /api/settings/members returns 404 for unknown user', async () => {
    const res = await req(app, 'GET', '/api/settings/members');
    expect(res.status).toBe(404);
  });

  it('PATCH /api/settings/household returns 404 for unknown user', async () => {
    const res = await req(app, 'PATCH', '/api/settings/household', { name: 'Test' });
    expect(res.status).toBe(404);
  });

  it('PATCH /api/settings/profile returns 404 for unknown user', async () => {
    const res = await req(app, 'PATCH', '/api/settings/profile', { displayName: 'Test' });
    expect(res.status).toBe(404);
  });
});
