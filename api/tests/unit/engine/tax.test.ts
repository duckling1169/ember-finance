import { describe, it, expect } from 'vitest';
import {
  computeFederalTax,
  getStandardDeduction,
  computeStateTax,
  getStateRate,
  computeFICA,
  estimateTaxes,
} from '../../../src/engine/tax.js';
import { TAX_PARAMS_2025 } from './fixtures.js';

const P = TAX_PARAMS_2025;

describe('computeFederalTax', () => {
  it('returns 0 for zero income', () => {
    expect(computeFederalTax(0, 'single', P)).toBe(0);
  });

  it('returns 0 for negative income', () => {
    expect(computeFederalTax(-10000, 'single', P)).toBe(0);
  });

  it('computes 10% bracket correctly for single', () => {
    // $10,000 taxable → all in 10% bracket
    expect(computeFederalTax(10000, 'single', P)).toBe(1000);
  });

  it('computes across multiple brackets for single', () => {
    // $60,000 taxable (single):
    // 10% on first $11,925 = $1,192.50
    // 12% on $11,925–$48,475 = $4,386.00
    // 22% on $48,475–$60,000 = $2,535.50
    // Total = $8,114.00
    expect(computeFederalTax(60000, 'single', P)).toBeCloseTo(8114, 0);
  });

  it('uses married_jointly brackets', () => {
    // $60,000 taxable (married_jointly):
    // 10% on first $23,850 = $2,385
    // 12% on $23,850–$60,000 = $4,338
    // Total = $6,723
    expect(computeFederalTax(60000, 'married_jointly', P)).toBeCloseTo(6723, 0);
  });

  it('handles the unbounded top bracket (max = null)', () => {
    // $1,000,000 taxable single — top slice taxed at 37%
    const atTopStart = computeFederalTax(626350, 'single', P);
    const millionTax = computeFederalTax(1000000, 'single', P);
    expect(millionTax).toBeCloseTo(atTopStart + (1000000 - 626350) * 0.37, 0);
  });

  it('is a pure function of params — different brackets give different tax', () => {
    const altered = {
      ...P,
      federal_brackets: {
        ...P.federal_brackets,
        single: [{ min: 0, max: null, rate: 0.2 }],
      },
    };
    expect(computeFederalTax(50000, 'single', altered)).toBe(10000);
  });
});

describe('getStandardDeduction', () => {
  it('returns deductions from params', () => {
    expect(getStandardDeduction('single', P)).toBe(15000);
    expect(getStandardDeduction('married_jointly', P)).toBe(30000);
    expect(getStandardDeduction('head_of_household', P)).toBe(22500);
  });
});

describe('computeStateTax', () => {
  it('returns 0 for no-income-tax states', () => {
    expect(computeStateTax(100000, 'TX', P)).toBe(0);
    expect(computeStateTax(100000, 'FL', P)).toBe(0);
    expect(computeStateTax(100000, 'WA', P)).toBe(0);
  });

  it('returns 0 for null state', () => {
    expect(computeStateTax(100000, null, P)).toBe(0);
  });

  it('computes CA tax at effective rate', () => {
    // CA rate = 6.5%
    expect(computeStateTax(100000, 'CA', P)).toBeCloseTo(6500, 0);
  });

  it('returns 0 for a state missing from the table', () => {
    expect(computeStateTax(100000, 'WY', P)).toBe(0);
  });

  it('returns 0 for negative income', () => {
    expect(computeStateTax(-50000, 'CA', P)).toBe(0);
  });
});

describe('getStateRate', () => {
  it('returns rate for known state', () => {
    expect(getStateRate('CA', P)).toBe(0.065);
    expect(getStateRate('NY', P)).toBe(0.06);
  });

  it('returns 0 for null', () => {
    expect(getStateRate(null, P)).toBe(0);
  });
});

describe('computeFICA', () => {
  it('returns 0 for zero income', () => {
    const result = computeFICA(0, 'single', P);
    expect(result.total).toBe(0);
  });

  it('computes SS + Medicare for W-2 employee', () => {
    // $100,000 income, single, W-2
    // SS: $100,000 * 6.2% = $6,200
    // Medicare: $100,000 * 1.45% = $1,450
    const result = computeFICA(100000, 'single', P, false);
    expect(result.social_security).toBeCloseTo(6200, 0);
    expect(result.medicare).toBeCloseTo(1450, 0);
    expect(result.total).toBeCloseTo(7650, 0);
  });

  it('caps SS at wage base', () => {
    // $250,000 income — SS capped at $176,100
    // SS: $176,100 * 6.2% = $10,918.20
    const result = computeFICA(250000, 'single', P, false);
    expect(result.social_security).toBeCloseTo(10918.2, 0);
  });

  it('applies Medicare surtax above threshold', () => {
    // $250,000 single → surtax on $50,000 above $200,000
    // Base Medicare: $250,000 * 1.45% = $3,625
    // Surtax: $50,000 * 0.9% = $450
    const result = computeFICA(250000, 'single', P, false);
    expect(result.medicare).toBeCloseTo(4075, 0);
  });

  it('doubles rates for self-employed', () => {
    // $100,000 self-employed
    // SS: $100,000 * 12.4% = $12,400
    // Medicare: $100,000 * 2.9% = $2,900
    const result = computeFICA(100000, 'single', P, true);
    expect(result.social_security).toBeCloseTo(12400, 0);
    expect(result.medicare).toBeCloseTo(2900, 0);
  });
});

describe('estimateTaxes', () => {
  it('computes full breakdown for a typical single filer', () => {
    const result = estimateTaxes(
      {
        taxable_income: 100000,
        gross_earned_income: 100000,
        filing_status: 'single',
        state: 'CA',
      },
      P,
    );

    // Federal: on ($100k - $15k standard deduction) = $85k taxable
    expect(result.federal).toBeGreaterThan(0);
    // State: $100k * 6.5% = $6,500
    expect(result.state).toBeCloseTo(6500, 0);
    // FICA: SS $6,200 + Medicare $1,450 = $7,650
    expect(result.fica_total).toBeCloseTo(7650, 0);
    expect(result.total).toBe(result.federal + result.state + result.fica_total);
    expect(result.effective_rate).toBeCloseTo(result.total / 100000, 4);
  });

  it('stamps the tax year from the params', () => {
    const result = estimateTaxes(
      {
        taxable_income: 100000,
        gross_earned_income: 100000,
        filing_status: 'single',
        state: 'CA',
      },
      P,
    );
    expect(result.tax_year).toBe(2025);
  });

  it('handles zero income', () => {
    const result = estimateTaxes(
      {
        taxable_income: 0,
        gross_earned_income: 0,
        filing_status: 'single',
        state: 'CA',
      },
      P,
    );
    expect(result.total).toBe(0);
    expect(result.effective_rate).toBe(0);
  });
});
