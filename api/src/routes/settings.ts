import { Hono } from 'hono';
import { supabase } from '../lib/supabase.js';
import { env } from '../lib/env.js';
import type { AuthEnv } from '../middleware/auth.js';
import { validateHouseholdSettings, validateMemberProfile } from '../lib/validation.js';

export const settingsRoute = new Hono<AuthEnv>();

// Helper: get the current user's member record
async function getMember(authUserId: string) {
  const { data } = await supabase
    .from('member')
    .select('*')
    .eq('auth_user_id', authUserId)
    .single();
  return data;
}

// ── Household Settings ──

/**
 * GET /api/settings/household
 * Returns the user's household.
 */
settingsRoute.get('/household', async (c) => {
  const authUser = c.get('authUser');
  const member = await getMember(authUser.id);
  if (!member) return c.json({ error: 'No household found' }, 404);

  const { data, error } = await supabase
    .from('household')
    .select('*')
    .eq('id', member.household_id)
    .single();

  if (error) return c.json({ error: error.message }, 500);
  return c.json(data);
});

/**
 * PATCH /api/settings/household
 * Update household fields. Owner only.
 * Body: { name?, taxFilingStatus?, state?, currency? }
 */
settingsRoute.patch('/household', async (c) => {
  const authUser = c.get('authUser');
  const member = await getMember(authUser.id);
  if (!member) return c.json({ error: 'No household found' }, 404);
  if (member.role !== 'owner')
    return c.json({ error: 'Only owners can edit household settings' }, 403);

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

  const { data, error } = await supabase
    .from('household')
    .update(update)
    .eq('id', member.household_id)
    .select()
    .single();

  if (error) return c.json({ error: error.message }, 500);
  return c.json(data);
});

// ── Member Profile ──

/**
 * GET /api/settings/profile
 * Returns the current user's member profile.
 */
settingsRoute.get('/profile', async (c) => {
  const authUser = c.get('authUser');
  const member = await getMember(authUser.id);
  if (!member) return c.json({ error: 'No profile found' }, 404);
  return c.json(member);
});

/**
 * PATCH /api/settings/profile
 * Update own member profile.
 * Body: { displayName?, birthday?, targetRetirementAge?,
 *         annualIncome?, employmentType?, riskTolerance? }
 */
settingsRoute.patch('/profile', async (c) => {
  const authUser = c.get('authUser');
  const member = await getMember(authUser.id);
  if (!member) return c.json({ error: 'No profile found' }, 404);

  const body = await c.req.json();

  // For retirement age validation, we need the birthday (either from request or existing)
  const birthdayForValidation = body.birthday ?? member.birthday;
  const errors = validateMemberProfile({
    ...body,
    birthday: birthdayForValidation,
    targetRetirementAge: body.targetRetirementAge ?? member.target_retirement_age,
  });
  if (errors.length > 0) {
    return c.json({ error: 'Validation failed', details: errors }, 400);
  }

  const update: Record<string, unknown> = {};
  if (body.displayName != null) update.display_name = body.displayName.trim();
  if (body.birthday != null) update.birthday = body.birthday;
  if (body.targetRetirementAge != null) update.target_retirement_age = body.targetRetirementAge;
  if (body.annualIncome !== undefined) update.annual_income = body.annualIncome || null;
  if (body.employmentType !== undefined) update.employment_type = body.employmentType || null;
  if (body.riskTolerance !== undefined) update.risk_tolerance = body.riskTolerance || null;

  if (Object.keys(update).length === 0) {
    return c.json({ error: 'No fields to update' }, 400);
  }

  const { data, error } = await supabase
    .from('member')
    .update(update)
    .eq('id', member.id)
    .select()
    .single();

  if (error) return c.json({ error: error.message }, 500);
  return c.json(data);
});

// ── Members List & Invites ──

/**
 * GET /api/settings/members
 * List all members in the household.
 */
settingsRoute.get('/members', async (c) => {
  const authUser = c.get('authUser');
  const member = await getMember(authUser.id);
  if (!member) return c.json({ error: 'No household found' }, 404);

  const { data, error } = await supabase
    .from('member')
    .select('id, household_id, display_name, role, created_at')
    .eq('household_id', member.household_id)
    .order('created_at');

  if (error) return c.json({ error: error.message }, 500);
  return c.json(data);
});

/**
 * DELETE /api/settings/members/:memberId
 * Remove a member from the household. Owner only.
 * Cannot remove yourself or the last owner.
 */
settingsRoute.delete('/members/:memberId', async (c) => {
  const authUser = c.get('authUser');
  const member = await getMember(authUser.id);
  if (!member) return c.json({ error: 'No household found' }, 404);
  if (member.role !== 'owner') return c.json({ error: 'Only owners can remove members' }, 403);

  const memberId = c.req.param('memberId');

  // Cannot remove yourself via this endpoint
  if (memberId === member.id) {
    return c.json({ error: 'Cannot remove yourself' }, 400);
  }

  // Verify target is in same household
  const { data: target } = await supabase
    .from('member')
    .select('*')
    .eq('id', memberId)
    .eq('household_id', member.household_id)
    .maybeSingle();

  if (!target) return c.json({ error: 'Member not found in your household' }, 404);

  // DB trigger will prevent removing last owner
  const { error } = await supabase.from('member').delete().eq('id', memberId);

  if (error) {
    if (error.message.includes('last owner')) {
      return c.json({ error: 'Cannot remove the last owner from a household' }, 400);
    }
    return c.json({ error: error.message }, 500);
  }

  return c.json({ success: true });
});

// ── Invites ──

/**
 * GET /api/settings/invites
 * List pending invites for the household. Owner only.
 */
settingsRoute.get('/invites', async (c) => {
  const authUser = c.get('authUser');
  const member = await getMember(authUser.id);
  if (!member) return c.json({ error: 'No household found' }, 404);
  if (member.role !== 'owner') return c.json({ error: 'Only owners can view invites' }, 403);

  const { data, error } = await supabase
    .from('household_invite')
    .select('*')
    .eq('household_id', member.household_id)
    .is('accepted_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false });

  if (error) return c.json({ error: error.message }, 500);
  return c.json(data);
});

/**
 * POST /api/settings/invites
 * Send an invite. Owner only. Role is always 'owner' per spec.
 * Body: { email }
 */
settingsRoute.post('/invites', async (c) => {
  const authUser = c.get('authUser');
  const member = await getMember(authUser.id);
  if (!member) return c.json({ error: 'No household found' }, 404);
  if (member.role !== 'owner') return c.json({ error: 'Only owners can send invites' }, 403);

  const body = await c.req.json();

  if (!body.email || typeof body.email !== 'string' || !body.email.includes('@')) {
    return c.json({ error: 'Valid email is required' }, 400);
  }

  const email = body.email.trim().toLowerCase();

  // Check if email already has a household (single indexed query, no full user scan)
  const { data: hasHousehold } = await supabase.rpc('check_email_has_household', {
    p_email: email,
  });

  if (hasHousehold) {
    return c.json({ error: 'This email is already associated with a household' }, 409);
  }

  // Check for existing pending invite to same email
  const { data: existingInvite } = await supabase
    .from('household_invite')
    .select('id')
    .eq('household_id', member.household_id)
    .eq('email', email)
    .is('accepted_at', null)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();

  if (existingInvite) {
    return c.json({ error: 'A pending invite already exists for this email' }, 409);
  }

  // Create invite record (role always 'owner' per spec)
  const { data: invite, error } = await supabase
    .from('household_invite')
    .insert({
      household_id: member.household_id,
      email,
      invited_by: member.id,
      role: 'owner',
    })
    .select()
    .single();

  if (error) return c.json({ error: error.message }, 500);

  // Send invite email via Supabase Auth magic link
  // If user doesn't exist yet, this creates an unconfirmed account and sends the link.
  // If they already have an account, it sends a magic link to sign in.
  const { error: emailError } = await supabase.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${c.req.header('origin') || env.corsOrigin}/onboarding/accept-invite?inviteId=${invite.id}`,
  });

  if (emailError) {
    // Invite record is still created — email can be resent.
    // Don't fail the whole request, just flag it.
    return c.json({ ...invite, emailSent: false, emailError: emailError.message }, 201);
  }

  return c.json({ ...invite, emailSent: true }, 201);
});

/**
 * DELETE /api/settings/invites/:inviteId
 * Cancel a pending invite. Owner only.
 */
settingsRoute.delete('/invites/:inviteId', async (c) => {
  const authUser = c.get('authUser');
  const member = await getMember(authUser.id);
  if (!member) return c.json({ error: 'No household found' }, 404);
  if (member.role !== 'owner') return c.json({ error: 'Only owners can cancel invites' }, 403);

  const inviteId = c.req.param('inviteId');

  const { error } = await supabase
    .from('household_invite')
    .delete()
    .eq('id', inviteId)
    .eq('household_id', member.household_id);

  if (error) return c.json({ error: error.message }, 500);
  return c.json({ success: true });
});
