/**
 * Assembly layer — fetches DB data and wires it into pure engine inputs.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  IncomeSource,
  CashflowItem,
  PlanningScenario,
  ScenarioAssumptions,
  TaxFilingStatus,
  TaxTreatment,
  USState,
  TaxMode,
} from '../types/index.js';
import type {
  WaterfallMemberInput,
  HouseholdWaterfallInput,
  HouseholdWaterfall,
} from '../engine/types.js';
import type { FIMetricsInput } from '../engine/metrics.js';
import type { ProjectionInput, AccountContribution } from '../engine/projections.js';
import type { SavingsRateInput } from '../engine/savings.js';
import { computeHouseholdWaterfall } from '../engine/household.js';
import { toAnnual } from '../engine/normalize.js';
import { resolveItemAnnual } from '../engine/resolve-amount.js';

// ── Default Assumptions ──

const DEFAULT_ASSUMPTIONS: Required<ScenarioAssumptions> = {
  gross_return_rate: 0.09,
  inflation_rate: 0.03,
  real_return_rate: 0.06,
  withdrawal_rate: 0.04,
  retirement_annual_spend_override: null,
  contribution_growth_mode: 'none',
  contribution_growth_rate: null,
};

// ── DB Fetch ──

interface PlanningData {
  members: Array<{
    id: string;
    display_name: string;
    birthday: string | null;
    target_retirement_age: number | null;
    state: string | null;
    tax_mode: string;
    effective_tax_rate_override: number | null;
  }>;
  household: {
    tax_filing_status: TaxFilingStatus | null;
  };
  income_sources: IncomeSource[];
  cashflow_items: CashflowItem[];
  scenario: PlanningScenario;
  fi_portfolio_value: number;
  fi_account_ids: Set<string>;
  /** Map from account ID → tax_treatment for determining pre-tax vs post-tax */
  account_tax_treatments: Map<string, TaxTreatment>;
}

export async function fetchPlanningData(
  db: SupabaseClient,
  householdId: string,
  scenarioId?: string,
): Promise<PlanningData> {
  // Run all queries in parallel
  const [membersRes, householdRes, incomesRes, itemsRes, scenarioRes, accountsRes] =
    await Promise.all([
      db
        .from('member')
        .select(
          'id, display_name, birthday, target_retirement_age, state, tax_mode, effective_tax_rate_override',
        )
        .eq('household_id', householdId),
      db.from('household').select('tax_filing_status').eq('id', householdId).single(),
      db.from('income_source').select('*').eq('household_id', householdId),
      db.from('cashflow_item').select('*').eq('household_id', householdId),
      scenarioId
        ? db
            .from('planning_scenario')
            .select('*')
            .eq('id', scenarioId)
            .eq('household_id', householdId)
            .single()
        : db
            .from('planning_scenario')
            .select('*')
            .eq('household_id', householdId)
            .eq('is_base', true)
            .single(),
      db
        .from('account')
        .select('id, include_in_fi_portfolio, tax_treatment')
        .eq('household_id', householdId)
        .eq('is_active', true),
    ]);

  // Throw on critical errors
  if (membersRes.error) throw new Error(`Failed to fetch members: ${membersRes.error.message}`);
  if (householdRes.error)
    throw new Error(`Failed to fetch household: ${householdRes.error.message}`);
  if (incomesRes.error)
    throw new Error(`Failed to fetch income sources: ${incomesRes.error.message}`);
  if (itemsRes.error) throw new Error(`Failed to fetch cashflow items: ${itemsRes.error.message}`);
  if (accountsRes.error) throw new Error(`Failed to fetch accounts: ${accountsRes.error.message}`);

  // Scenario: auto-create a base scenario if none exists
  let scenario: PlanningScenario;
  if (scenarioRes.data) {
    scenario = scenarioRes.data;
  } else {
    const { data: created, error: createErr } = await db
      .from('planning_scenario')
      .insert({
        household_id: householdId,
        name: 'Base',
        is_base: true,
        assumptions: {},
      })
      .select()
      .single();

    if (createErr || !created) {
      throw new Error(`Failed to create base scenario: ${createErr?.message ?? 'unknown'}`);
    }
    scenario = created;
  }

  // Build account tax_treatment lookup
  const allAccounts = accountsRes.data ?? [];
  const accountTaxTreatments = new Map<string, TaxTreatment>();
  for (const a of allAccounts as {
    id: string;
    include_in_fi_portfolio: boolean;
    tax_treatment: string;
  }[]) {
    accountTaxTreatments.set(a.id, (a.tax_treatment as TaxTreatment) ?? 'none');
  }

  // FI-flagged accounts
  const fiAccounts = allAccounts.filter(
    (a: { id: string; include_in_fi_portfolio: boolean }) => a.include_in_fi_portfolio,
  );
  const fiAccountIds = new Set(fiAccounts.map((a: { id: string }) => a.id));

  // Sum latest balance for FI accounts
  let fiPortfolioValue = 0;
  if (fiAccountIds.size > 0) {
    const { data: balances } = await db.rpc('latest_balances_for_accounts', {
      p_account_ids: Array.from(fiAccountIds),
    });

    if (balances) {
      fiPortfolioValue = balances.reduce(
        (sum: number, b: { balance: number }) => sum + (b.balance ?? 0),
        0,
      );
    } else {
      // Fallback: query balance_snapshot directly
      const { data: snapshots } = await db
        .from('balance_snapshot')
        .select('account_id, balance')
        .in('account_id', Array.from(fiAccountIds))
        .order('date', { ascending: false });

      if (snapshots) {
        // Take latest per account
        const seen = new Set<string>();
        for (const s of snapshots) {
          if (!seen.has(s.account_id)) {
            fiPortfolioValue += s.balance ?? 0;
            seen.add(s.account_id);
          }
        }
      }
    }
  }

  return {
    members: membersRes.data ?? [],
    household: householdRes.data,
    income_sources: incomesRes.data ?? [],
    cashflow_items: itemsRes.data ?? [],
    scenario,
    fi_portfolio_value: fiPortfolioValue,
    fi_account_ids: fiAccountIds,
    account_tax_treatments: accountTaxTreatments,
  };
}

// ── Assembly Helpers ──

export function resolveAssumptions(scenario: PlanningScenario): Required<ScenarioAssumptions> {
  return { ...DEFAULT_ASSUMPTIONS, ...scenario.assumptions };
}

export function assembleWaterfallInput(data: PlanningData): HouseholdWaterfallInput {
  const members: WaterfallMemberInput[] = data.members.map((m) => ({
    id: m.id,
    display_name: m.display_name,
    birthday: m.birthday,
    target_retirement_age: m.target_retirement_age,
    state: (m.state as USState) ?? null,
    tax_mode: (m.tax_mode as TaxMode) ?? 'auto',
    effective_tax_rate_override: m.effective_tax_rate_override,
    income_sources: data.income_sources.filter((s) => s.member_id === m.id),
    cashflow_items: data.cashflow_items.filter(
      (item) => item.member_id === m.id || item.member_id === null,
    ),
    account_tax_treatments: data.account_tax_treatments,
  }));

  return {
    tax_filing_status: data.household.tax_filing_status,
    members,
  };
}

export function computeCurrentAge(birthday: string | null): number | null {
  if (!birthday) return null;
  const birth = new Date(birthday);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const monthDiff = now.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) {
    age--;
  }
  // Add fractional year
  const thisYearBirthday = new Date(now.getFullYear(), birth.getMonth(), birth.getDate());
  if (thisYearBirthday > now) {
    const prevBirthday = new Date(now.getFullYear() - 1, birth.getMonth(), birth.getDate());
    const fraction =
      (now.getTime() - prevBirthday.getTime()) /
      (thisYearBirthday.getTime() - prevBirthday.getTime());
    return age + fraction;
  } else {
    const nextBirthday = new Date(now.getFullYear() + 1, birth.getMonth(), birth.getDate());
    const fraction =
      (now.getTime() - thisYearBirthday.getTime()) /
      (nextBirthday.getTime() - thisYearBirthday.getTime());
    return age + fraction;
  }
}

/** Sum yearly contributions that route to FI-flagged accounts. */
export function computeYearlyFIContributions(
  waterfall: HouseholdWaterfall,
  cashflowItems: CashflowItem[],
  fiAccountIds: Set<string>,
  incomeSources: IncomeSource[],
): number {
  // Saving items that route to FI accounts
  const fiItems = cashflowItems.filter(
    (item) =>
      item.bucket === 'savings' &&
      item.destination_account_id != null &&
      fiAccountIds.has(item.destination_account_id),
  );

  return fiItems.reduce((sum, item) => sum + resolveItemAnnual(item, incomeSources), 0);
}

/** Sum yearly contributions to non-FI savings accounts. */
export function computeYearlySavingsContributions(
  cashflowItems: CashflowItem[],
  fiAccountIds: Set<string>,
  incomeSources: IncomeSource[],
): number {
  const savingsItems = cashflowItems.filter(
    (item) =>
      item.bucket === 'savings' &&
      item.destination_account_id != null &&
      !fiAccountIds.has(item.destination_account_id),
  );

  return savingsItems.reduce((sum, item) => sum + resolveItemAnnual(item, incomeSources), 0);
}

/** Build FI metrics input from waterfall + planning data. */
export function assembleFIMetricsInput(
  waterfall: HouseholdWaterfall,
  data: PlanningData,
  assumptions: Required<ScenarioAssumptions>,
): FIMetricsInput | null {
  // Use primary member (first) for age-based metrics
  const primaryMember = data.members[0];
  if (!primaryMember) return null;

  const currentAge = computeCurrentAge(primaryMember.birthday);
  if (currentAge == null) return null;

  const desiredRetirementAge = primaryMember.target_retirement_age ?? 65;
  const yearlyContributions = computeYearlyFIContributions(
    waterfall,
    data.cashflow_items,
    data.fi_account_ids,
    data.income_sources,
  );
  const retirementSpend =
    assumptions.retirement_annual_spend_override ?? waterfall.total_expenses_annual;

  return {
    fi_portfolio_value: data.fi_portfolio_value,
    yearly_contributions: yearlyContributions,
    yearly_expenses: waterfall.total_expenses_annual,
    real_return_rate: assumptions.real_return_rate,
    withdrawal_rate: assumptions.withdrawal_rate,
    current_age: currentAge,
    desired_retirement_age: desiredRetirementAge,
    retirement_annual_spend: retirementSpend,
  };
}

/** Build projection input from waterfall + planning data. */
export function assembleProjectionInput(
  waterfall: HouseholdWaterfall,
  data: PlanningData,
  assumptions: Required<ScenarioAssumptions>,
): ProjectionInput {
  const primaryMember = data.members[0];
  const currentAge = primaryMember ? computeCurrentAge(primaryMember.birthday) : null;
  const desiredRetirementAge = primaryMember?.target_retirement_age ?? 65;
  const projectionYears =
    currentAge != null ? Math.max(1, Math.ceil(desiredRetirementAge - currentAge + 10)) : 30;

  const yearlyContributions = computeYearlyFIContributions(
    waterfall,
    data.cashflow_items,
    data.fi_account_ids,
    data.income_sources,
  );

  // Per-account contribution routing
  const accountMap = new Map<string, { account_id: string; name: string; total: number }>();

  for (const item of data.cashflow_items) {
    if (
      item.bucket === 'savings' &&
      item.destination_account_id &&
      data.fi_account_ids.has(item.destination_account_id)
    ) {
      const existing = accountMap.get(item.destination_account_id);
      const annual = resolveItemAnnual(item, data.income_sources);
      if (existing) {
        existing.total += annual;
      } else {
        accountMap.set(item.destination_account_id, {
          account_id: item.destination_account_id,
          name: item.name,
          total: annual,
        });
      }
    }
  }

  const accountContributions: AccountContribution[] = Array.from(accountMap.values()).map((a) => ({
    account_id: a.account_id,
    name: a.name,
    yearly_amount: a.total,
  }));

  return {
    fi_portfolio_value: data.fi_portfolio_value,
    yearly_contributions: yearlyContributions,
    real_return_rate: assumptions.real_return_rate,
    inflation_rate: assumptions.inflation_rate,
    years: projectionYears,
    contribution_growth_mode: assumptions.contribution_growth_mode,
    contribution_growth_rate: assumptions.contribution_growth_rate,
    account_contributions: accountContributions.length > 0 ? accountContributions : undefined,
  };
}

/** Build savings rate input from waterfall + planning data. */
export function assembleSavingsRateInput(
  waterfall: HouseholdWaterfall,
  data: PlanningData,
): SavingsRateInput {
  return {
    total_gross_annual: waterfall.total_gross_annual,
    yearly_investment_contributions: computeYearlyFIContributions(
      waterfall,
      data.cashflow_items,
      data.fi_account_ids,
      data.income_sources,
    ),
    yearly_savings_contributions: computeYearlySavingsContributions(
      data.cashflow_items,
      data.fi_account_ids,
      data.income_sources,
    ),
  };
}
