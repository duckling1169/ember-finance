import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  createTestHousehold,
  createTestAccount,
  cleanupTestHousehold,
  getTestClient,
} from '../helpers.js';

describe('account_source (DB integration)', () => {
  let householdId: string;
  let accountId: string;

  beforeAll(async () => {
    const ctx = await createTestHousehold();
    householdId = ctx.householdId;
    const account = await createTestAccount(householdId);
    accountId = account.id;
  });

  afterAll(async () => {
    await cleanupTestHousehold(householdId);
  });

  it('creates a manual source', async () => {
    const db = getTestClient();
    const { data, error } = await db
      .from('account_source')
      .insert({
        account_id: accountId,
        household_id: householdId,
        provider: 'manual',
      })
      .select()
      .single();

    expect(error).toBeNull();
    expect(data!.provider).toBe('manual');
    expect(data!.is_active).toBe(true);
    expect(data!.last_synced).toBeNull();
  });

  it('creates a teller source with provider_account_id', async () => {
    const db = getTestClient();
    const { data, error } = await db
      .from('account_source')
      .insert({
        account_id: accountId,
        household_id: householdId,
        provider: 'teller',
        provider_account_id: 'acc_test_123',
      })
      .select()
      .single();

    expect(error).toBeNull();
    expect(data!.provider).toBe('teller');
    expect(data!.provider_account_id).toBe('acc_test_123');
  });

  it('enforces unique constraint on (account_id, provider, provider_account_id)', async () => {
    const db = getTestClient();
    const { error } = await db.from('account_source').insert({
      account_id: accountId,
      household_id: householdId,
      provider: 'teller',
      provider_account_id: 'acc_test_123',
    });

    expect(error).not.toBeNull();
    expect(error!.code).toBe('23505'); // unique_violation
  });

  it('allows same provider with different provider_account_id', async () => {
    const db = getTestClient();
    const { data, error } = await db
      .from('account_source')
      .insert({
        account_id: accountId,
        household_id: householdId,
        provider: 'teller',
        provider_account_id: 'acc_test_456',
      })
      .select()
      .single();

    expect(error).toBeNull();
    expect(data!.provider_account_id).toBe('acc_test_456');
  });

  it('allows multiple providers on one account', async () => {
    const db = getTestClient();
    const { error } = await db
      .from('account_source')
      .insert({
        account_id: accountId,
        household_id: householdId,
        provider: 'csv',
      })
      .select()
      .single();

    expect(error).toBeNull();

    // Should have manual, teller (x2), and csv
    const { data: sources } = await db
      .from('account_source')
      .select('provider')
      .eq('account_id', accountId);

    const providers = sources!.map((s: { provider: string }) => s.provider);
    expect(providers).toContain('manual');
    expect(providers).toContain('teller');
    expect(providers).toContain('csv');
  });
});
