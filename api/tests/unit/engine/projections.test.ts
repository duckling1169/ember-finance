import { describe, it, expect } from 'vitest';
import { computeProjection } from '../../../src/engine/projections.js';
import type { ProjectionInput } from '../../../src/engine/projections.js';

function baseInput(overrides: Partial<ProjectionInput> = {}): ProjectionInput {
  return {
    fi_portfolio_value: 100000,
    yearly_contributions: 20000,
    real_return_rate: 0.06,
    inflation_rate: 0.03,
    years: 10,
    contribution_growth_mode: 'none',
    contribution_growth_rate: null,
    ...overrides,
  };
}

/** Helper: return only the projected years (skip year-0 snapshot). */
function projectedYears(result: ReturnType<typeof computeProjection>) {
  return result.years.filter((y) => y.year > 0);
}

describe('computeProjection', () => {
  it('produces year-0 snapshot + N projected years', () => {
    const result = computeProjection(baseInput());
    expect(result.years).toHaveLength(11); // year 0 + years 1–10
    expect(result.years[0].year).toBe(0);
    expect(result.years[1].year).toBe(1);
    expect(result.years[10].year).toBe(10);
  });

  it('year-0 snapshot reflects starting portfolio with no growth', () => {
    const result = computeProjection(baseInput());
    const yr0 = result.years[0];
    expect(yr0.starting_portfolio).toBe(100000);
    expect(yr0.contributions).toBe(0);
    expect(yr0.growth).toBe(0);
    expect(yr0.ending_portfolio).toBe(100000);
  });

  it('year 1 starts from initial portfolio', () => {
    const result = computeProjection(baseInput());
    const years = projectedYears(result);
    expect(years[0].starting_portfolio).toBe(100000);
  });

  it('year N+1 starts where year N ends', () => {
    const result = computeProjection(baseInput());
    const years = projectedYears(result);
    for (let i = 1; i < years.length; i++) {
      expect(years[i].starting_portfolio).toBeCloseTo(years[i - 1].ending_portfolio, 2);
    }
  });

  it('ending = starting + contributions + growth', () => {
    const result = computeProjection(baseInput());
    for (const yr of projectedYears(result)) {
      expect(yr.ending_portfolio).toBeCloseTo(
        yr.starting_portfolio + yr.contributions + yr.growth,
        2,
      );
    }
  });

  it('growth uses mid-year contribution approximation', () => {
    const result = computeProjection(baseInput({ years: 1 }));
    const yr = projectedYears(result)[0];
    // Growth = (100000 + 20000/2) * 0.06 = 110000 * 0.06 = 6600
    expect(yr.growth).toBeCloseTo(6600, 2);
    // Ending = 100000 + 20000 + 6600 = 126600
    expect(yr.ending_portfolio).toBeCloseTo(126600, 2);
  });

  it('no growth with 0% return', () => {
    const result = computeProjection(baseInput({ real_return_rate: 0, years: 5 }));
    for (const yr of projectedYears(result)) {
      expect(yr.growth).toBe(0);
    }
    // Final = 100000 + 20000*5 = 200000
    expect(result.final_portfolio).toBeCloseTo(200000, 2);
  });

  it('no contributions with $0/yr', () => {
    const result = computeProjection(baseInput({ yearly_contributions: 0, years: 1 }));
    const yr = projectedYears(result)[0];
    expect(yr.contributions).toBe(0);
    // Growth = 100000 * 0.06 = 6000
    expect(yr.growth).toBeCloseTo(6000, 2);
    expect(yr.ending_portfolio).toBeCloseTo(106000, 2);
  });

  it('grows contributions by inflation rate', () => {
    const result = computeProjection(
      baseInput({ contribution_growth_mode: 'inflation', years: 3 }),
    );
    const years = projectedYears(result);
    expect(years[0].contributions).toBeCloseTo(20000, 2);
    expect(years[1].contributions).toBeCloseTo(20000 * 1.03, 2);
    expect(years[2].contributions).toBeCloseTo(20000 * 1.03 * 1.03, 2);
  });

  it('grows contributions by fixed rate', () => {
    const result = computeProjection(
      baseInput({
        contribution_growth_mode: 'fixed_rate',
        contribution_growth_rate: 0.05,
        years: 2,
      }),
    );
    const years = projectedYears(result);
    expect(years[0].contributions).toBeCloseTo(20000, 2);
    expect(years[1].contributions).toBeCloseTo(21000, 2);
  });

  it('keeps contributions flat with mode=none', () => {
    const result = computeProjection(baseInput({ years: 5 }));
    for (const yr of projectedYears(result)) {
      expect(yr.contributions).toBeCloseTo(20000, 2);
    }
  });

  it('tracks age when provided (integer)', () => {
    const result = computeProjection(baseInput({ years: 3 }), 30);
    expect(result.years[0].age).toBeCloseTo(30, 1); // year-0 snapshot
    const years = projectedYears(result);
    expect(years[0].age).toBe(31);
    expect(years[1].age).toBe(32);
    expect(years[2].age).toBe(33);
  });

  it('age is null when not provided', () => {
    const result = computeProjection(baseInput({ years: 1 }));
    expect(result.years[0].age).toBeNull();
  });

  it('includes per-account contribution detail', () => {
    const result = computeProjection(
      baseInput({
        years: 2,
        account_contributions: [
          { account_id: 'a1', name: '401k', yearly_amount: 15000 },
          { account_id: 'a2', name: 'Roth IRA', yearly_amount: 5000 },
        ],
      }),
    );

    const years = projectedYears(result);
    expect(years[0].account_detail).toHaveLength(2);
    expect(years[0].account_detail![0].contribution).toBe(15000);
    expect(years[0].account_detail![1].contribution).toBe(5000);
  });

  it('grows per-account contributions with inflation mode', () => {
    const result = computeProjection(
      baseInput({
        contribution_growth_mode: 'inflation',
        years: 2,
        account_contributions: [
          { account_id: 'a1', name: '401k', yearly_amount: 15000 },
          { account_id: 'a2', name: 'Roth IRA', yearly_amount: 5000 },
        ],
      }),
    );

    const years = projectedYears(result);
    expect(years[1].account_detail![0].contribution).toBeCloseTo(15000 * 1.03, 2);
    expect(years[1].account_detail![1].contribution).toBeCloseTo(5000 * 1.03, 2);
  });

  it('total_contributions and total_growth sum correctly', () => {
    const result = computeProjection(baseInput());
    const years = projectedYears(result);
    const sumContribs = years.reduce((s, y) => s + y.contributions, 0);
    const sumGrowth = years.reduce((s, y) => s + y.growth, 0);
    expect(result.total_contributions).toBeCloseTo(sumContribs, 2);
    expect(result.total_growth).toBeCloseTo(sumGrowth, 2);
  });

  it('final_portfolio matches last year ending', () => {
    const result = computeProjection(baseInput());
    expect(result.final_portfolio).toBeCloseTo(
      result.years[result.years.length - 1].ending_portfolio,
      2,
    );
  });

  it('handles 0 years gracefully', () => {
    const result = computeProjection(baseInput({ years: 0 }));
    expect(result.years).toHaveLength(0);
    expect(result.final_portfolio).toBe(100000);
    expect(result.total_contributions).toBe(0);
    expect(result.total_growth).toBe(0);
  });

  // ── First-year proration ──

  it('prorates year 1 contributions for fractional age', () => {
    // Age 30.4 → 0.6 of the year remaining
    const result = computeProjection(baseInput({ years: 2 }), 30.4);
    const years = projectedYears(result);
    expect(years[0].contributions).toBeCloseTo(20000 * 0.6, 2);
    // Year 2 gets full contributions
    expect(years[1].contributions).toBeCloseTo(20000, 2);
  });

  it('prorates year 1 growth for fractional age', () => {
    const result = computeProjection(baseInput({ years: 1 }), 30.4);
    const yr = projectedYears(result)[0];
    const proratedContrib = 20000 * 0.6;
    // Growth = (100000 + proratedContrib/2) * 0.06 * 0.6
    const expectedGrowth = (100000 + proratedContrib / 2) * 0.06 * 0.6;
    expect(yr.growth).toBeCloseTo(expectedGrowth, 2);
  });

  it('prorates per-account detail for fractional age', () => {
    const result = computeProjection(
      baseInput({
        years: 2,
        account_contributions: [{ account_id: 'a1', name: '401k', yearly_amount: 15000 }],
      }),
      30.4,
    );
    const years = projectedYears(result);
    expect(years[0].account_detail![0].contribution).toBeCloseTo(15000 * 0.6, 2);
    expect(years[1].account_detail![0].contribution).toBeCloseTo(15000, 2);
  });

  it('no proration with integer age', () => {
    const result = computeProjection(baseInput({ years: 1 }), 30);
    const yr = projectedYears(result)[0];
    expect(yr.contributions).toBeCloseTo(20000, 2);
    expect(yr.growth).toBeCloseTo(6600, 2);
  });

  it('year-0 shows fractional age', () => {
    const result = computeProjection(baseInput({ years: 1 }), 30.4);
    expect(result.years[0].year).toBe(0);
    expect(result.years[0].age).toBeCloseTo(30.4, 1);
  });
});
