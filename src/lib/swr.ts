import useSWR, { mutate } from 'swr';
import {
  getHousehold,
  getAccounts,
  getAccountDetail,
  getHouseholdHoldings,
  getNetWorthHistory,
  getInvestmentHistory,
  getProfile,
  getMembers,
  getInvites,
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
