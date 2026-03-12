import { describe, it, expect } from 'vitest';
import {
  ACCOUNT_TYPES,
  INVESTMENT_ACCOUNT_TYPES,
  BANKING_ACCOUNT_TYPES,
  LIABILITY_TYPES,
  NET_WORTH_GROUPS,
  ASSET_CATEGORIES,
} from '../../src/types/index.js';

describe('type constants', () => {
  it('ACCOUNT_TYPES has all 9 types', () => {
    expect(ACCOUNT_TYPES).toHaveLength(9);
    expect(ACCOUNT_TYPES).toContain('checking');
    expect(ACCOUNT_TYPES).toContain('savings');
    expect(ACCOUNT_TYPES).toContain('credit');
    expect(ACCOUNT_TYPES).toContain('brokerage');
    expect(ACCOUNT_TYPES).toContain('retirement');
    expect(ACCOUNT_TYPES).toContain('hsa');
    expect(ACCOUNT_TYPES).toContain('loan');
    expect(ACCOUNT_TYPES).toContain('mortgage');
    expect(ACCOUNT_TYPES).toContain('other');
  });

  it('INVESTMENT_ACCOUNT_TYPES covers brokerage, retirement, hsa', () => {
    expect(INVESTMENT_ACCOUNT_TYPES).toEqual(['brokerage', 'retirement', 'hsa']);
  });

  it('BANKING_ACCOUNT_TYPES covers checking, savings, credit', () => {
    expect(BANKING_ACCOUNT_TYPES).toEqual(['checking', 'savings', 'credit']);
  });

  it('LIABILITY_TYPES covers credit, loan, mortgage', () => {
    expect(LIABILITY_TYPES).toEqual(['credit', 'loan', 'mortgage']);
  });

  it('NET_WORTH_GROUPS cover all account types except other', () => {
    const allGrouped = [
      ...NET_WORTH_GROUPS.cash,
      ...NET_WORTH_GROUPS.investments,
      ...NET_WORTH_GROUPS.debt,
    ];

    // 'other' is intentionally ungrouped — it's a catch-all
    for (const type of ACCOUNT_TYPES) {
      if (type === 'other') continue;
      expect(allGrouped).toContain(type);
    }
  });

  it('NET_WORTH_GROUPS have no overlapping types', () => {
    const all = [
      ...NET_WORTH_GROUPS.cash,
      ...NET_WORTH_GROUPS.investments,
      ...NET_WORTH_GROUPS.debt,
    ];
    const unique = new Set(all);
    expect(unique.size).toBe(all.length);
  });

  it('ASSET_CATEGORIES has all 3 categories', () => {
    expect(ASSET_CATEGORIES).toHaveLength(3);
    expect(ASSET_CATEGORIES).toContain('real_estate');
    expect(ASSET_CATEGORIES).toContain('vehicle');
    expect(ASSET_CATEGORIES).toContain('other');
  });
});
