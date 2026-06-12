import type { CashflowFrequency } from '../types/index';

/**
 * Cadence normalization — convert any cashflow frequency to monthly or annual amounts.
 *
 * Conversion factors to monthly:
 *   monthly   → 1
 *   biweekly  → 26/12 ≈ 2.1667
 *   annual    → 1/12
 *   one_time  → 0 (excluded from recurring flows by default)
 */

const TO_MONTHLY: Record<CashflowFrequency, number> = {
  monthly: 1,
  biweekly: 26 / 12,
  annual: 1 / 12,
  one_time: 0,
};

/** Convert an amount at a given frequency to its monthly equivalent. */
export function toMonthly(amount: number, frequency: CashflowFrequency): number {
  return amount * TO_MONTHLY[frequency];
}

/** Convert an amount at a given frequency to its annual equivalent. */
export function toAnnual(amount: number, frequency: CashflowFrequency): number {
  if (frequency === 'one_time') return amount;
  return toMonthly(amount, frequency) * 12;
}

/** Convert monthly amount to annual. */
export function monthlyToAnnual(monthly: number): number {
  return monthly * 12;
}

/** Convert annual amount to monthly. */
export function annualToMonthly(annual: number): number {
  return annual / 12;
}
