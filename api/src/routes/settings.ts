import { Hono } from 'hono';
import { supabase } from '../lib/supabase.js';
import { env } from '../lib/env.js';
import type { AuthEnv } from '../middleware/auth.js';
import { validateHouseholdSettings, validateMemberProfile } from '../lib/validation.js';

export const settingsRoute = new Hono<AuthEnv>();

// Note: requireMember middleware runs before all settings routes,
// setting householdId, memberId, and memberRole on context.
// Route handlers use userClient (RLS-enforced) for data queries.
// Service-role supabase is only used for admin auth operations (invite email).

// ── Household Settings ──

settingsRoute.get('/household', async (c) => {
  const householdId = c.get('householdId');
  const db = c.get('userClient');

  const { data, error } = await db.from('household').select('*').eq('id', householdId).single();

  if (error) {
    console.error('GET /settings/household error:', {
      householdId,
      code: error.code,
      message: error.message,
      details: error.details,
    });
    return c.json({ error: error.message }, error.code === 'PGRST116' ? 404 : 500);
  }
  return c.json(data);
});

settingsRoute.patch('/household', async (c) => {
  const householdId = c.get('householdId');
  const db = c.get('userClient');
  const role = c.get('memberRole');
  if (role !== 'owner') return c.json({ error: 'Only owners can edit household settings' }, 403);

  const body = await c.req.json();
  const errors = validateHouseholdSettings(body);
  if (errors.length > 0) {
    return c.json({ error: 'Validation failed', details: errors }, 400);
  }

  const update: Record<string, unknown> = {};
  if (body.name != null) update.name = body.name.trim();
  if (body.taxFilingStatus !== undefined) update.tax_filing_status = body.taxFilingStatus || null;
  if (body.state !== undefined) update.state = body.state || null;
  if (body.currency != null) update.currency = body.currency;

  if (Object.keys(update).length === 0) {
    return c.json({ error: 'No fields to update' }, 400);
  }

  const { data, error } = await db
    .from('household')
    .update(update)
    .eq('id', householdId)
    .select()
    .single();

  if (error) return c.json({ error: error.message }, 500);
  return c.json(data);
});

// ── Member Profile ──

settingsRoute.get('/profile', async (c) => {
  const memberId = c.get('memberId');
  const householdId = c.get('householdId');
  const db = c.get('userClient');

  const { data, error } = await db.from('member').select('*').eq('id', memberId).single();

  if (error) return c.json({ error: error.message }, 500);

  // Compute annual_income from income sources (SSOT) instead of the column
  const { data: sources } = await db
    .from('income_source')
    .select('gross_amount, frequency, is_active')
    .eq('household_id', householdId)
    .eq('member_id', memberId)
    .eq('is_active', true);

  const FREQ_TO_ANNUAL: Record<string, number> = {
    monthly: 12,
    biweekly: 26,
    annual: 1,
    one_time: 0,
  };

  const computedAnnualIncome = (sources ?? []).reduce((sum, s) => {
    return sum + Number(s.gross_amount) * (FREQ_TO_ANNUAL[s.frequency] ?? 12);
  }, 0);

  return c.json({ ...data, annual_income: computedAnnualIncome || null });
});

settingsRoute.patch('/profile', async (c) => {
  const memberId = c.get('memberId');
  const db = c.get('userClient');

  // Fetch current profile for validation context
  const { data: current } = await db
    .from('member')
    .select('birthday, target_retirement_age')
    .eq('id', memberId)
    .single();

  const body = await c.req.json();

  const birthdayForValidation = body.birthday ?? current?.birthday;
  const errors = validateMemberProfile({
    ...body,
    birthday: birthdayForValidation,
    targetRetirementAge: body.targetRetirementAge ?? current?.target_retirement_age,
  });
  if (errors.length > 0) {
    return c.json({ error: 'Validation failed', details: errors }, 400);
  }

  const update: Record<string, unknown> = {};
  if (body.displayName != null) update.display_name = body.displayName.trim();
  if (body.birthday != null) update.birthday = body.birthday;
  if (body.targetRetirementAge != null) update.target_retirement_age = body.targetRetirementAge;
  // annual_income is computed from income sources — not directly editable
  if (body.employmentType !== undefined) update.employment_type = body.employmentType || null;
  if (body.riskTolerance !== undefined) update.risk_tolerance = body.riskTolerance || null;
  if (body.stateOfResidence !== undefined)
    update.state_of_residence = body.stateOfResidence || null;
  if (body.taxMode !== undefined) update.tax_mode = body.taxMode;
  if (body.effectiveTaxRateOverride !== undefined)
    update.effective_tax_rate_override = body.effectiveTaxRateOverride ?? null;

  if (Object.keys(update).length === 0) {
    return c.json({ error: 'No fields to update' }, 400);
  }

  const { data, error } = await db
    .from('member')
    .update(update)
    .eq('id', memberId)
    .select()
    .single();

  if (error) return c.json({ error: error.message }, 500);
  return c.json(data);
});

// ── Members List & Invites ──

settingsRoute.get('/members', async (c) => {
  const householdId = c.get('householdId');
  const db = c.get('userClient');

  const { data, error } = await db
    .from('member')
    .select('id, household_id, display_name, role, created_at')
    .eq('household_id', householdId)
    .order('created_at');

  if (error) return c.json({ error: error.message }, 500);
  return c.json(data);
});

settingsRoute.delete('/members/:memberId', async (c) => {
  const householdId = c.get('householdId');
  const currentMemberId = c.get('memberId');
  const db = c.get('userClient');
  const role = c.get('memberRole');
  if (role !== 'owner') return c.json({ error: 'Only owners can remove members' }, 403);

  const memberId = c.req.param('memberId');

  if (memberId === currentMemberId) {
    return c.json({ error: 'Cannot remove yourself' }, 400);
  }

  // Verify target is in same household
  const { data: target } = await db
    .from('member')
    .select('id')
    .eq('id', memberId)
    .eq('household_id', householdId)
    .maybeSingle();

  if (!target) return c.json({ error: 'Member not found in your household' }, 404);

  const { error } = await db.from('member').delete().eq('id', memberId);

  if (error) {
    if (error.message.includes('last owner')) {
      return c.json({ error: 'Cannot remove the last owner from a household' }, 400);
    }
    return c.json({ error: error.message }, 500);
  }

  return c.json({ success: true });
});

// ── Invites ──

settingsRoute.get('/invites', async (c) => {
  const householdId = c.get('householdId');
  const db = c.get('userClient');
  const role = c.get('memberRole');
  if (role !== 'owner') return c.json({ error: 'Only owners can view invites' }, 403);

  const { data, error } = await db
    .from('household_invite')
    .select('*')
    .eq('household_id', householdId)
    .is('accepted_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false });

  if (error) return c.json({ error: error.message }, 500);
  return c.json(data);
});

settingsRoute.post('/invites', async (c) => {
  const householdId = c.get('householdId');
  const currentMemberId = c.get('memberId');
  const db = c.get('userClient');
  const role = c.get('memberRole');
  if (role !== 'owner') return c.json({ error: 'Only owners can send invites' }, 403);

  const body = await c.req.json();

  if (!body.email || typeof body.email !== 'string' || !body.email.includes('@')) {
    return c.json({ error: 'Valid email is required' }, 400);
  }

  const email = body.email.trim().toLowerCase();

  // check_email_has_household RPC needs service-role (cross-household lookup)
  const { data: hasHousehold } = await supabase.rpc('check_email_has_household', {
    p_email: email,
  });

  if (hasHousehold) {
    return c.json({ error: 'This email is already associated with a household' }, 409);
  }

  // Check for existing pending invite to same email
  const { data: existingInvite } = await db
    .from('household_invite')
    .select('id')
    .eq('household_id', householdId)
    .eq('email', email)
    .is('accepted_at', null)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();

  if (existingInvite) {
    return c.json({ error: 'A pending invite already exists for this email' }, 409);
  }

  // Create invite record
  const { data: invite, error } = await db
    .from('household_invite')
    .insert({
      household_id: householdId,
      email,
      invited_by: currentMemberId,
      role: 'owner',
    })
    .select()
    .single();

  if (error) return c.json({ error: error.message }, 500);

  // Admin email operation — requires service-role
  const { error: emailError } = await supabase.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${c.req.header('origin') || env.corsOrigin}/onboarding/accept-invite?inviteId=${invite.id}`,
  });

  if (emailError) {
    return c.json({ ...invite, emailSent: false, emailError: emailError.message }, 201);
  }

  return c.json({ ...invite, emailSent: true }, 201);
});

settingsRoute.delete('/invites/:inviteId', async (c) => {
  const householdId = c.get('householdId');
  const db = c.get('userClient');
  const role = c.get('memberRole');
  if (role !== 'owner') return c.json({ error: 'Only owners can cancel invites' }, 403);

  const inviteId = c.req.param('inviteId');

  const { error } = await db
    .from('household_invite')
    .delete()
    .eq('id', inviteId)
    .eq('household_id', householdId);

  if (error) return c.json({ error: error.message }, 500);
  return c.json({ success: true });
});
