import type { TaxFilingStatus, USState } from '../types/index';
import type { TaxInput, TaxBreakdown, TaxParams } from './types';

/**
 * Tax computation engine.
 *
 * All rule values (brackets, deductions, FICA rates/caps, state rates)
 * come from versioned, year-stamped `TaxParams` resolved out of the
 * assumptions system — never from constants in this module. Changing a
 * tax year is a data edit, not a code change.
 */

// ── Public API ──

/** Compute federal income tax using progressive brackets. */
export function computeFederalTax(
  taxableIncome: number,
  filingStatus: TaxFilingStatus,
  params: TaxParams,
): number {
  if (taxableIncome <= 0) return 0;

  const brackets = params.federal_brackets[filingStatus];
  let tax = 0;

  for (const bracket of brackets) {
    if (taxableIncome <= bracket.min) break;
    const max = bracket.max ?? Infinity;
    const taxableInBracket = Math.min(taxableIncome, max) - bracket.min;
    tax += taxableInBracket * bracket.rate;
  }

  return tax;
}

/** Get the standard deduction for a filing status. */
export function getStandardDeduction(filingStatus: TaxFilingStatus, params: TaxParams): number {
  return params.standard_deduction[filingStatus];
}

/** Compute state income tax using effective flat rate. */
export function computeStateTax(
  taxableIncome: number,
  state: USState | null,
  params: TaxParams,
): number {
  if (!state || taxableIncome <= 0) return 0;
  const rate = params.state_rates[state] ?? 0;
  return taxableIncome * rate;
}

/** Get the effective state tax rate. */
export function getStateRate(state: USState | null, params: TaxParams): number {
  if (!state) return 0;
  return params.state_rates[state] ?? 0;
}

/** Compute FICA taxes (Social Security + Medicare). */
export function computeFICA(
  grossEarnedIncome: number,
  filingStatus: TaxFilingStatus,
  params: TaxParams,
  isSelfEmployed = false,
): { social_security: number; medicare: number; total: number } {
  if (grossEarnedIncome <= 0) return { social_security: 0, medicare: 0, total: 0 };

  const { fica } = params;
  // Self-employment pays employer + employee portions
  const ssRate = isSelfEmployed ? fica.ss_rate * 2 : fica.ss_rate;
  const medRate = isSelfEmployed ? fica.medicare_rate * 2 : fica.medicare_rate;

  const social_security = Math.min(grossEarnedIncome, fica.ss_wage_cap) * ssRate;

  const surtaxThreshold = fica.medicare_surtax_threshold[filingStatus];
  const baseMedicare = grossEarnedIncome * medRate;
  const surtax =
    grossEarnedIncome > surtaxThreshold
      ? (grossEarnedIncome - surtaxThreshold) * fica.medicare_surtax_rate
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
export function estimateTaxes(input: TaxInput, params: TaxParams): TaxBreakdown {
  const { taxable_income, gross_earned_income, filing_status, state, is_self_employed } = input;

  const standardDeduction = params.standard_deduction[filing_status];
  const federalTaxableIncome = Math.max(0, taxable_income - standardDeduction);

  const federal = computeFederalTax(federalTaxableIncome, filing_status, params);

  // State tax: apply to taxable income (pre-standard-deduction, simplified)
  const stateTax = computeStateTax(taxable_income, state, params);

  const fica = computeFICA(gross_earned_income, filing_status, params, is_self_employed);

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
    tax_year: params.year,
  };
}
