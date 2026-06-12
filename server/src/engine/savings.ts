/**
 * Savings rate calculations.
 *
 * Three rates reflecting different definitions of "savings":
 * - Investment rate: investable flows (FI-flagged account contributions) / total inflows
 * - Savings rate: all savings flows (including non-FI savings accounts) / total inflows
 * - Total savings rate: (investment + savings) / total inflows
 */

export interface SavingsRateInput {
  total_gross_annual: number;
  /** Yearly contributions to FI-flagged investment accounts. */
  yearly_investment_contributions: number;
  /** Yearly contributions to savings/non-FI accounts (emergency fund, etc). */
  yearly_savings_contributions: number;
}

export interface SavingsRates {
  investment_rate: number; // 0–1
  savings_rate: number; // 0–1
  total_savings_rate: number; // 0–1
}

export function computeSavingsRates(input: SavingsRateInput): SavingsRates {
  const { total_gross_annual, yearly_investment_contributions, yearly_savings_contributions } =
    input;

  if (total_gross_annual <= 0) {
    return { investment_rate: 0, savings_rate: 0, total_savings_rate: 0 };
  }

  const investment_rate = yearly_investment_contributions / total_gross_annual;
  const savings_rate = yearly_savings_contributions / total_gross_annual;
  const total_savings_rate =
    (yearly_investment_contributions + yearly_savings_contributions) / total_gross_annual;

  return { investment_rate, savings_rate, total_savings_rate };
}
