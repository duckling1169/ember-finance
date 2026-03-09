import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  createTestHousehold,
  createTestAccount,
  createTestSource,
  cleanupTestHousehold,
  getTestClient,
} from '../helpers.js';

describe('security_price + current_positions + household_positions_summary + compute_net_worth_snapshot', () => {
  let householdId: string;
  let brokerageId: string;
  let retirementId: string;
  let checkingId: string;
  let creditCardId: string;
  let brokerageSourceId: string;
  let retirementSourceId: string;

  const db = () => getTestClient();

  // Symbols used across tests — cleaned up in afterAll
  const testSymbols = ['TEST_A', 'TEST_B', 'TEST_C', 'TEST_NP'];

  beforeAll(async () => {
    const ctx = await createTestHousehold();
    householdId = ctx.householdId;

    const brokerage = await createTestAccount(householdId, {
      name: 'SP Test Brokerage',
      institution: 'Fidelity',
      account_type: 'brokerage',
    });
    brokerageId = brokerage.id;

    const retirement = await createTestAccount(householdId, {
      name: 'SP Test 401k',
      institution: 'Vanguard',
      account_type: 'retirement',
    });
    retirementId = retirement.id;

    const checking = await createTestAccount(householdId, {
      name: 'SP Test Checking',
      institution: 'Chase',
      account_type: 'checking',
    });
    checkingId = checking.id;

    const creditCard = await createTestAccount(householdId, {
      name: 'SP Test Credit Card',
      institution: 'Amex',
      account_type: 'credit',
      is_liability: true,
    });
    creditCardId = creditCard.id;

    const bs = await createTestSource(brokerageId, householdId, 'manual');
    brokerageSourceId = bs.id;
    const rs = await createTestSource(retirementId, householdId, 'manual');
    retirementSourceId = rs.id;
    await createTestSource(checkingId, householdId, 'manual');
    await createTestSource(creditCardId, householdId, 'manual');
  });

  afterAll(async () => {
    // Clean up security_price rows we created (global table, no household_id)
    for (const sym of testSymbols) {
      await db().from('security_price').delete().eq('symbol', sym);
    }
    await cleanupTestHousehold(householdId);
  });

  // ── security_price CRUD ──

  describe('security_price table', () => {
    it('inserts a security price and reads it back', async () => {
      const { data, error } = await db()
        .from('security_price')
        .upsert({
          symbol: 'TEST_A',
          name: 'Test Security A',
          price: 150.25,
          prev_close: 148.0,
          day_change_pct: 1.52,
          currency: 'USD',
          source: 'manual',
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(data!.symbol).toBe('TEST_A');
      expect(data!.price).toBe(150.25);
      expect(data!.prev_close).toBe(148.0);
      expect(data!.day_change_pct).toBe(1.52);
      expect(data!.source).toBe('manual');
    });

    it('upserts (updates price for existing symbol)', async () => {
      // First insert
      await db().from('security_price').upsert({
        symbol: 'TEST_B',
        price: 100.0,
        currency: 'USD',
        source: 'yahoo',
      });

      // Upsert with new price
      const { data, error } = await db()
        .from('security_price')
        .upsert({
          symbol: 'TEST_B',
          price: 105.5,
          prev_close: 100.0,
          day_change_pct: 5.5,
          currency: 'USD',
          source: 'yahoo',
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(data!.price).toBe(105.5);
      expect(data!.prev_close).toBe(100.0);

      // Only one row for the symbol
      const { data: all } = await db().from('security_price').select('*').eq('symbol', 'TEST_B');

      expect(all).toHaveLength(1);
    });
  });

  // ── current_positions view ──

  describe('current_positions view', () => {
    it('returns live_market_value, unrealized_gain_loss, and unrealized_gain_loss_pct', async () => {
      // Insert a holding for brokerage
      await db().from('holding').insert({
        household_id: householdId,
        account_id: brokerageId,
        as_of: '2025-06-01',
        symbol: 'TEST_A',
        name: 'Test Security A',
        quantity: 100,
        price: 140.0,
        market_value: 14000.0,
        cost_basis: 12000.0,
        currency: 'USD',
        asset_class: 'equity',
      });

      // TEST_A was inserted at 150.25 in the security_price table above

      const { data, error } = await db()
        .from('current_positions')
        .select('*')
        .eq('household_id', householdId)
        .eq('account_id', brokerageId)
        .eq('symbol', 'TEST_A')
        .single();

      expect(error).toBeNull();
      expect(data!.live_price).toBe(150.25);
      expect(data!.effective_price).toBe(150.25);
      // live_market_value = 100 * 150.25 = 15025
      expect(Number(data!.live_market_value)).toBeCloseTo(15025.0, 2);
      // unrealized_gain_loss = 15025 - 12000 = 3025
      expect(Number(data!.unrealized_gain_loss)).toBeCloseTo(3025.0, 2);
      // unrealized_gain_loss_pct = 3025 / 12000 * 100 = 25.2083...
      expect(Number(data!.unrealized_gain_loss_pct)).toBeCloseTo(25.2083, 1);
    });

    it('falls back to snapshot price when no security_price exists', async () => {
      // Insert holding for a symbol with NO security_price row
      await db().from('holding').insert({
        household_id: householdId,
        account_id: brokerageId,
        as_of: '2025-06-01',
        symbol: 'TEST_NP',
        name: 'No Price Security',
        quantity: 50,
        price: 80.0,
        market_value: 4000.0,
        cost_basis: 3500.0,
        currency: 'USD',
        asset_class: 'equity',
      });

      const { data, error } = await db()
        .from('current_positions')
        .select('*')
        .eq('household_id', householdId)
        .eq('symbol', 'TEST_NP')
        .single();

      expect(error).toBeNull();
      expect(data!.live_price).toBeNull();
      // effective_price should fall back to snapshot price
      expect(Number(data!.effective_price)).toBe(80.0);
      // live_market_value = 50 * 80 = 4000
      expect(Number(data!.live_market_value)).toBeCloseTo(4000.0, 2);
      // unrealized_gain_loss = 4000 - 3500 = 500
      expect(Number(data!.unrealized_gain_loss)).toBeCloseTo(500.0, 2);
    });

    it('picks latest holding snapshot per (account, symbol) when multiple exist', async () => {
      // Insert an older holding for TEST_A (already has 2025-06-01 from above)
      await db().from('holding').insert({
        household_id: householdId,
        account_id: brokerageId,
        as_of: '2025-05-01',
        symbol: 'TEST_A',
        name: 'Test Security A',
        quantity: 80,
        price: 130.0,
        market_value: 10400.0,
        cost_basis: 10000.0,
        currency: 'USD',
        asset_class: 'equity',
      });

      // Also insert a newer holding
      await db().from('holding').insert({
        household_id: householdId,
        account_id: brokerageId,
        as_of: '2025-07-01',
        symbol: 'TEST_A',
        name: 'Test Security A',
        quantity: 120,
        price: 155.0,
        market_value: 18600.0,
        cost_basis: 15000.0,
        currency: 'USD',
        asset_class: 'equity',
      });

      const { data, error } = await db()
        .from('current_positions')
        .select('*')
        .eq('household_id', householdId)
        .eq('account_id', brokerageId)
        .eq('symbol', 'TEST_A')
        .single();

      expect(error).toBeNull();
      // Should pick the latest snapshot (2025-07-01) with quantity 120
      expect(data!.quantity).toBe(120);
      expect(data!.as_of).toBe('2025-07-01');
      expect(data!.cost_basis).toBe(15000.0);
    });
  });

  // ── household_positions_summary view ──

  describe('household_positions_summary view', () => {
    it('aggregates same symbol across multiple accounts', async () => {
      // Insert TEST_C security price
      await db().from('security_price').upsert({
        symbol: 'TEST_C',
        name: 'Test Security C',
        price: 200.0,
        currency: 'USD',
        source: 'manual',
      });

      // Holding in brokerage
      await db().from('holding').insert({
        household_id: householdId,
        account_id: brokerageId,
        as_of: '2025-08-01',
        symbol: 'TEST_C',
        name: 'Test Security C',
        quantity: 50,
        price: 190.0,
        market_value: 9500.0,
        cost_basis: 8000.0,
        currency: 'USD',
        asset_class: 'equity',
      });

      // Same symbol in retirement
      await db().from('holding').insert({
        household_id: householdId,
        account_id: retirementId,
        as_of: '2025-08-01',
        symbol: 'TEST_C',
        name: 'Test Security C',
        quantity: 30,
        price: 190.0,
        market_value: 5700.0,
        cost_basis: 5000.0,
        currency: 'USD',
        asset_class: 'equity',
      });

      const { data, error } = await db()
        .from('household_positions_summary')
        .select('*')
        .eq('household_id', householdId)
        .eq('symbol', 'TEST_C')
        .single();

      expect(error).toBeNull();
      // total_quantity = 50 + 30 = 80
      expect(Number(data!.total_quantity)).toBe(80);
      expect(data!.live_price).toBe(200.0);
      // total_market_value = 80 * 200 = 16000
      expect(Number(data!.total_market_value)).toBeCloseTo(16000.0, 2);
      // total_cost_basis = 8000 + 5000 = 13000
      expect(Number(data!.total_cost_basis)).toBeCloseTo(13000.0, 2);
      // total_unrealized_gain_loss = 16000 - 13000 = 3000
      expect(Number(data!.total_unrealized_gain_loss)).toBeCloseTo(3000.0, 2);
      // 2 accounts
      expect(Number(data!.account_count)).toBe(2);
    });
  });

  // ── compute_net_worth_snapshot ──

  describe('compute_net_worth_snapshot()', () => {
    it('computes correct breakdown for cash + investments + debt', async () => {
      // Insert balance for checking (cash)
      await db().from('balance_snapshot').insert({
        household_id: householdId,
        account_id: checkingId,
        date: '2025-08-01',
        balance: 25000.0,
        source: 'manual',
      });

      // Insert balance for credit card (debt)
      await db().from('balance_snapshot').insert({
        household_id: householdId,
        account_id: creditCardId,
        date: '2025-08-01',
        balance: -3500.0,
        source: 'manual',
      });

      // We already have holdings for brokerage and retirement from previous tests
      // Brokerage: TEST_A (120 @ live 150.25), TEST_NP (50 @ snapshot 80), TEST_C (50 @ live 200)
      // Retirement: TEST_C (30 @ live 200)

      const { data: snapshotId, error } = await db().rpc('compute_net_worth_snapshot', {
        p_household_id: householdId,
        p_date: '2025-08-01',
      });

      expect(error).toBeNull();
      expect(snapshotId).toBeTruthy();

      const { data: snapshot } = await db()
        .from('net_worth_snapshot')
        .select('*')
        .eq('id', snapshotId)
        .single();

      expect(snapshot).toBeTruthy();
      const breakdown = snapshot!.breakdown as Record<string, number>;

      // cash = 25000
      expect(breakdown.cash).toBe(25000);

      // investments = TEST_A(120 * 150.25) + TEST_NP(50 * 80) + TEST_C_brokerage(50 * 200) + TEST_C_retirement(30 * 200)
      // = 18030 + 4000 + 10000 + 6000 = 38030
      expect(breakdown.investments).toBeCloseTo(38030, 0);

      // debt = abs(-3500) = 3500
      expect(breakdown.debt).toBe(3500);

      // illiquid = 0 (no property/vehicle accounts with balances)
      expect(breakdown.illiquid).toBe(0);

      // total_assets = cash + investments + illiquid = 25000 + 38030 + 0 = 63030
      expect(Number(snapshot!.total_assets)).toBeCloseTo(63030, 0);
      // total_liabilities = debt = 3500
      expect(Number(snapshot!.total_liabilities)).toBe(3500);
      // net_worth = 63030 - 3500 = 59530
      expect(Number(snapshot!.net_worth)).toBeCloseTo(59530, 0);
    });

    it('uses live price from security_price, not snapshot price', async () => {
      // Update TEST_A security price to a new value
      await db().from('security_price').upsert({
        symbol: 'TEST_A',
        name: 'Test Security A',
        price: 200.0,
        currency: 'USD',
        source: 'manual',
      });

      const { data: snapshotId, error } = await db().rpc('compute_net_worth_snapshot', {
        p_household_id: householdId,
        p_date: '2025-08-02',
      });

      expect(error).toBeNull();

      const { data: snapshot } = await db()
        .from('net_worth_snapshot')
        .select('*')
        .eq('id', snapshotId)
        .single();

      const breakdown = snapshot!.breakdown as Record<string, number>;

      // With TEST_A now at 200.0:
      // investments = TEST_A(120 * 200) + TEST_NP(50 * 80) + TEST_C_brokerage(50 * 200) + TEST_C_retirement(30 * 200)
      // = 24000 + 4000 + 10000 + 6000 = 44000
      expect(breakdown.investments).toBeCloseTo(44000, 0);

      // Verify it's different from what snapshot price alone would produce
      // Snapshot price for TEST_A was 155.0, which would give 120 * 155 = 18600, total ~38600
      // So 44000 proves the live price (200.0) was used
      expect(breakdown.investments).not.toBeCloseTo(38600, -1);
    });

    it('falls back to snapshot price when no security_price row exists', async () => {
      // TEST_NP has no security_price row — should use holding snapshot price 80.0
      // We can verify this by computing net worth and checking the investments component

      // Delete TEST_A and TEST_C security prices temporarily to isolate TEST_NP
      // Create a fresh household to isolate this test
      const freshCtx = await createTestHousehold();
      const freshHouseholdId = freshCtx.householdId;

      const freshBrokerage = await createTestAccount(freshHouseholdId, {
        name: 'Isolated Brokerage',
        account_type: 'brokerage',
      });

      // Insert a holding with NO corresponding security_price
      await db().from('holding').insert({
        household_id: freshHouseholdId,
        account_id: freshBrokerage.id,
        as_of: '2025-08-01',
        symbol: 'NOSECPRICE',
        name: 'No Sec Price',
        quantity: 10,
        price: 50.0,
        market_value: 500.0,
        cost_basis: 400.0,
        currency: 'USD',
        asset_class: 'equity',
      });

      const { data: snapshotId, error } = await db().rpc('compute_net_worth_snapshot', {
        p_household_id: freshHouseholdId,
        p_date: '2025-08-01',
      });

      expect(error).toBeNull();

      const { data: snapshot } = await db()
        .from('net_worth_snapshot')
        .select('*')
        .eq('id', snapshotId)
        .single();

      const breakdown = snapshot!.breakdown as Record<string, number>;

      // investments = 10 * coalesce(null, 50) = 500 (falls back to snapshot price)
      expect(breakdown.investments).toBe(500);
      expect(Number(snapshot!.total_assets)).toBe(500);
      expect(Number(snapshot!.net_worth)).toBe(500);

      // Clean up fresh household
      await db().from('net_worth_snapshot').delete().eq('household_id', freshHouseholdId);
      await db().from('holding').delete().eq('household_id', freshHouseholdId);
      await db().from('account').delete().eq('household_id', freshHouseholdId);
      await db().from('member').delete().eq('household_id', freshHouseholdId);
      await db().from('household').delete().eq('id', freshHouseholdId);
    });
  });
});
