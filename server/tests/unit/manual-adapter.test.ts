import { describe, it, expect } from 'vitest';
import { ManualAdapter } from '../../src/adapters/manual.js';
import type { Account, AccountSource } from '../../src/types/index.js';

const mockAccount: Account = {
  id: 'acc-1',
  household_id: 'hh-1',
  member_id: null,
  name: 'Test Account',
  institution: null,
  account_type: 'checking',
  currency: 'USD',
  meta: {},
  is_active: true,
  is_liability: false,
  created_at: '2025-01-01T00:00:00Z',
};

const mockSource: AccountSource = {
  id: 'src-1',
  account_id: 'acc-1',
  household_id: 'hh-1',
  provider: 'manual',
  provider_account_id: null,
  provider_meta: null,
  is_active: true,
  last_synced: null,
  created_at: '2025-01-01T00:00:00Z',
};

describe('ManualAdapter', () => {
  it('returns empty result when no data provided', async () => {
    const adapter = new ManualAdapter({});
    const result = await adapter.sync(mockAccount, mockSource);

    expect(result.transactions).toEqual([]);
    expect(result.investmentActivity).toEqual([]);
    expect(result.balances).toEqual([]);
    expect(result.holdings).toEqual([]);
  });

  it('passes through transactions', async () => {
    const adapter = new ManualAdapter({
      transactions: [
        { date: '2025-01-15', amount: -42.5, description: 'Groceries', category: 'food' },
        { date: '2025-01-16', amount: 3000, description: 'Paycheck', isTransfer: false },
      ],
    });

    const result = await adapter.sync(mockAccount, mockSource);

    expect(result.transactions).toHaveLength(2);
    expect(result.transactions[0].amount).toBe(-42.5);
    expect(result.transactions[0].category).toBe('food');
    expect(result.transactions[1].amount).toBe(3000);
    expect(result.investmentActivity).toEqual([]);
    expect(result.balances).toEqual([]);
    expect(result.holdings).toEqual([]);
  });

  it('passes through investment activity', async () => {
    const adapter = new ManualAdapter({
      investmentActivity: [
        {
          date: '2025-01-15',
          activityType: 'buy',
          symbol: 'VTI',
          quantity: 10,
          price: 250.0,
          amount: -2500.0,
        },
        {
          date: '2025-01-20',
          activityType: 'dividend',
          symbol: 'VTI',
          amount: 15.5,
        },
      ],
    });

    const result = await adapter.sync(mockAccount, mockSource);

    expect(result.investmentActivity).toHaveLength(2);
    expect(result.investmentActivity[0].activityType).toBe('buy');
    expect(result.investmentActivity[0].quantity).toBe(10);
    expect(result.investmentActivity[1].activityType).toBe('dividend');
    expect(result.transactions).toEqual([]);
  });

  it('passes through balances', async () => {
    const adapter = new ManualAdapter({
      balances: [{ date: '2025-01-15', balance: 5432.1, available: 5432.1 }],
    });

    const result = await adapter.sync(mockAccount, mockSource);

    expect(result.balances).toHaveLength(1);
    expect(result.balances[0].balance).toBe(5432.1);
    expect(result.balances[0].available).toBe(5432.1);
  });

  it('passes through holdings', async () => {
    const adapter = new ManualAdapter({
      holdings: [
        {
          asOf: '2025-01-15',
          symbol: 'VTI',
          name: 'Vanguard Total Stock Market ETF',
          quantity: 100,
          price: 250.0,
          marketValue: 25000.0,
          costBasis: 22000.0,
          assetClass: 'equity',
        },
      ],
    });

    const result = await adapter.sync(mockAccount, mockSource);

    expect(result.holdings).toHaveLength(1);
    expect(result.holdings[0].symbol).toBe('VTI');
    expect(result.holdings[0].marketValue).toBe(25000.0);
    expect(result.holdings[0].assetClass).toBe('equity');
  });

  it('passes through mixed data types together', async () => {
    const adapter = new ManualAdapter({
      transactions: [{ date: '2025-01-15', amount: -100, description: 'Test' }],
      balances: [{ date: '2025-01-15', balance: 900 }],
      holdings: [{ asOf: '2025-01-15', symbol: 'VTI', quantity: 10, marketValue: 2500 }],
      investmentActivity: [
        { date: '2025-01-15', activityType: 'buy', symbol: 'VTI', amount: -2500 },
      ],
    });

    const result = await adapter.sync(mockAccount, mockSource);

    expect(result.transactions).toHaveLength(1);
    expect(result.balances).toHaveLength(1);
    expect(result.holdings).toHaveLength(1);
    expect(result.investmentActivity).toHaveLength(1);
  });
});
