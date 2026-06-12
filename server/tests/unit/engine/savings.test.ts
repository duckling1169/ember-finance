import { describe, it, expect } from 'vitest';
import { computeSavingsRates } from '../../../src/engine/savings.js';

describe('computeSavingsRates', () => {
  it('computes all three rates', () => {
    const result = computeSavingsRates({
      total_gross_annual: 125900,
      yearly_investment_contributions: 50000,
      yearly_savings_contributions: 10000,
    });

    expect(result.investment_rate).toBeCloseTo(50000 / 125900, 4);
    expect(result.savings_rate).toBeCloseTo(10000 / 125900, 4);
    expect(result.total_savings_rate).toBeCloseTo(60000 / 125900, 4);
  });

  it('returns 0 for zero gross income', () => {
    const result = computeSavingsRates({
      total_gross_annual: 0,
      yearly_investment_contributions: 50000,
      yearly_savings_contributions: 10000,
    });

    expect(result.investment_rate).toBe(0);
    expect(result.savings_rate).toBe(0);
    expect(result.total_savings_rate).toBe(0);
  });

  it('handles zero contributions', () => {
    const result = computeSavingsRates({
      total_gross_annual: 100000,
      yearly_investment_contributions: 0,
      yearly_savings_contributions: 0,
    });

    expect(result.investment_rate).toBe(0);
    expect(result.savings_rate).toBe(0);
    expect(result.total_savings_rate).toBe(0);
  });

  it('investment-only household', () => {
    const result = computeSavingsRates({
      total_gross_annual: 100000,
      yearly_investment_contributions: 40000,
      yearly_savings_contributions: 0,
    });

    expect(result.investment_rate).toBeCloseTo(0.4, 4);
    expect(result.savings_rate).toBe(0);
    expect(result.total_savings_rate).toBeCloseTo(0.4, 4);
  });

  it('total_savings_rate = investment_rate + savings_rate', () => {
    const result = computeSavingsRates({
      total_gross_annual: 200000,
      yearly_investment_contributions: 60000,
      yearly_savings_contributions: 20000,
    });

    expect(result.total_savings_rate).toBeCloseTo(result.investment_rate + result.savings_rate, 10);
  });
});
