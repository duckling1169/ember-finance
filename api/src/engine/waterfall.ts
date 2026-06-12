import type { CashflowItem } from '../types/index.js';
import type {
  WaterfallMemberInput,
  MemberWaterfall,
  IncomeSourceSummary,
  ContributionSummary,
  TaxBreakdown,
  TaxParams,
} from './types.js';
import { toMonthly, monthlyToAnnual } from './normalize.js';
import { resolveItemMonthly } from './resolve-amount.js';
import { estimateTaxes } from './tax.js';

/**
 * Compute the per-member cashflow waterfall.
 *
 * Flow: gross inflows → pre-tax deductions → taxable income → taxes →
 *       net income → post-tax contributions → disposable income →
 *       expenses → residual
 */
export function computeMemberWaterfall(
  member: WaterfallMemberInput,
  taxParams: TaxParams,
): MemberWaterfall {
  // 1. Gross inflows — sum all active income sources, normalized to monthly
  const incomeSources = member.income_sources.filter((source) => source.is_active);
  const totalGrossMonthly = incomeSources.reduce(
    (sum, source) => sum + toMonthly(source.gross_amount, source.frequency),
    0,
  );

  // 2. Pre-tax deductions — saving items whose destination account has tax_treatment === 'pre_tax'
  const isPreTaxSaving = (item: CashflowItem) =>
    item.bucket === 'savings' &&
    item.destination_account_id != null &&
    member.account_tax_treatments.get(item.destination_account_id) === 'pre_tax';

  const preTaxItems = member.cashflow_items.filter(
    (item) => isPreTaxSaving(item) && item.income_source_id != null,
  );

  // Build per-income-source summaries
  const incomeSourceSummaries: IncomeSourceSummary[] = incomeSources.map((source) => {
    const grossMonthly = toMonthly(source.gross_amount, source.frequency);
    const deductions = preTaxItems
      .filter((item) => item.income_source_id === source.id)
      .reduce((sum, item) => sum + resolveItemMonthly(item, incomeSources), 0);

    return {
      income_source_id: source.id,
      name: source.name,
      gross_monthly: grossMonthly,
      pre_tax_deductions_monthly: deductions,
      taxable_from_source: grossMonthly - deductions,
    };
  });

  const totalPreTaxDeductionsMonthly = incomeSourceSummaries.reduce(
    (sum, source) => sum + source.pre_tax_deductions_monthly,
    0,
  );

  // Also include pre-tax items NOT linked to a specific income source
  const unlinkedPreTaxMonthly = member.cashflow_items
    .filter((item) => isPreTaxSaving(item) && item.income_source_id == null)
    .reduce((sum, item) => sum + resolveItemMonthly(item, incomeSources), 0);

  const allPreTaxDeductionsMonthly = totalPreTaxDeductionsMonthly + unlinkedPreTaxMonthly;

  // 3. Taxable income
  const taxableIncomeAnnual = monthlyToAnnual(totalGrossMonthly - allPreTaxDeductionsMonthly);

  // 4. Tax computation
  let taxBreakdown: TaxBreakdown;
  let taxMonthly: number;

  if (member.tax_mode === 'manual' && member.effective_tax_rate_override != null) {
    // Manual mode: apply flat effective rate
    const rate = member.effective_tax_rate_override;
    const totalTaxAnnual = taxableIncomeAnnual * rate;
    taxMonthly = totalTaxAnnual / 12;
    taxBreakdown = {
      federal: 0,
      state: 0,
      social_security: 0,
      medicare: 0,
      fica_total: 0,
      total: totalTaxAnnual,
      effective_rate: rate,
      tax_year: null,
    };
  } else {
    // Auto mode: full estimation
    const grossEarnedIncomeAnnual = monthlyToAnnual(totalGrossMonthly);
    const isSelfEmployed = incomeSources.some((source) => source.type === 'self_employment');

    taxBreakdown = estimateTaxes(
      {
        taxable_income: taxableIncomeAnnual,
        gross_earned_income: grossEarnedIncomeAnnual,
        filing_status: 'single', // per-member is always single; household handles joint
        state: member.state,
        is_self_employed: isSelfEmployed,
      },
      taxParams,
    );
    taxMonthly = taxBreakdown.total / 12;
  }

  // 5. Net income
  const netIncomeMonthly = totalGrossMonthly - allPreTaxDeductionsMonthly - taxMonthly;

  // 6. Post-tax contributions — saving items that are NOT pre-tax
  const postTaxItems = member.cashflow_items.filter(
    (item) => item.bucket === 'savings' && !isPreTaxSaving(item),
  );
  const postTaxContributions: ContributionSummary[] = postTaxItems.map((item) => ({
    cashflow_item_id: item.id,
    name: item.name,
    monthly: resolveItemMonthly(item, incomeSources),
    destination_account_id: item.destination_account_id,
  }));
  const totalPostTaxContributionsMonthly = postTaxContributions.reduce(
    (sum, c) => sum + c.monthly,
    0,
  );

  // 7. Disposable income
  const disposableIncomeMonthly = netIncomeMonthly - totalPostTaxContributionsMonthly;

  // 8. Expenses
  const expenseItems = member.cashflow_items.filter((item) => item.bucket === 'expense');
  const totalExpensesMonthly = expenseItems.reduce(
    (sum, item) => sum + resolveItemMonthly(item, incomeSources),
    0,
  );

  // 9. Residual
  const residualMonthly = disposableIncomeMonthly - totalExpensesMonthly;

  return {
    member_id: member.id,
    display_name: member.display_name,

    total_gross_monthly: totalGrossMonthly,
    total_gross_annual: monthlyToAnnual(totalGrossMonthly),

    income_sources: incomeSourceSummaries,
    total_pre_tax_deductions_monthly: allPreTaxDeductionsMonthly,

    taxable_income_annual: taxableIncomeAnnual,
    tax_breakdown: taxBreakdown,
    tax_monthly: taxMonthly,

    net_income_monthly: netIncomeMonthly,
    net_income_annual: monthlyToAnnual(netIncomeMonthly),

    post_tax_contributions: postTaxContributions,
    total_post_tax_contributions_monthly: totalPostTaxContributionsMonthly,

    disposable_income_monthly: disposableIncomeMonthly,

    total_expenses_monthly: totalExpensesMonthly,
    total_expenses_annual: monthlyToAnnual(totalExpensesMonthly),

    residual_monthly: residualMonthly,
    residual_annual: monthlyToAnnual(residualMonthly),
  };
}
