import useSWR, { mutate } from 'swr';
import { getHousehold, getAccounts, getProfile, getMembers, getInvites } from './api';

// ── Household ──

export function useHousehold() {
  return useSWR('household', () => getHousehold() as Promise<Record<string, unknown> | null>, {
    revalidateOnFocus: false,
  });
}

export function mutateHousehold() {
  return mutate('household');
}

// ── Accounts (depends on household ID) ──

export function useAccounts() {
  const { data: household } = useHousehold();
  const householdId = (household as Record<string, unknown> | null | undefined)?.id as
    | string
    | undefined;

  const result = useSWR(
    householdId ? ['accounts', householdId] : null,
    ([, id]) => getAccounts(id),
    { revalidateOnFocus: false },
  );

  return { ...result, householdId };
}

export function mutateAccounts() {
  // Invalidate all account keys
  return mutate((key: unknown) => Array.isArray(key) && key[0] === 'accounts');
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
