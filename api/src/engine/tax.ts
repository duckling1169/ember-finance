import type { TaxFilingStatus, USState } from '../types/index.js';
import type { TaxInput, TaxBreakdown, FederalBracket } from './types.js';

// ── 2025 Federal Tax Brackets ──

const FEDERAL_BRACKETS: Record<TaxFilingStatus, FederalBracket[]> = {
  single: [
    { min: 0, max: 11_925, rate: 0.1 },
    { min: 11_925, max: 48_475, rate: 0.12 },
    { min: 48_475, max: 103_350, rate: 0.22 },
    { min: 103_350, max: 197_300, rate: 0.24 },
    { min: 197_300, max: 250_525, rate: 0.32 },
    { min: 250_525, max: 626_350, rate: 0.35 },
    { min: 626_350, max: Infinity, rate: 0.37 },
  ],
  married_jointly: [
    { min: 0, max: 23_850, rate: 0.1 },
    { min: 23_850, max: 96_950, rate: 0.12 },
    { min: 96_950, max: 206_700, rate: 0.22 },
    { min: 206_700, max: 394_600, rate: 0.24 },
    { min: 394_600, max: 501_050, rate: 0.32 },
    { min: 501_050, max: 751_600, rate: 0.35 },
    { min: 751_600, max: Infinity, rate: 0.37 },
  ],
  married_separately: [
    { min: 0, max: 11_925, rate: 0.1 },
    { min: 11_925, max: 48_475, rate: 0.12 },
    { min: 48_475, max: 103_350, rate: 0.22 },
    { min: 103_350, max: 197_300, rate: 0.24 },
    { min: 197_300, max: 250_525, rate: 0.32 },
    { min: 250_525, max: 375_800, rate: 0.35 },
    { min: 375_800, max: Infinity, rate: 0.37 },
  ],
  head_of_household: [
    { min: 0, max: 17_000, rate: 0.1 },
    { min: 17_000, max: 64_850, rate: 0.12 },
    { min: 64_850, max: 103_350, rate: 0.22 },
    { min: 103_350, max: 197_300, rate: 0.24 },
    { min: 197_300, max: 250_500, rate: 0.32 },
    { min: 250_500, max: 626_350, rate: 0.35 },
    { min: 626_350, max: Infinity, rate: 0.37 },
  ],
};

// ── Standard Deduction (2025) ──

const STANDARD_DEDUCTION: Record<TaxFilingStatus, number> = {
  single: 15_000,
  married_jointly: 30_000,
  married_separately: 15_000,
  head_of_household: 22_500,
};

// ── FICA Constants (2025) ──

const SS_RATE = 0.062;
const SS_WAGE_CAP = 176_100;
const MEDICARE_RATE = 0.0145;
const MEDICARE_SURTAX_RATE = 0.009;

const MEDICARE_SURTAX_THRESHOLD: Record<TaxFilingStatus, number> = {
  single: 200_000,
  married_jointly: 250_000,
  married_separately: 125_000,
  head_of_household: 200_000,
};

// Self-employment: employer + employee portions
const SE_SS_RATE = SS_RATE * 2;
const SE_MEDICARE_RATE = MEDICARE_RATE * 2;

// ── State Effective Tax Rates ──
// Simplified flat effective rates per state. These approximate real-world
// effective rates for a median-income filer. States with no income tax = 0.

const STATE_EFFECTIVE_RATES: Record<USState, number> = {
  AL: 0.04,
  AK: 0,
  AZ: 0.025,
  AR: 0.044,
  CA: 0.065,
  CO: 0.044,
  CT: 0.055,
  DE: 0.05,
  FL: 0,
  GA: 0.049,
  HI: 0.06,
  ID: 0.058,
  IL: 0.0495,
  IN: 0.0305,
  IA: 0.044,
  KS: 0.046,
  KY: 0.04,
  LA: 0.035,
  ME: 0.055,
  MD: 0.05,
  MA: 0.05,
  MI: 0.0425,
  MN: 0.0585,
  MS: 0.047,
  MO: 0.048,
  MT: 0.059,
  NE: 0.0544,
  NV: 0,
  NH: 0,
  NJ: 0.055,
  NM: 0.04,
  NY: 0.06,
  NC: 0.045,
  ND: 0.02,
  OH: 0.035,
  OK: 0.0375,
  OR: 0.075,
  PA: 0.0307,
  RI: 0.0475,
  SC: 0.05,
  SD: 0,
  TN: 0,
  TX: 0,
  UT: 0.0465,
  VT: 0.055,
  VA: 0.05,
  WA: 0,
  WV: 0.05,
  WI: 0.053,
  WY: 0,
  DC: 0.06,
};

// ── Public API ──

/** Compute federal income tax using progressive brackets. */
export function computeFederalTax(taxableIncome: number, filingStatus: TaxFilingStatus): number {
  if (taxableIncome <= 0) return 0;

  const brackets = FEDERAL_BRACKETS[filingStatus];
  let tax = 0;

  for (const bracket of brackets) {
    if (taxableIncome <= bracket.min) break;
    const taxableInBracket = Math.min(taxableIncome, bracket.max) - bracket.min;
    tax += taxableInBracket * bracket.rate;
  }

  return tax;
}

/** Get the standard deduction for a filing status. */
export function getStandardDeduction(filingStatus: TaxFilingStatus): number {
  return STANDARD_DEDUCTION[filingStatus];
}

/** Compute state income tax using effective flat rate. */
export function computeStateTax(taxableIncome: number, state: USState | null): number {
  if (!state || taxableIncome <= 0) return 0;
  const rate = STATE_EFFECTIVE_RATES[state] ?? 0;
  return taxableIncome * rate;
}

/** Get the effective state tax rate. */
export function getStateRate(state: USState | null): number {
  if (!state) return 0;
  return STATE_EFFECTIVE_RATES[state] ?? 0;
}

/** Compute FICA taxes (Social Security + Medicare). */
export function computeFICA(
  grossEarnedIncome: number,
  filingStatus: TaxFilingStatus,
  isSelfEmployed = false,
): { social_security: number; medicare: number; total: number } {
  if (grossEarnedIncome <= 0) return { social_security: 0, medicare: 0, total: 0 };

  const ssRate = isSelfEmployed ? SE_SS_RATE : SS_RATE;
  const medRate = isSelfEmployed ? SE_MEDICARE_RATE : MEDICARE_RATE;

  const social_security = Math.min(grossEarnedIncome, SS_WAGE_CAP) * ssRate;

  const surtaxThreshold = MEDICARE_SURTAX_THRESHOLD[filingStatus];
  const baseMedicare = grossEarnedIncome * medRate;
  const surtax =
    grossEarnedIncome > surtaxThreshold
      ? (grossEarnedIncome - surtaxThreshold) * MEDICARE_SURTAX_RATE
      : 0;
  const medicare = baseMedicare + surtax;

  return {
    social_security,
    medicare,
    total: social_security + medicare,
  };
}

/**
 * Full tax estimation — federal + state + FICA.
 *
 * Applies standard deduction to compute federal taxable income.
 * State tax uses the same taxable income (simplified — many states differ).
 */
export function estimateTaxes(input: TaxInput): TaxBreakdown {
  const { taxable_income, gross_earned_income, filing_status, state, is_self_employed } = input;

  const standardDeduction = STANDARD_DEDUCTION[filing_status];
  const federalTaxableIncome = Math.max(0, taxable_income - standardDeduction);

  const federal = computeFederalTax(federalTaxableIncome, filing_status);

  // State tax: apply to taxable income (pre-standard-deduction, simplified)
  const stateTax = computeStateTax(taxable_income, state);

  const fica = computeFICA(gross_earned_income, filing_status, is_self_employed);

  const total = federal + stateTax + fica.total;
  const effectiveRate = taxable_income > 0 ? total / taxable_income : 0;

  return {
    federal,
    state: stateTax,
    social_security: fica.social_security,
    medicare: fica.medicare,
    fica_total: fica.total,
    total,
    effective_rate: effectiveRate,
  };
}
