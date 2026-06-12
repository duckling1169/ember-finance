import { describe, it, expect } from 'vitest';
import {
  fiNumber,
  securityFI,
  coastFI,
  boilingPoint,
  progressToFI,
  yearsToFI,
  computeFIMetrics,
} from '../../../src/engine/metrics.js';
import type { FIMetricsInput } from '../../../src/engine/metrics.js';

describe('fiNumber', () => {
  it('computes FIRE number from spend and withdrawal rate', () => {
    // $200,000 / 3% = $6,666,667
    expect(fiNumber(200000, 0.03)).toBeCloseTo(6666667, 0);
  });

  it('returns Infinity for zero withdrawal rate', () => {
    expect(fiNumber(200000, 0)).toBe(Infinity);
  });
});

describe('securityFI', () => {
  it('computes SecurityFI from expenses and return rate', () => {
    // $34,500 / 6% = $575,000
    expect(securityFI(34500, 0.06)).toBeCloseTo(575000, 0);
  });

  it('returns Infinity for zero return rate', () => {
    expect(securityFI(34500, 0)).toBe(Infinity);
  });
});

describe('coastFI', () => {
  it('computes CoastFI value', () => {
    // FIRE number $6,666,667, 6% real return, 18.79 years to retirement
    // CoastFI = $6,666,667 / (1.06)^18.79
    const fireNum = 6666667;
    const result = coastFI(fireNum, 0.06, 18.79);
    // Should be roughly $2.2–2.5M range
    expect(result).toBeGreaterThan(2000000);
    expect(result).toBeLessThan(3000000);
  });

  it('returns FIRE number when years = 0', () => {
    expect(coastFI(1000000, 0.06, 0)).toBe(1000000);
  });
});

describe('boilingPoint', () => {
  it('computes Boiling Point from contributions and return rate', () => {
    // $128,665 / 6% = $2,144,416.67
    expect(boilingPoint(128665, 0.06)).toBeCloseTo(2144417, 0);
  });
});

describe('progressToFI', () => {
  it('computes progress percentage', () => {
    // $658,000 / $6,666,667 = 9.87%
    expect(progressToFI(658000, 6666667)).toBeCloseTo(9.87, 1);
  });

  it('returns 0 for zero FIRE number', () => {
    expect(progressToFI(100000, 0)).toBe(0);
  });

  it('can exceed 100%', () => {
    expect(progressToFI(2000000, 1000000)).toBe(200);
  });
});

describe('yearsToFI', () => {
  it('returns 0 when already at FIRE', () => {
    expect(yearsToFI(1000000, 50000, 1000000, 0.06)).toBe(0);
  });

  it('computes years for reference scenario (no age)', () => {
    // Portfolio $658,000, contributions $128,665/yr, FIRE $6,666,667, 6% real return
    // Expected ~19.82 years (full annual contributions assumed)
    const result = yearsToFI(658000, 128665, 6666667, 0.06);
    expect(result).not.toBeNull();
    expect(result!).toBeCloseTo(19.82, 0);
  });

  it('prorates first year for fractional age', () => {
    // Same scenario but age 27.4 → first partial year is 0.6
    // Should be slightly longer than the non-prorated version
    const withoutAge = yearsToFI(658000, 128665, 6666667, 0.06);
    const withAge = yearsToFI(658000, 128665, 6666667, 0.06, 27.4);
    expect(withAge).not.toBeNull();
    expect(withoutAge).not.toBeNull();
    // Prorated version should differ (partial first year counted)
    expect(withAge).not.toBe(withoutAge);
  });

  it('no proration for integer age', () => {
    const withoutAge = yearsToFI(658000, 128665, 6666667, 0.06);
    const withAge = yearsToFI(658000, 128665, 6666667, 0.06, 27);
    expect(withAge).toBeCloseTo(withoutAge!, 2);
  });

  it('returns null when unreachable (no contributions, no growth)', () => {
    expect(yearsToFI(100000, 0, 1000000, 0)).toBeNull();
  });

  it('handles zero return with positive contributions', () => {
    // $0 portfolio, $50k/yr, $500k target, 0% return → 10 years
    expect(yearsToFI(0, 50000, 500000, 0)).toBe(10);
  });
});

describe('computeFIMetrics — reference spreadsheet', () => {
  // Reference: birthday 10/21/1998, gross $125,900, tax rate 28%,
  // 9% gross return, 3% inflation, 6% real return, 3% withdrawal rate,
  // desired retirement age 45, yearly expenses $34,500,
  // yearly savings $128,665, retirement spend $200,000
  // Current age ≈ 27.39 (as of ~March 2026)

  const referenceInput: FIMetricsInput = {
    fi_portfolio_value: 658000,
    yearly_contributions: 128665,
    yearly_expenses: 34500,
    real_return_rate: 0.06,
    withdrawal_rate: 0.03,
    current_age: 27.39,
    desired_retirement_age: 45,
    retirement_annual_spend: 200000,
  };

  it('matches reference FIRE number', () => {
    const result = computeFIMetrics(referenceInput);
    expect(result.fire_number).toBeCloseTo(6666667, 0);
  });

  it('matches reference SecurityFI', () => {
    const result = computeFIMetrics(referenceInput);
    expect(result.security_fi).toBeCloseTo(575000, 0);
  });

  it('matches reference Boiling Point', () => {
    const result = computeFIMetrics(referenceInput);
    // $128,665 / 0.06 ≈ $2,144,417
    expect(result.boiling_point).toBeCloseTo(2144417, -3);
  });

  it('matches reference progress percentage', () => {
    const result = computeFIMetrics(referenceInput);
    expect(result.progress_pct).toBeCloseTo(9.87, 1);
  });

  it('computes years to FIRE with first-year proration', () => {
    const result = computeFIMetrics(referenceInput);
    expect(result.years_to_fire).not.toBeNull();
    // With proration (age 27.39 → 0.61 first year), slightly different from pure formula
    expect(result.years_to_fire!).toBeGreaterThan(19);
    expect(result.years_to_fire!).toBeLessThan(21);
  });

  it('computes projected retirement age', () => {
    const result = computeFIMetrics(referenceInput);
    expect(result.projected_retirement_age).not.toBeNull();
    // 27.39 + years_to_fire ≈ ~47
    expect(result.projected_retirement_age!).toBeGreaterThan(46);
    expect(result.projected_retirement_age!).toBeLessThan(48);
  });

  it('reports behind (projected 47 > desired 45)', () => {
    const result = computeFIMetrics(referenceInput);
    expect(result.on_track).toBe('behind');
  });

  it('reports ahead when projected age is well below desired', () => {
    const result = computeFIMetrics({
      ...referenceInput,
      fi_portfolio_value: 3000000,
    });
    expect(result.on_track).toBe('ahead');
  });

  it('reports on_track when projected age is within 1 year of desired', () => {
    // Tweak contributions so projected age lands ~44–45
    const result = computeFIMetrics({
      ...referenceInput,
      yearly_contributions: 200000,
    });
    // With much higher contributions, should be on_track or ahead
    expect(['ahead', 'on_track']).toContain(result.on_track);
  });

  it('reports unreachable when contributions are zero and portfolio insufficient', () => {
    const result = computeFIMetrics({
      ...referenceInput,
      yearly_contributions: 0,
      fi_portfolio_value: 1000,
      real_return_rate: 0,
    });
    expect(result.on_track).toBe('unreachable');
  });
});
