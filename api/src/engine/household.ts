import type { HouseholdWaterfallInput, HouseholdWaterfall, MemberWaterfall } from './types.js';
import { computeMemberWaterfall } from './waterfall.js';
import { estimateTaxes } from './tax.js';
import { monthlyToAnnual } from './normalize.js';

/**
 * Compute the household-level cashflow waterfall.
 *
 * For joint filing households (married_jointly), taxes are recomputed at the
 * household level using combined taxable income and the joint filing status.
 * For all other statuses, member-level taxes are simply summed.
 */
export function computeHouseholdWaterfall(input: HouseholdWaterfallInput): HouseholdWaterfall {
  // Compute per-member waterfalls first
  const memberWaterfalls = input.members.map(computeMemberWaterfall);

  const isJoint = input.tax_filing_status === 'married_jointly';
  const hasManualTaxOverride = input.members.some(
    (m) => m.tax_mode === 'manual' && m.effective_tax_rate_override != null,
  );

  let members: MemberWaterfall[];

  if (isJoint && !hasManualTaxOverride && memberWaterfalls.length > 1) {
    // Recompute taxes jointly: combine all member incomes
    const combinedTaxableAnnual = memberWaterfalls.reduce(
      (sum, m) => sum + m.taxable_income_annual,
      0,
    );
    const combinedGrossAnnual = memberWaterfalls.reduce((sum, m) => sum + m.total_gross_annual, 0);
    const anySelfEmployed = input.members.some((m) =>
      m.income_sources.some((s) => s.type === 'self_employment'),
    );

    const jointTax = estimateTaxes({
      taxable_income: combinedTaxableAnnual,
      gross_earned_income: combinedGrossAnnual,
      filing_status: 'married_jointly',
      state: input.members[0]?.state ?? null,
      is_self_employed: anySelfEmployed,
    });

    // Distribute joint tax proportionally across members by gross income
    members = memberWaterfalls.map((memberWaterfall) => {
      const proportion =
        combinedGrossAnnual > 0 ? memberWaterfall.total_gross_annual / combinedGrossAnnual : 0;
      const memberTaxAnnual = jointTax.total * proportion;
      const memberTaxMonthly = memberTaxAnnual / 12;

      const netIncomeMonthly =
        memberWaterfall.total_gross_monthly -
        memberWaterfall.total_pre_tax_deductions_monthly -
        memberTaxMonthly;
      const disposableIncomeMonthly =
        netIncomeMonthly - memberWaterfall.total_post_tax_contributions_monthly;
      const residualMonthly = disposableIncomeMonthly - memberWaterfall.total_expenses_monthly;

      return {
        ...memberWaterfall,
        tax_breakdown: {
          federal: jointTax.federal * proportion,
          state: jointTax.state * proportion,
          social_security: jointTax.social_security * proportion,
          medicare: jointTax.medicare * proportion,
          fica_total: jointTax.fica_total * proportion,
          total: memberTaxAnnual,
          effective_rate: jointTax.effective_rate,
        },
        tax_monthly: memberTaxMonthly,
        net_income_monthly: netIncomeMonthly,
        net_income_annual: monthlyToAnnual(netIncomeMonthly),
        disposable_income_monthly: disposableIncomeMonthly,
        residual_monthly: residualMonthly,
        residual_annual: monthlyToAnnual(residualMonthly),
      };
    });
  } else {
    members = memberWaterfalls;
  }

  // Aggregate
  const sumMembers = (fn: (m: MemberWaterfall) => number) => members.reduce((s, m) => s + fn(m), 0);

  const totalGrossMonthly = sumMembers((m) => m.total_gross_monthly);
  const totalPreTaxDeductionsMonthly = sumMembers((m) => m.total_pre_tax_deductions_monthly);
  const totalTaxMonthly = sumMembers((m) => m.tax_monthly);
  const totalNetIncomeMonthly = sumMembers((m) => m.net_income_monthly);
  const totalPostTaxContributionsMonthly = sumMembers(
    (m) => m.total_post_tax_contributions_monthly,
  );
  const totalDisposableIncomeMonthly = sumMembers((m) => m.disposable_income_monthly);
  const totalExpensesMonthly = sumMembers((m) => m.total_expenses_monthly);
  const totalResidualMonthly = sumMembers((m) => m.residual_monthly);

  return {
    members,
    total_gross_monthly: totalGrossMonthly,
    total_gross_annual: monthlyToAnnual(totalGrossMonthly),
    total_pre_tax_deductions_monthly: totalPreTaxDeductionsMonthly,
    total_tax_monthly: totalTaxMonthly,
    total_net_income_monthly: totalNetIncomeMonthly,
    total_post_tax_contributions_monthly: totalPostTaxContributionsMonthly,
    total_disposable_income_monthly: totalDisposableIncomeMonthly,
    total_expenses_monthly: totalExpensesMonthly,
    total_expenses_annual: monthlyToAnnual(totalExpensesMonthly),
    total_residual_monthly: totalResidualMonthly,
    total_residual_annual: monthlyToAnnual(totalResidualMonthly),
  };
}
