import useSWR, { mutate } from 'swr';
import {
  getHousehold,
  getAccounts,
  getAccountDetail,
  getHouseholdHoldings,
  getNetWorthHistory,
  getInvestmentHistory,
  getTransactions,
  getInvestmentActivity,
  getProfile,
  getMembers,
  getInvites,
  getIncomeSources,
  getCashflowItems,
  getScenarios,
  getCashflowSummary,
  getProjections,
  getMetrics,
  getExpenseCategories,
} from './api';
import type { Household } from '@shared/types';

// ── Household ──

export function useHousehold() {
  return useSWR('household', () => getHousehold() as Promise<Household | null>, {
    revalidateOnFocus: false,
  });
}

export function mutateHousehold() {
  return mutate('household');
}

// Helper to extract householdId from the household hook
function useHouseholdId() {
  const { data } = useHousehold();
  return data?.id;
}

// ── Accounts (enriched list — depends on household ID) ──

export function useAccounts() {
  const householdId = useHouseholdId();

  const result = useSWR(
    householdId ? ['accounts', householdId] : null,
    ([, id]) => getAccounts(id),
    { revalidateOnFocus: false },
  );

  return { ...result, householdId };
}

export function mutateAccounts() {
  return mutate((key: unknown) => Array.isArray(key) && key[0] === 'accounts');
}

// ── Account detail (full picture for a single account) ──

export function useAccountDetail(accountId: string | undefined) {
  const householdId = useHouseholdId();

  return useSWR(
    householdId && accountId ? ['account-detail', householdId, accountId] : null,
    ([, hhId, acctId]) => getAccountDetail(hhId, acctId),
    { revalidateOnFocus: false },
  );
}

export function mutateAccountDetail(accountId: string) {
  return mutate(
    (key: unknown) => Array.isArray(key) && key[0] === 'account-detail' && key[2] === accountId,
  );
}

// ── Household history (net worth / investments over time) ──

export function useNetWorthHistory(from?: string, to?: string) {
  const householdId = useHouseholdId();

  return useSWR(
    householdId ? ['net-worth-history', householdId, from, to] : null,
    ([, id, f, t]) => getNetWorthHistory(id, f || undefined, t || undefined),
    { revalidateOnFocus: false },
  );
}

export function useInvestmentHistory(from?: string, to?: string) {
  const householdId = useHouseholdId();

  return useSWR(
    householdId ? ['investment-history', householdId, from, to] : null,
    ([, id, f, t]) => getInvestmentHistory(id, f || undefined, t || undefined),
    { revalidateOnFocus: false },
  );
}

// ── Household holdings (cross-account) ──

export function useHouseholdHoldings() {
  const householdId = useHouseholdId();

  return useSWR(
    householdId ? ['holdings', householdId] : null,
    ([, id]) => getHouseholdHoldings(id),
    { revalidateOnFocus: false },
  );
}

// ── Activity (transactions + investment activity) ──

export function useTransactions(params?: {
  accountId?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}) {
  const householdId = useHouseholdId();
  const key = householdId ? ['transactions', householdId, JSON.stringify(params)] : null;

  return useSWR(key, ([, id]) => getTransactions(id, params), {
    revalidateOnFocus: false,
  });
}

export function useInvestmentActivity(params?: {
  accountId?: string;
  from?: string;
  to?: string;
  symbol?: string;
  activityType?: string;
  limit?: number;
  offset?: number;
}) {
  const householdId = useHouseholdId();
  const key = householdId ? ['investment-activity', householdId, JSON.stringify(params)] : null;

  return useSWR(key, ([, id]) => getInvestmentActivity(id, params), {
    revalidateOnFocus: false,
  });
}

export function mutateActivity() {
  return Promise.all([
    mutate((key: unknown) => Array.isArray(key) && key[0] === 'transactions'),
    mutate((key: unknown) => Array.isArray(key) && key[0] === 'investment-activity'),
  ]);
}

// ── Profile ──

export function useProfile() {
  return useSWR('profile', () => getProfile(), {
    revalidateOnFocus: false,
  });
}

export function mutateProfile() {
  return mutate('profile');
}

// ── Members ──

export function useMembers() {
  return useSWR('members', () => getMembers(), {
    revalidateOnFocus: false,
  });
}

export function mutateMembers() {
  return mutate('members');
}

// ── Invites ──

export function useInvites() {
  return useSWR('invites', () => getInvites(), {
    revalidateOnFocus: false,
  });
}

export function mutateInvites() {
  return mutate('invites');
}

// ── Planning: Income Sources ──

export function useIncomeSources(memberId?: string) {
  return useSWR(['income-sources', memberId ?? 'all'], () => getIncomeSources(memberId), {
    revalidateOnFocus: false,
  });
}

export function mutateIncomeSources() {
  return mutate((key: unknown) => Array.isArray(key) && key[0] === 'income-sources');
}

// ── Planning: Expense Categories ──

export function useExpenseCategories() {
  return useSWR('expense-categories', () => getExpenseCategories(), {
    revalidateOnFocus: false,
  });
}

export function mutateExpenseCategories() {
  return mutate('expense-categories');
}

// ── Planning: Cashflow Items ──

export function useCashflowItems(memberId?: string) {
  return useSWR(['cashflow-items', memberId ?? 'all'], () => getCashflowItems(memberId), {
    revalidateOnFocus: false,
  });
}

export function mutateCashflowItems() {
  return mutate((key: unknown) => Array.isArray(key) && key[0] === 'cashflow-items');
}

// ── Planning: Scenarios ──

export function useScenarios() {
  return useSWR('scenarios', () => getScenarios(), { revalidateOnFocus: false });
}

export function mutateScenarios() {
  return mutate('scenarios');
}

// ── Planning: Computed (read-only) ──

export function useCashflowSummary(scenarioId?: string) {
  return useSWR(['cashflow-summary', scenarioId ?? 'base'], () => getCashflowSummary(scenarioId), {
    revalidateOnFocus: false,
  });
}

export function useProjections(scenarioId?: string) {
  return useSWR(['projections', scenarioId ?? 'base'], () => getProjections(scenarioId), {
    revalidateOnFocus: false,
  });
}

export function useMetrics(scenarioId?: string) {
  return useSWR(['metrics', scenarioId ?? 'base'], () => getMetrics(scenarioId), {
    revalidateOnFocus: false,
  });
}

/** Invalidate all computed planning endpoints (after CRUD on income sources or cashflow items) */
export function mutatePlanningComputed() {
  return Promise.all([
    mutate((key: unknown) => Array.isArray(key) && key[0] === 'cashflow-summary'),
    mutate((key: unknown) => Array.isArray(key) && key[0] === 'projections'),
    mutate((key: unknown) => Array.isArray(key) && key[0] === 'metrics'),
  ]);
}
