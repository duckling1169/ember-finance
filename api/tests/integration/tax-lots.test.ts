import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  createTestHousehold,
  createTestAccount,
  createTestSource,
  cleanupTestHousehold,
  getTestClient,
} from '../helpers.js';

describe('tax_lot + lot_disposition + open_tax_lots view', () => {
  let householdId: string;
  let brokerageId: string;

  const db = () => getTestClient();

  // Symbols cleaned up in afterAll (security_price is global)
  const testSymbols = ['LOT_SYM', 'LOT_CHK', 'LOT_MULTI', 'LOT_VIEW', 'LOT_WASH', 'LOT_FIFO'];

  beforeAll(async () => {
    const ctx = await createTestHousehold();
    householdId = ctx.householdId;

    const brokerage = await createTestAccount(householdId, {
      name: 'Tax Lot Brokerage',
      institution: 'Fidelity',
      account_type: 'brokerage',
    });
    brokerageId = brokerage.id;

    await createTestSource(brokerageId, householdId, 'manual');
  });

  afterAll(async () => {
    for (const sym of testSymbols) {
      await db().from('security_price').delete().eq('symbol', sym);
    }
    await cleanupTestHousehold(householdId);
  });

  /** Helper: insert an investment_activity row directly */
  async function insertActivity(overrides: Record<string, unknown>) {
    const defaults = {
      household_id: householdId,
      account_id: brokerageId,
      currency: 'USD',
      commission: 0,
      is_hidden: false,
    };
    const { data, error } = await db()
      .from('investment_activity')
      .insert({ ...defaults, ...overrides })
      .select()
      .single();
    if (error) throw new Error(`Failed to insert activity: ${error.message}`);
    return data;
  }

  /** Helper: insert a tax_lot row directly */
  async function insertLot(overrides: Record<string, unknown>) {
    const defaults = {
      household_id: householdId,
      account_id: brokerageId,
      is_closed: false,
      wash_sale_adjustment: 0,
    };
    const { data, error } = await db()
      .from('tax_lot')
      .insert({ ...defaults, ...overrides })
      .select()
      .single();
    if (error) throw new Error(`Failed to insert tax lot: ${error.message}`);
    return data;
  }

  // ── Basic tax lot CRUD ──

  describe('tax lot creation', () => {
    it('creates a tax lot (buy creates lot with full quantity)', async () => {
      const buyActivity = await insertActivity({
        date: '2025-01-15',
        activity_type: 'buy',
        symbol: 'LOT_SYM',
        quantity: 100,
        price: 50.0,
        amount: -5000.0,
      });

      const lot = await insertLot({
        symbol: 'LOT_SYM',
        acquired_date: '2025-01-15',
        quantity: 100,
        original_quantity: 100,
        cost_basis_per_share: 50.0,
        cost_basis_total: 5000.0,
        source: 'computed_fifo',
        origin_activity_id: buyActivity.id,
      });

      expect(lot.symbol).toBe('LOT_SYM');
      expect(lot.quantity).toBe(100);
      expect(lot.original_quantity).toBe(100);
      expect(lot.cost_basis_per_share).toBe(50.0);
      expect(lot.cost_basis_total).toBe(5000.0);
      expect(lot.is_closed).toBe(false);
      expect(lot.closed_date).toBeNull();
      expect(lot.realized_gain_loss).toBeNull();
    });
  });

  describe('tax lot check constraints', () => {
    it('rejects quantity < 0', async () => {
      const { error } = await db().from('tax_lot').insert({
        household_id: householdId,
        account_id: brokerageId,
        symbol: 'LOT_CHK',
        acquired_date: '2025-01-01',
        quantity: -5,
        original_quantity: 100,
        cost_basis_per_share: 10.0,
        cost_basis_total: 1000.0,
        source: 'manual',
        wash_sale_adjustment: 0,
      });

      expect(error).toBeTruthy();
      expect(error!.message).toContain('chk_tax_lot_quantity_non_negative');
    });

    it('rejects original_quantity <= 0', async () => {
      const { error } = await db().from('tax_lot').insert({
        household_id: householdId,
        account_id: brokerageId,
        symbol: 'LOT_CHK',
        acquired_date: '2025-01-01',
        quantity: 0,
        original_quantity: 0,
        cost_basis_per_share: 10.0,
        cost_basis_total: 0,
        source: 'manual',
        wash_sale_adjustment: 0,
      });

      expect(error).toBeTruthy();
      expect(error!.message).toContain('chk_tax_lot_original_quantity_positive');
    });

    it('rejects invalid source enum value', async () => {
      const { error } = await db().from('tax_lot').insert({
        household_id: householdId,
        account_id: brokerageId,
        symbol: 'LOT_CHK',
        acquired_date: '2025-01-01',
        quantity: 10,
        original_quantity: 10,
        cost_basis_per_share: 10.0,
        cost_basis_total: 100.0,
        source: 'invalid_source',
        wash_sale_adjustment: 0,
      });

      expect(error).toBeTruthy();
      expect(error!.message).toContain('chk_tax_lot_source');
    });

    it('rejects is_closed=true without closed_date', async () => {
      const { error } = await db().from('tax_lot').insert({
        household_id: householdId,
        account_id: brokerageId,
        symbol: 'LOT_CHK',
        acquired_date: '2025-01-01',
        quantity: 0,
        original_quantity: 10,
        cost_basis_per_share: 10.0,
        cost_basis_total: 100.0,
        source: 'manual',
        is_closed: true,
        closed_date: null,
        wash_sale_adjustment: 0,
      });

      expect(error).toBeTruthy();
      expect(error!.message).toContain('chk_tax_lot_closed_consistency');
    });

    it('rejects is_closed=false with closed_date set', async () => {
      const { error } = await db().from('tax_lot').insert({
        household_id: householdId,
        account_id: brokerageId,
        symbol: 'LOT_CHK',
        acquired_date: '2025-01-01',
        quantity: 10,
        original_quantity: 10,
        cost_basis_per_share: 10.0,
        cost_basis_total: 100.0,
        source: 'manual',
        is_closed: false,
        closed_date: '2025-06-01',
        wash_sale_adjustment: 0,
      });

      expect(error).toBeTruthy();
      expect(error!.message).toContain('chk_tax_lot_closed_consistency');
    });
  });

  // ── Partial and full depletion ──

  describe('lot depletion', () => {
    let partialLotId: string;

    it('depletes a lot partially (sell 50 of 100 shares)', async () => {
      const buyActivity = await insertActivity({
        date: '2025-02-01',
        activity_type: 'buy',
        symbol: 'LOT_SYM',
        quantity: 100,
        price: 60.0,
        amount: -6000.0,
      });

      const lot = await insertLot({
        symbol: 'LOT_SYM',
        acquired_date: '2025-02-01',
        quantity: 100,
        original_quantity: 100,
        cost_basis_per_share: 60.0,
        cost_basis_total: 6000.0,
        source: 'computed_fifo',
        origin_activity_id: buyActivity.id,
      });
      partialLotId = lot.id;

      // Simulate partial sell: decrement quantity to 50
      const { data: updated, error } = await db()
        .from('tax_lot')
        .update({ quantity: 50 })
        .eq('id', partialLotId)
        .select()
        .single();

      expect(error).toBeNull();
      expect(updated!.quantity).toBe(50);
      expect(updated!.original_quantity).toBe(100);
      expect(updated!.is_closed).toBe(false);
    });

    it('closes a lot fully (sell remaining shares)', async () => {
      const { data: closed, error } = await db()
        .from('tax_lot')
        .update({
          quantity: 0,
          is_closed: true,
          closed_date: '2025-06-15',
          realized_gain_loss: 500.0,
        })
        .eq('id', partialLotId)
        .select()
        .single();

      expect(error).toBeNull();
      expect(closed!.quantity).toBe(0);
      expect(closed!.is_closed).toBe(true);
      expect(closed!.closed_date).toBe('2025-06-15');
      expect(closed!.realized_gain_loss).toBe(500.0);
    });
  });

  // ── lot_disposition ──

  describe('lot_disposition', () => {
    it('creates lot_disposition linking a sell to a lot with correct gain_loss', async () => {
      const buyActivity = await insertActivity({
        date: '2025-03-01',
        activity_type: 'buy',
        symbol: 'LOT_SYM',
        quantity: 50,
        price: 40.0,
        amount: -2000.0,
      });

      const lot = await insertLot({
        symbol: 'LOT_SYM',
        acquired_date: '2025-03-01',
        quantity: 50,
        original_quantity: 50,
        cost_basis_per_share: 40.0,
        cost_basis_total: 2000.0,
        source: 'manual',
        origin_activity_id: buyActivity.id,
      });

      const sellActivity = await insertActivity({
        date: '2025-09-01',
        activity_type: 'sell',
        symbol: 'LOT_SYM',
        quantity: 50,
        price: 55.0,
        amount: 2750.0,
      });

      // proceeds = 2750, cost_basis = 50 * 40 = 2000, gain_loss = 750
      const { data: disp, error } = await db()
        .from('lot_disposition')
        .insert({
          household_id: householdId,
          tax_lot_id: lot.id,
          sell_activity_id: sellActivity.id,
          quantity: 50,
          proceeds: 2750.0,
          cost_basis: 2000.0,
          gain_loss: 750.0,
          is_short_term: true, // < 1 year
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(disp!.gain_loss).toBe(750.0);
      expect(disp!.proceeds).toBe(2750.0);
      expect(disp!.cost_basis).toBe(2000.0);
      expect(disp!.is_short_term).toBe(true);
    });

    it('rejects duplicate (tax_lot_id, sell_activity_id) pair', async () => {
      const buyAct = await insertActivity({
        date: '2025-04-01',
        activity_type: 'buy',
        symbol: 'LOT_SYM',
        quantity: 10,
        price: 30.0,
        amount: -300.0,
      });

      const lot = await insertLot({
        symbol: 'LOT_SYM',
        acquired_date: '2025-04-01',
        quantity: 10,
        original_quantity: 10,
        cost_basis_per_share: 30.0,
        cost_basis_total: 300.0,
        source: 'manual',
        origin_activity_id: buyAct.id,
      });

      const sellAct = await insertActivity({
        date: '2025-10-01',
        activity_type: 'sell',
        symbol: 'LOT_SYM',
        quantity: 10,
        price: 35.0,
        amount: 350.0,
      });

      // First disposition succeeds
      const { error: err1 } = await db().from('lot_disposition').insert({
        household_id: householdId,
        tax_lot_id: lot.id,
        sell_activity_id: sellAct.id,
        quantity: 10,
        proceeds: 350.0,
        cost_basis: 300.0,
        gain_loss: 50.0,
        is_short_term: true,
      });

      expect(err1).toBeNull();

      // Duplicate should be rejected
      const { error: err2 } = await db().from('lot_disposition').insert({
        household_id: householdId,
        tax_lot_id: lot.id,
        sell_activity_id: sellAct.id,
        quantity: 10,
        proceeds: 350.0,
        cost_basis: 300.0,
        gain_loss: 50.0,
        is_short_term: true,
      });

      expect(err2).toBeTruthy();
      expect(err2!.message).toContain('duplicate');
    });

    it('a sell consuming multiple lots produces multiple disposition rows', async () => {
      // 3 lots for LOT_MULTI
      const buy1 = await insertActivity({
        date: '2025-01-10',
        activity_type: 'buy',
        symbol: 'LOT_MULTI',
        quantity: 20,
        price: 10.0,
        amount: -200.0,
      });
      const buy2 = await insertActivity({
        date: '2025-02-10',
        activity_type: 'buy',
        symbol: 'LOT_MULTI',
        quantity: 30,
        price: 12.0,
        amount: -360.0,
      });
      const buy3 = await insertActivity({
        date: '2025-03-10',
        activity_type: 'buy',
        symbol: 'LOT_MULTI',
        quantity: 25,
        price: 15.0,
        amount: -375.0,
      });

      const lot1 = await insertLot({
        symbol: 'LOT_MULTI',
        acquired_date: '2025-01-10',
        quantity: 20,
        original_quantity: 20,
        cost_basis_per_share: 10.0,
        cost_basis_total: 200.0,
        source: 'computed_fifo',
        origin_activity_id: buy1.id,
      });
      const lot2 = await insertLot({
        symbol: 'LOT_MULTI',
        acquired_date: '2025-02-10',
        quantity: 30,
        original_quantity: 30,
        cost_basis_per_share: 12.0,
        cost_basis_total: 360.0,
        source: 'computed_fifo',
        origin_activity_id: buy2.id,
      });
      const lot3 = await insertLot({
        symbol: 'LOT_MULTI',
        acquired_date: '2025-03-10',
        quantity: 25,
        original_quantity: 25,
        cost_basis_per_share: 15.0,
        cost_basis_total: 375.0,
        source: 'computed_fifo',
        origin_activity_id: buy3.id,
      });

      // Sell 40 shares at $18 — spans lot1 (20) + lot2 (20 of 30)
      const sellAct = await insertActivity({
        date: '2025-06-15',
        activity_type: 'sell',
        symbol: 'LOT_MULTI',
        quantity: 40,
        price: 18.0,
        amount: 720.0,
      });

      // Disposition 1: fully consumes lot1 (20 shares)
      // proceeds = 20 * 18 = 360, cost_basis = 20 * 10 = 200, gain_loss = 160
      await db().from('lot_disposition').insert({
        household_id: householdId,
        tax_lot_id: lot1.id,
        sell_activity_id: sellAct.id,
        quantity: 20,
        proceeds: 360.0,
        cost_basis: 200.0,
        gain_loss: 160.0,
        is_short_term: true,
      });

      // Disposition 2: partially consumes lot2 (20 of 30 shares)
      // proceeds = 20 * 18 = 360, cost_basis = 20 * 12 = 240, gain_loss = 120
      await db().from('lot_disposition').insert({
        household_id: householdId,
        tax_lot_id: lot2.id,
        sell_activity_id: sellAct.id,
        quantity: 20,
        proceeds: 360.0,
        cost_basis: 240.0,
        gain_loss: 120.0,
        is_short_term: true,
      });

      // Update lot quantities
      await db()
        .from('tax_lot')
        .update({
          quantity: 0,
          is_closed: true,
          closed_date: '2025-06-15',
          realized_gain_loss: 160.0,
        })
        .eq('id', lot1.id);

      await db().from('tax_lot').update({ quantity: 10 }).eq('id', lot2.id);

      // Verify two disposition rows for this sell
      const { data: disps } = await db()
        .from('lot_disposition')
        .select('*')
        .eq('sell_activity_id', sellAct.id)
        .order('cost_basis', { ascending: true });

      expect(disps).toHaveLength(2);
      expect(disps![0].quantity).toBe(20);
      expect(disps![0].gain_loss).toBe(160.0);
      expect(disps![1].quantity).toBe(20);
      expect(disps![1].gain_loss).toBe(120.0);

      // lot3 should be untouched
      const { data: lot3Data } = await db().from('tax_lot').select('*').eq('id', lot3.id).single();

      expect(lot3Data!.quantity).toBe(25);
      expect(lot3Data!.is_closed).toBe(false);
    });
  });

  // ── open_tax_lots view ──

  describe('open_tax_lots view', () => {
    // A date ~90 days ago, so the lot is always short-term regardless of when tests run
    const recentDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    it('shows only unclosed lots with live prices and holding_period', async () => {
      // Insert security price for LOT_VIEW
      await db().from('security_price').upsert({
        symbol: 'LOT_VIEW',
        price: 100.0,
        currency: 'USD',
        source: 'manual',
      });

      const buyAct = await insertActivity({
        date: recentDate,
        activity_type: 'buy',
        symbol: 'LOT_VIEW',
        quantity: 40,
        price: 80.0,
        amount: -3200.0,
      });

      const openLot = await insertLot({
        symbol: 'LOT_VIEW',
        acquired_date: recentDate,
        quantity: 40,
        original_quantity: 40,
        cost_basis_per_share: 80.0,
        cost_basis_total: 3200.0,
        source: 'manual',
        origin_activity_id: buyAct.id,
      });

      const buyAct2 = await insertActivity({
        date: '2025-05-15',
        activity_type: 'buy',
        symbol: 'LOT_VIEW',
        quantity: 20,
        price: 85.0,
        amount: -1700.0,
      });

      await insertLot({
        symbol: 'LOT_VIEW',
        acquired_date: '2025-05-15',
        quantity: 0,
        original_quantity: 20,
        cost_basis_per_share: 85.0,
        cost_basis_total: 1700.0,
        source: 'manual',
        origin_activity_id: buyAct2.id,
        is_closed: true,
        closed_date: '2025-08-01',
        realized_gain_loss: 300.0,
      });

      const { data: openLots, error } = await db()
        .from('open_tax_lots')
        .select('*')
        .eq('account_id', brokerageId)
        .eq('symbol', 'LOT_VIEW');

      expect(error).toBeNull();
      // Only the open lot should appear, not the closed one
      expect(openLots).toHaveLength(1);
      expect(openLots![0].id).toBe(openLot.id);
      expect(openLots![0].live_price).toBe(100.0);
      // live_market_value = 40 * 100 = 4000
      expect(Number(openLots![0].live_market_value)).toBeCloseTo(4000.0, 2);
      // unrealized_gain_loss = (40 * 100) - (40 * 80) = 800
      expect(Number(openLots![0].unrealized_gain_loss)).toBeCloseTo(800.0, 2);
    });

    it('holding_period is short_term for lots < 365 days old', async () => {
      // The open LOT_VIEW lot was acquired ~90 days ago → short_term
      const { data } = await db()
        .from('open_tax_lots')
        .select('holding_period, acquired_date')
        .eq('account_id', brokerageId)
        .eq('symbol', 'LOT_VIEW');

      expect(data).toHaveLength(1);
      expect(data![0].holding_period).toBe('short_term');
    });

    it('holding_period is long_term for lots >= 365 days old', async () => {
      const buyAct = await insertActivity({
        date: '2024-01-01',
        activity_type: 'buy',
        symbol: 'LOT_VIEW',
        quantity: 10,
        price: 50.0,
        amount: -500.0,
      });

      await insertLot({
        symbol: 'LOT_VIEW',
        acquired_date: '2024-01-01',
        quantity: 10,
        original_quantity: 10,
        cost_basis_per_share: 50.0,
        cost_basis_total: 500.0,
        source: 'manual',
        origin_activity_id: buyAct.id,
      });

      const { data } = await db()
        .from('open_tax_lots')
        .select('holding_period, acquired_date')
        .eq('account_id', brokerageId)
        .eq('symbol', 'LOT_VIEW')
        .eq('acquired_date', '2024-01-01')
        .single();

      // 2024-01-01 to 2026-03-09 = 799 days >= 365 → long_term
      expect(data!.holding_period).toBe('long_term');
    });
  });

  // ── Short-term vs long-term on lot_disposition ──

  describe('short-term vs long-term classification on lot_disposition', () => {
    it('is_short_term=true when sell is within 1 year of acquisition', async () => {
      const buyAct = await insertActivity({
        date: '2025-06-01',
        activity_type: 'buy',
        symbol: 'LOT_SYM',
        quantity: 10,
        price: 20.0,
        amount: -200.0,
      });

      const lot = await insertLot({
        symbol: 'LOT_SYM',
        acquired_date: '2025-06-01',
        quantity: 10,
        original_quantity: 10,
        cost_basis_per_share: 20.0,
        cost_basis_total: 200.0,
        source: 'manual',
        origin_activity_id: buyAct.id,
      });

      const sellAct = await insertActivity({
        date: '2025-11-15', // 167 days, < 365
        activity_type: 'sell',
        symbol: 'LOT_SYM',
        quantity: 10,
        price: 25.0,
        amount: 250.0,
      });

      const { data: disp, error } = await db()
        .from('lot_disposition')
        .insert({
          household_id: householdId,
          tax_lot_id: lot.id,
          sell_activity_id: sellAct.id,
          quantity: 10,
          proceeds: 250.0,
          cost_basis: 200.0,
          gain_loss: 50.0,
          is_short_term: true,
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(disp!.is_short_term).toBe(true);
    });

    it('is_short_term=false when sell is >= 1 year after acquisition', async () => {
      const buyAct = await insertActivity({
        date: '2024-01-15',
        activity_type: 'buy',
        symbol: 'LOT_SYM',
        quantity: 10,
        price: 20.0,
        amount: -200.0,
      });

      const lot = await insertLot({
        symbol: 'LOT_SYM',
        acquired_date: '2024-01-15',
        quantity: 10,
        original_quantity: 10,
        cost_basis_per_share: 20.0,
        cost_basis_total: 200.0,
        source: 'manual',
        origin_activity_id: buyAct.id,
      });

      const sellAct = await insertActivity({
        date: '2025-06-01', // > 1 year
        activity_type: 'sell',
        symbol: 'LOT_SYM',
        quantity: 10,
        price: 30.0,
        amount: 300.0,
      });

      const { data: disp, error } = await db()
        .from('lot_disposition')
        .insert({
          household_id: householdId,
          tax_lot_id: lot.id,
          sell_activity_id: sellAct.id,
          quantity: 10,
          proceeds: 300.0,
          cost_basis: 200.0,
          gain_loss: 100.0,
          is_short_term: false,
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(disp!.is_short_term).toBe(false);
    });
  });

  // ── Wash sale adjustment ──

  describe('wash sale adjustment', () => {
    it('creates a lot with wash_sale_adjustment without breaking constraints', async () => {
      const buyAct = await insertActivity({
        date: '2025-07-01',
        activity_type: 'buy',
        symbol: 'LOT_WASH',
        quantity: 50,
        price: 100.0,
        amount: -5000.0,
      });

      const lot = await insertLot({
        symbol: 'LOT_WASH',
        acquired_date: '2025-07-01',
        quantity: 50,
        original_quantity: 50,
        cost_basis_per_share: 100.0,
        cost_basis_total: 5000.0,
        source: 'manual',
        origin_activity_id: buyAct.id,
        wash_sale_adjustment: 250.0,
      });

      expect(lot.wash_sale_adjustment).toBe(250.0);
      expect(lot.quantity).toBe(50);
      expect(lot.is_closed).toBe(false);

      // Verify we can read it back
      const { data } = await db().from('tax_lot').select('*').eq('id', lot.id).single();

      expect(data!.wash_sale_adjustment).toBe(250.0);
    });
  });

  // ── Full FIFO lifecycle ──

  describe('full lifecycle: buy 100, buy 50, sell 120 (FIFO)', () => {
    let lot1Id: string;
    let lot2Id: string;
    let sellActId: string;

    it('creates two buy lots', async () => {
      const buy1 = await insertActivity({
        date: '2025-01-01',
        activity_type: 'buy',
        symbol: 'LOT_FIFO',
        quantity: 100,
        price: 10.0,
        amount: -1000.0,
      });

      const lot1 = await insertLot({
        symbol: 'LOT_FIFO',
        acquired_date: '2025-01-01',
        quantity: 100,
        original_quantity: 100,
        cost_basis_per_share: 10.0,
        cost_basis_total: 1000.0,
        source: 'computed_fifo',
        origin_activity_id: buy1.id,
      });
      lot1Id = lot1.id;

      const buy2 = await insertActivity({
        date: '2025-03-01',
        activity_type: 'buy',
        symbol: 'LOT_FIFO',
        quantity: 50,
        price: 15.0,
        amount: -750.0,
      });

      const lot2 = await insertLot({
        symbol: 'LOT_FIFO',
        acquired_date: '2025-03-01',
        quantity: 50,
        original_quantity: 50,
        cost_basis_per_share: 15.0,
        cost_basis_total: 750.0,
        source: 'computed_fifo',
        origin_activity_id: buy2.id,
      });
      lot2Id = lot2.id;

      expect(lot1.quantity).toBe(100);
      expect(lot2.quantity).toBe(50);
    });

    it('sells 120 shares (FIFO: depletes first lot fully + 20 from second lot)', async () => {
      const sellAct = await insertActivity({
        date: '2025-08-15',
        activity_type: 'sell',
        symbol: 'LOT_FIFO',
        quantity: 120,
        price: 20.0,
        amount: 2400.0,
      });
      sellActId = sellAct.id;

      // FIFO: consume lot1 fully (100 shares), then lot2 partially (20 shares)

      // Disposition 1: lot1, all 100 shares
      // proceeds = 100 * 20 = 2000, cost_basis = 100 * 10 = 1000, gain = 1000
      await db().from('lot_disposition').insert({
        household_id: householdId,
        tax_lot_id: lot1Id,
        sell_activity_id: sellActId,
        quantity: 100,
        proceeds: 2000.0,
        cost_basis: 1000.0,
        gain_loss: 1000.0,
        is_short_term: true,
      });

      // Disposition 2: lot2, 20 of 50 shares
      // proceeds = 20 * 20 = 400, cost_basis = 20 * 15 = 300, gain = 100
      await db().from('lot_disposition').insert({
        household_id: householdId,
        tax_lot_id: lot2Id,
        sell_activity_id: sellActId,
        quantity: 20,
        proceeds: 400.0,
        cost_basis: 300.0,
        gain_loss: 100.0,
        is_short_term: true,
      });

      // Update lot1: fully closed
      await db()
        .from('tax_lot')
        .update({
          quantity: 0,
          is_closed: true,
          closed_date: '2025-08-15',
          realized_gain_loss: 1000.0,
        })
        .eq('id', lot1Id);

      // Update lot2: partially depleted (50 - 20 = 30 remaining)
      await db()
        .from('tax_lot')
        .update({
          quantity: 30,
        })
        .eq('id', lot2Id);
    });

    it('verifies lot states after FIFO sell', async () => {
      const { data: lot1 } = await db().from('tax_lot').select('*').eq('id', lot1Id).single();

      expect(lot1!.quantity).toBe(0);
      expect(lot1!.is_closed).toBe(true);
      expect(lot1!.closed_date).toBe('2025-08-15');
      expect(lot1!.realized_gain_loss).toBe(1000.0);

      const { data: lot2 } = await db().from('tax_lot').select('*').eq('id', lot2Id).single();

      expect(lot2!.quantity).toBe(30);
      expect(lot2!.is_closed).toBe(false);
      expect(lot2!.closed_date).toBeNull();
    });

    it('verifies disposition rows for the FIFO sell', async () => {
      const { data: disps } = await db()
        .from('lot_disposition')
        .select('*')
        .eq('sell_activity_id', sellActId)
        .order('cost_basis', { ascending: true });

      expect(disps).toHaveLength(2);

      // Disposition from lot2 (lower cost_basis = 300)
      expect(disps![0].quantity).toBe(20);
      expect(disps![0].cost_basis).toBe(300.0);
      expect(disps![0].proceeds).toBe(400.0);
      expect(disps![0].gain_loss).toBe(100.0);

      // Disposition from lot1 (higher cost_basis = 1000)
      expect(disps![1].quantity).toBe(100);
      expect(disps![1].cost_basis).toBe(1000.0);
      expect(disps![1].proceeds).toBe(2000.0);
      expect(disps![1].gain_loss).toBe(1000.0);

      // Total gain = 1000 + 100 = 1100
      const totalGain = disps!.reduce((sum: number, d: any) => sum + d.gain_loss, 0);
      expect(totalGain).toBe(1100.0);

      // Total proceeds = 2000 + 400 = 2400 (matches sell amount)
      const totalProceeds = disps!.reduce((sum: number, d: any) => sum + d.proceeds, 0);
      expect(totalProceeds).toBe(2400.0);

      // Total quantity = 100 + 20 = 120 (matches sell quantity)
      const totalQty = disps!.reduce((sum: number, d: any) => sum + Number(d.quantity), 0);
      expect(totalQty).toBe(120);
    });

    it('verifies open_tax_lots shows only lot2 (lot1 is closed)', async () => {
      const { data: openLots } = await db()
        .from('open_tax_lots')
        .select('*')
        .eq('account_id', brokerageId)
        .eq('symbol', 'LOT_FIFO');

      expect(openLots).toHaveLength(1);
      expect(openLots![0].id).toBe(lot2Id);
      expect(openLots![0].quantity).toBe(30);
    });
  });
});
