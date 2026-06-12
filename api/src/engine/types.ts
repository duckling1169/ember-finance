import type {
  CashflowItem,
  IncomeSource,
  TaxFilingStatus,
  TaxTreatment,
  USState,
  TaxMode,
} from '../types/index.js';

// ── Engine Input Types ──

/** Member data needed by the waterfall engine */
export interface WaterfallMemberInput {
  id: string;
  display_name: string;
  birthday: string | null;
  target_retirement_age: number | null;
  state: USState | null;
  tax_mode: TaxMode;
  effective_tax_rate_override: number | null;
  income_sources: IncomeSource[];
  cashflow_items: CashflowItem[];
  /** Map from account ID → tax_treatment, used to determine pre-tax vs post-tax savings */
  account_tax_treatments: Map<string, TaxTreatment>;
}

/** Household-level inputs for aggregation */
export interface HouseholdWaterfallInput {
  tax_filing_status: TaxFilingStatus | null;
  members: WaterfallMemberInput[];
  /** Versioned tax tables resolved from the assumptions system */
  tax_params: TaxParams;
}

// ── Cadence Normalization ──

export type NormalizedPeriod = 'monthly' | 'annual';

// ── Tax Engine Types ──

export interface TaxInput {
  taxable_income: number;
  gross_earned_income: number; // for FICA (W-2 / self-employment wages)
  filing_status: TaxFilingStatus;
  state: USState | null;
  is_self_employed?: boolean;
}

export interface TaxBreakdown {
  federal: number;
  state: number;
  social_security: number;
  medicare: number;
  fica_total: number;
  total: number;
  effective_rate: number;
  /** Tax-table year the figures were computed with; null for manual flat-rate overrides */
  tax_year: number | null;
}

export interface FederalBracket {
  min: number;
  /** null = no upper bound (top bracket) */
  max: number | null;
  rate: number;
}

export interface FICAParams {
  ss_rate: number;
  ss_wage_cap: number;
  medicare_rate: number;
  medicare_surtax_rate: number;
  medicare_surtax_threshold: Record<TaxFilingStatus, number>;
}

/**
 * Versioned tax tables. Built from assumption values
 * (`tax.federal_brackets`, `tax.standard_deduction`, `tax.fica`,
 * `tax.state_rates`) by `buildTaxParams` — never hardcoded.
 */
export interface TaxParams {
  /** Headline tax year (from the federal bracket table) */
  year: number;
  federal_brackets: Record<TaxFilingStatus, FederalBracket[]>;
  standard_deduction: Record<TaxFilingStatus, number>;
  fica: FICAParams;
  state_rates: Partial<Record<USState, number>>;
}

// ── Waterfall Output Types ──

export interface IncomeSourceSummary {
  income_source_id: string;
  name: string;
  gross_monthly: number;
  pre_tax_deductions_monthly: number;
  taxable_from_source: number;
}

export interface ContributionSummary {
  cashflow_item_id: string;
  name: string;
  monthly: number;
  destination_account_id: string | null;
}

export interface MemberWaterfall {
  member_id: string;
  display_name: string;

  // Gross
  total_gross_monthly: number;
  total_gross_annual: number;

  // Pre-tax deductions (by income source)
  income_sources: IncomeSourceSummary[];
  total_pre_tax_deductions_monthly: number;

  // Tax
  taxable_income_annual: number;
  tax_breakdown: TaxBreakdown;
  tax_monthly: number;

  // Net
  net_income_monthly: number;
  net_income_annual: number;

  // Post-tax contributions
  post_tax_contributions: ContributionSummary[];
  total_post_tax_contributions_monthly: number;

  // Disposable
  disposable_income_monthly: number;

  // Expenses
  total_expenses_monthly: number;
  total_expenses_annual: number;

  // Residual
  residual_monthly: number;
  residual_annual: number;
}

export interface HouseholdWaterfall {
  members: MemberWaterfall[];

  // Household aggregates
  total_gross_monthly: number;
  total_gross_annual: number;
  total_pre_tax_deductions_monthly: number;
  total_tax_monthly: number;
  total_net_income_monthly: number;
  total_post_tax_contributions_monthly: number;
  total_disposable_income_monthly: number;
  total_expenses_monthly: number;
  total_expenses_annual: number;
  total_residual_monthly: number;
  total_residual_annual: number;
}
