import { describe, it, expect } from 'vitest';
import {
  toMonthly,
  toAnnual,
  monthlyToAnnual,
  annualToMonthly,
} from '../../../src/engine/normalize.js';

describe('toMonthly', () => {
  it('monthly amount passes through', () => {
    expect(toMonthly(3000, 'monthly')).toBe(3000);
  });

  it('biweekly converts using 26/12 factor', () => {
    // $2000 biweekly → $2000 * 26/12 ≈ $4333.33/mo
    expect(toMonthly(2000, 'biweekly')).toBeCloseTo(4333.33, 1);
  });

  it('annual converts to 1/12', () => {
    expect(toMonthly(120000, 'annual')).toBeCloseTo(10000, 2);
  });

  it('one_time returns 0 (excluded from recurring)', () => {
    expect(toMonthly(5000, 'one_time')).toBe(0);
  });
});

describe('toAnnual', () => {
  it('monthly × 12', () => {
    expect(toAnnual(3000, 'monthly')).toBe(36000);
  });

  it('biweekly × 26', () => {
    // $2000 biweekly → monthly 4333.33 → annual 52000
    expect(toAnnual(2000, 'biweekly')).toBeCloseTo(52000, 0);
  });

  it('annual passes through via monthly round-trip', () => {
    expect(toAnnual(120000, 'annual')).toBeCloseTo(120000, 2);
  });

  it('one_time returns the amount itself', () => {
    expect(toAnnual(5000, 'one_time')).toBe(5000);
  });
});

describe('monthlyToAnnual / annualToMonthly', () => {
  it('round-trips correctly', () => {
    expect(monthlyToAnnual(5000)).toBe(60000);
    expect(annualToMonthly(60000)).toBe(5000);
    expect(annualToMonthly(monthlyToAnnual(1234))).toBeCloseTo(1234, 10);
  });
});
