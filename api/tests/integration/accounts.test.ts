import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestHousehold, cleanupTestHousehold, getTestClient } from '../helpers.js';

describe('accounts (DB integration)', () => {
  let householdId: string;
  let memberId: string;

  beforeAll(async () => {
    const ctx = await createTestHousehold();
    householdId = ctx.householdId;
    memberId = ctx.memberId;
  });

  afterAll(async () => {
    await cleanupTestHousehold(householdId);
  });

  it('creates a checking account', async () => {
    const db = getTestClient();
    const { data, error } = await db
      .from('account')
      .insert({
        household_id: householdId,
        name: 'Chase Checking',
        institution: 'Chase',
        account_type: 'checking',
        is_liability: false,
      })
      .select()
      .single();

    expect(error).toBeNull();
    expect(data!.name).toBe('Chase Checking');
    expect(data!.institution).toBe('Chase');
    expect(data!.account_type).toBe('checking');
    expect(data!.is_liability).toBe(false);
    expect(data!.is_active).toBe(true);
    expect(data!.currency).toBe('USD');
  });

  it('creates a credit card account as liability', async () => {
    const db = getTestClient();
    const { data, error } = await db
      .from('account')
      .insert({
        household_id: householdId,
        name: 'Amex Platinum',
        institution: 'Amex',
        account_type: 'credit',
        is_liability: true,
      })
      .select()
      .single();

    expect(error).toBeNull();
    expect(data!.is_liability).toBe(true);
  });

  it('creates a brokerage account with member assignment', async () => {
    const db = getTestClient();
    const { data, error } = await db
      .from('account')
      .insert({
        household_id: householdId,
        member_id: memberId,
        name: 'Fidelity 401k',
        institution: 'Fidelity',
        account_type: 'retirement',
        is_liability: false,
      })
      .select()
      .single();

    expect(error).toBeNull();
    expect(data!.member_id).toBe(memberId);
    expect(data!.account_type).toBe('retirement');
  });

  it('creates an account with metadata', async () => {
    const db = getTestClient();
    const { data, error } = await db
      .from('account')
      .insert({
        household_id: householdId,
        name: 'Home Mortgage',
        institution: 'Wells Fargo',
        account_type: 'mortgage',
        is_liability: true,
        meta: { interest_rate: 3.25, loan_term: 360, original_balance: 400000 },
      })
      .select()
      .single();

    expect(error).toBeNull();
    expect(data!.meta).toEqual({
      interest_rate: 3.25,
      loan_term: 360,
      original_balance: 400000,
    });
  });

  it('lists accounts for a household', async () => {
    const db = getTestClient();
    const { data, error } = await db
      .from('account')
      .select('*')
      .eq('household_id', householdId)
      .order('created_at', { ascending: true });

    expect(error).toBeNull();
    expect(data!.length).toBeGreaterThanOrEqual(4);
  });

  it('rejects account with wrong household reference', async () => {
    const db = getTestClient();
    const { error } = await db.from('account').insert({
      household_id: '00000000-0000-0000-0000-000000000000',
      name: 'Bad Account',
      account_type: 'checking',
    });

    expect(error).not.toBeNull();
  });
});
