import { Hono } from 'hono';
import { supabase } from '../lib/supabase.js';
import type { AuthEnv } from '../middleware/auth.js';
import { validateOnboarding, validateMemberProfile } from '../lib/validation.js';

export const onboardingRoute = new Hono<AuthEnv>();

/**
 * POST /api/onboarding
 * Creates household + member via Postgres RPC (single transaction).
 * Falls back to sequential inserts if RPC is unavailable.
 * Body: { householdName, taxFilingStatus?, state?, currency?,
 *         displayName, birthday, targetRetirementAge,
 *         employmentType?, riskTolerance? }
 */
onboardingRoute.post('/', async (c) => {
  const authUser = c.get('authUser');
  const body = await c.req.json();

  const errors = validateOnboarding(body);
  if (errors.length > 0) {
    return c.json({ error: 'Validation failed', details: errors }, 400);
  }

  // Check user doesn't already have a household
  const { data: existingMember } = await supabase
    .from('member')
    .select('id')
    .eq('auth_user_id', authUser.id)
    .maybeSingle();

  if (existingMember) {
    return c.json({ error: 'User already belongs to a household' }, 409);
  }

  // Try atomic RPC first
  const { data: rpcData, error: rpcError } = await supabase.rpc('create_household_with_owner', {
    p_household_name: body.householdName.trim(),
    p_tax_filing_status: body.taxFilingStatus || null,
    p_state: body.state || null,
    p_currency: body.currency || 'USD',
    p_auth_user_id: authUser.id,
    p_display_name: body.displayName.trim(),
    p_birthday: body.birthday,
    p_target_retirement_age: body.targetRetirementAge || null,
    p_employment_type: body.employmentType || null,
    p_risk_tolerance: body.riskTolerance || null,
  });

  if (!rpcError && rpcData) {
    return c.json(rpcData, 201);
  }

  if (rpcError?.message.includes('already belongs to a household')) {
    return c.json({ error: 'User already belongs to a household' }, 409);
  }

  // Fallback: sequential inserts (non-atomic, but handles FK-less environments)
  const { data: household, error: householdError } = await supabase
    .from('household')
    .insert({
      name: body.householdName.trim(),
      tax_filing_status: body.taxFilingStatus || null,
      state: body.state || null,
      currency: body.currency || 'USD',
    })
    .select()
    .single();

  if (householdError) {
    return c.json({ error: 'Failed to create household', details: householdError.message }, 500);
  }

  const { data: member, error: memberError } = await supabase
    .from('member')
    .insert({
      household_id: household.id,
      auth_user_id: authUser.id,
      display_name: body.displayName.trim(),
      role: 'owner',
      birthday: body.birthday,
      target_retirement_age: body.targetRetirementAge || null,
      employment_type: body.employmentType || null,
      risk_tolerance: body.riskTolerance || null,
    })
    .select()
    .single();

  if (memberError) {
    // Rollback household
    await supabase.from('household').delete().eq('id', household.id);
    return c.json({ error: 'Failed to create member', details: memberError.message }, 500);
  }

  return c.json({ household, member }, 201);
});

/**
 * POST /api/onboarding/accept-invite
 * Partner accepts an invite and creates their member profile.
 * Body: { inviteId, displayName, birthday, targetRetirementAge,
 *         employmentType?, riskTolerance? }
 */
onboardingRoute.post('/accept-invite', async (c) => {
  const authUser = c.get('authUser');
  const body = await c.req.json();

  if (!body.inviteId) {
    return c.json({ error: 'inviteId is required' }, 400);
  }

  const errors: { field: string; message: string }[] = [];

  if (!body.displayName || typeof body.displayName !== 'string' || !body.displayName.trim()) {
    errors.push({ field: 'displayName', message: 'Display name is required' });
  }
  if (!body.birthday) {
    errors.push({ field: 'birthday', message: 'Birthday is required' });
  }

  errors.push(
    ...validateMemberProfile({
      displayName: body.displayName,
      birthday: body.birthday,
      targetRetirementAge: body.targetRetirementAge,
      employmentType: body.employmentType,
      riskTolerance: body.riskTolerance,
    }),
  );

  if (errors.length > 0) {
    return c.json({ error: 'Validation failed', details: errors }, 400);
  }

  // Check user doesn't already have a household
  const { data: existingMember } = await supabase
    .from('member')
    .select('id')
    .eq('auth_user_id', authUser.id)
    .maybeSingle();

  if (existingMember) {
    return c.json({ error: 'User already belongs to a household' }, 409);
  }

  // Fetch and validate invite
  const { data: invite, error: inviteError } = await supabase
    .from('household_invite')
    .select('*')
    .eq('id', body.inviteId)
    .is('accepted_at', null)
    .maybeSingle();

  if (inviteError || !invite) {
    return c.json({ error: 'Invite not found or already accepted' }, 404);
  }

  if (invite.email !== authUser.email) {
    return c.json({ error: 'Invite was sent to a different email address' }, 403);
  }

  if (new Date(invite.expires_at) < new Date()) {
    return c.json({ error: 'Invite has expired. Ask the household owner to resend.' }, 410);
  }

  // Create member (role always 'owner' per spec)
  const { data: member, error: memberError } = await supabase
    .from('member')
    .insert({
      household_id: invite.household_id,
      auth_user_id: authUser.id,
      display_name: body.displayName.trim(),
      role: 'owner',
      birthday: body.birthday,
      target_retirement_age: body.targetRetirementAge || null,
      employment_type: body.employmentType || null,
      risk_tolerance: body.riskTolerance || null,
    })
    .select()
    .single();

  if (memberError) {
    return c.json({ error: 'Failed to create member', details: memberError.message }, 500);
  }

  // Mark invite as accepted
  await supabase
    .from('household_invite')
    .update({ accepted_at: new Date().toISOString() })
    .eq('id', invite.id);

  return c.json({ member, householdId: invite.household_id }, 201);
});
