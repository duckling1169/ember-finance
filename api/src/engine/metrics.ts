/**
 * FI metrics — pure functions computing FIRE milestones from numeric inputs.
 *
 * All return/rate inputs are real (inflation-adjusted) unless noted otherwise.
 */

export interface FIMetricsInput {
  fi_portfolio_value: number;
  yearly_contributions: number;
  yearly_expenses: number;
  real_return_rate: number; // e.g. 0.06 for 6%
  withdrawal_rate: number; // e.g. 0.03 for 3%
  current_age: number;
  desired_retirement_age: number;
  retirement_annual_spend: number; // from waterfall expenses or scenario override
}

export interface FIMetrics {
  fire_number: number;
  security_fi: number;
  coast_fi: number;
  boiling_point: number;
  progress_pct: number;
  years_to_fire: number | null; // null if unreachable
  projected_retirement_age: number | null;
  on_track: 'ahead' | 'on_track' | 'behind' | 'unreachable';
}

/** FIRE number = retirement spend / withdrawal rate */
export function fireNumber(retirementAnnualSpend: number, withdrawalRate: number): number {
  if (withdrawalRate <= 0) return Infinity;
  return retirementAnnualSpend / withdrawalRate;
}

/** SecurityFI = yearly expenses / real return rate */
export function securityFI(yearlyExpenses: number, realReturnRate: number): number {
  if (realReturnRate <= 0) return Infinity;
  return yearlyExpenses / realReturnRate;
}

/**
 * CoastFI = FIRE number / (1 + real_return)^(desired_age - current_age)
 *
 * The portfolio value needed today such that compound growth alone
 * (no further contributions) reaches the FIRE number by desired retirement age.
 */
export function coastFI(
  fireNum: number,
  realReturnRate: number,
  yearsToRetirement: number,
): number {
  if (realReturnRate <= 0 || yearsToRetirement <= 0) return fireNum;
  return fireNum / Math.pow(1 + realReturnRate, yearsToRetirement);
}

/** Boiling Point = yearly contributions / real return rate */
export function boilingPoint(yearlyContributions: number, realReturnRate: number): number {
  if (realReturnRate <= 0) return Infinity;
  return yearlyContributions / realReturnRate;
}

/** Progress to FIRE = current FI portfolio / FIRE number (as percentage 0–100+) */
export function progressToFIRE(fiPortfolioValue: number, fireNum: number): number {
  if (fireNum <= 0 || !isFinite(fireNum)) return 0;
  return (fiPortfolioValue / fireNum) * 100;
}

/**
 * Years to FIRE using future value of annuity formula:
 *
 *   FV = PV * (1+r)^n + C * ((1+r)^n - 1) / r
 *
 * Solve for n:
 *   n = ln((FV * r + C) / (PV * r + C)) / ln(1 + r)
 *
 * Returns null if FIRE is unreachable (contributions + growth can't reach target).
 */
export function yearsToFIRE(
  currentPortfolio: number,
  yearlyContributions: number,
  fireNum: number,
  realReturnRate: number,
): number | null {
  if (currentPortfolio >= fireNum) return 0;
  if (realReturnRate <= 0) {
    // No growth — only contributions count
    if (yearlyContributions <= 0) return null;
    const remaining = fireNum - currentPortfolio;
    return remaining / yearlyContributions;
  }

  const r = realReturnRate;
  const numerator = fireNum * r + yearlyContributions;
  const denominator = currentPortfolio * r + yearlyContributions;

  if (denominator <= 0) return null;
  if (numerator / denominator <= 0) return null;

  const n = Math.log(numerator / denominator) / Math.log(1 + r);
  return isFinite(n) && n > 0 ? n : null;
}

/** Compute all FI metrics from a single input object. */
export function computeFIMetrics(input: FIMetricsInput): FIMetrics {
  const {
    fi_portfolio_value,
    yearly_contributions,
    yearly_expenses,
    real_return_rate,
    withdrawal_rate,
    current_age,
    desired_retirement_age,
    retirement_annual_spend,
  } = input;

  const fireNum = fireNumber(retirement_annual_spend, withdrawal_rate);
  const secFI = securityFI(yearly_expenses, real_return_rate);
  const yearsToDesired = Math.max(0, desired_retirement_age - current_age);
  const coastFIVal = coastFI(fireNum, real_return_rate, yearsToDesired);
  const boilingPt = boilingPoint(yearly_contributions, real_return_rate);
  const progress = progressToFIRE(fi_portfolio_value, fireNum);
  const ytf = yearsToFIRE(fi_portfolio_value, yearly_contributions, fireNum, real_return_rate);

  const projectedAge = ytf != null ? current_age + ytf : null;

  let onTrack: FIMetrics['on_track'];
  if (ytf == null) {
    onTrack = 'unreachable';
  } else if (projectedAge != null && projectedAge <= desired_retirement_age) {
    onTrack = projectedAge < desired_retirement_age - 1 ? 'ahead' : 'on_track';
  } else {
    onTrack = 'behind';
  }

  return {
    fire_number: fireNum,
    security_fi: secFI,
    coast_fi: coastFIVal,
    boiling_point: boilingPt,
    progress_pct: progress,
    years_to_fire: ytf,
    projected_retirement_age: projectedAge,
    on_track: onTrack,
  };
}
