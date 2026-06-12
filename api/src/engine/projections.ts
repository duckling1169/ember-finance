/**
 * Year-by-year projection engine.
 *
 * Stepwise future value with contributions, contribution growth,
 * and per-account contribution routing.
 */

import type { ContributionGrowthMode } from '../types/index';

export interface ProjectionInput {
  fi_portfolio_value: number;
  yearly_contributions: number;
  real_return_rate: number; // real (inflation-adjusted)
  inflation_rate: number;
  years: number;
  contribution_growth_mode: ContributionGrowthMode;
  contribution_growth_rate: number | null; // used when mode = 'fixed_rate'

  /** Optional per-account contribution breakdown for routing detail. */
  account_contributions?: AccountContribution[];
}

export interface AccountContribution {
  account_id: string;
  name: string;
  yearly_amount: number;
}

export interface ProjectionYear {
  year: number;
  age: number | null;
  starting_portfolio: number;
  contributions: number;
  growth: number;
  ending_portfolio: number;
  /** Per-account contributions for this year (if provided). */
  account_detail?: AccountContributionYear[];
}

export interface AccountContributionYear {
  account_id: string;
  name: string;
  contribution: number;
}

export interface ProjectionResult {
  years: ProjectionYear[];
  final_portfolio: number;
  total_contributions: number;
  total_growth: number;
}

/**
 * Run a year-by-year projection.
 *
 * @param input - Projection parameters
 * @param currentAge - Optional current age for age column
 */
export function computeProjection(input: ProjectionInput, currentAge?: number): ProjectionResult {
  const {
    fi_portfolio_value,
    yearly_contributions,
    real_return_rate,
    inflation_rate,
    years,
    contribution_growth_mode,
    contribution_growth_rate,
    account_contributions,
  } = input;

  const projectionYears: ProjectionYear[] = [];
  let portfolio = fi_portfolio_value;
  let contributions = yearly_contributions;
  let totalContributions = 0;
  let totalGrowth = 0;

  // Determine the contribution growth rate per year
  const growthRate = resolveContributionGrowthRate(
    contribution_growth_mode,
    contribution_growth_rate,
    inflation_rate,
  );

  // Year 0: snapshot of current state (today's fractional age)
  if (years > 0) {
    projectionYears.push({
      year: 0,
      age: currentAge != null ? Math.round(currentAge * 100) / 100 : null,
      starting_portfolio: fi_portfolio_value,
      contributions: 0,
      growth: 0,
      ending_portfolio: fi_portfolio_value,
    });
  }

  // Fraction of the first year remaining (e.g. age 27.4 → 0.6 of the year left)
  const firstYearFraction = currentAge != null ? 1 - (currentAge - Math.floor(currentAge)) : 1;

  // Track account-level contribution scaling
  let accountContribs = account_contributions?.map((a) => ({ ...a }));

  for (let y = 1; y <= years; y++) {
    const startingPortfolio = portfolio;

    // Prorate contributions for the first year
    const prorata = y === 1 ? firstYearFraction : 1;
    const yearContributions = contributions * prorata;
    totalContributions += yearContributions;

    // Growth on starting portfolio + half-year contributions (mid-year approximation)
    // Prorate growth for partial first year
    const growth = (startingPortfolio + yearContributions / 2) * real_return_rate * prorata;
    totalGrowth += growth;

    portfolio = startingPortfolio + yearContributions + growth;

    // Each subsequent year is the next birthday (integer age)
    const yearAge = currentAge != null ? Math.floor(currentAge) + y : null;

    const yearRecord: ProjectionYear = {
      year: y,
      age: yearAge,
      starting_portfolio: startingPortfolio,
      contributions: yearContributions,
      growth,
      ending_portfolio: portfolio,
    };

    // Per-account detail
    if (accountContribs) {
      yearRecord.account_detail = accountContribs.map((a) => ({
        account_id: a.account_id,
        name: a.name,
        contribution: a.yearly_amount * prorata,
      }));
    }

    projectionYears.push(yearRecord);

    // Grow contributions for next year
    if (growthRate > 0) {
      contributions *= 1 + growthRate;
      if (accountContribs) {
        accountContribs = accountContribs.map((a) => ({
          ...a,
          yearly_amount: a.yearly_amount * (1 + growthRate),
        }));
      }
    }
  }

  return {
    years: projectionYears,
    final_portfolio: portfolio,
    total_contributions: totalContributions,
    total_growth: totalGrowth,
  };
}

function resolveContributionGrowthRate(
  mode: ContributionGrowthMode,
  fixedRate: number | null,
  inflationRate: number,
): number {
  switch (mode) {
    case 'inflation':
      return inflationRate;
    case 'fixed_rate':
      return fixedRate ?? 0;
    case 'none':
      return 0;
  }
}
