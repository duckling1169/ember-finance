import { describe, it, expect } from 'vitest';
import { fmt, fmtAxisK, fmtPct, fmtYears, fmtCompact } from './formatters';

describe('fmt', () => {
  it('formats USD currency', () => {
    expect(fmt(1234.5)).toBe('$1,234.50');
    expect(fmt(-42)).toBe('-$42.00');
    expect(fmt(0)).toBe('$0.00');
  });
});

describe('fmtAxisK', () => {
  it('abbreviates thousands and millions', () => {
    expect(fmtAxisK(950)).toBe('$950');
    expect(fmtAxisK(12_000)).toBe('$12k');
    expect(fmtAxisK(2_500_000)).toBe('$2.5M');
  });

  it('handles negatives by magnitude', () => {
    expect(fmtAxisK(-12_000)).toBe('$-12k');
  });
});

describe('fmtPct', () => {
  it('converts decimal rates to percent strings', () => {
    expect(fmtPct(0.0654)).toBe('6.5%');
    expect(fmtPct(0.0654, 2)).toBe('6.54%');
    expect(fmtPct(1)).toBe('100.0%');
  });
});

describe('fmtYears', () => {
  it('formats year spans', () => {
    expect(fmtYears(19.82)).toBe('19.8 years');
    expect(fmtYears(0.4)).toBe('< 1 year');
  });

  it('handles null and non-finite values', () => {
    expect(fmtYears(null)).toBe('--');
    expect(fmtYears(Infinity)).toBe('--');
  });
});

describe('fmtCompact', () => {
  it('abbreviates large values and formats small ones as currency', () => {
    expect(fmtCompact(1_500_000)).toBe('$1.5M');
    expect(fmtCompact(45_000)).toBe('$45k');
    expect(fmtCompact(450)).toBe('$450.00');
  });
});
