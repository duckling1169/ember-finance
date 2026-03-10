import type {
  Household,
  Member,
  MemberSummary,
  HouseholdInvite,
  Account,
  EnrichedAccount,
  AccountDetailResponse,
  CurrentPosition,
  TaxLot,
  BalanceSnapshot,
  AccountTimelineEvent,
  HouseholdHoldingsResponse,
  CreateHouseholdInput,
  AcceptInviteInput,
  UpdateHouseholdInput,
  UpdateProfileInput,
  CreateAccountInput,
  UpdateAccountInput,
  ManualIngestInput,
  Transaction,
  InvestmentActivity,
} from '@shared/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

async function getToken(): Promise<string | null> {
  // Import dynamically to avoid circular deps
  const { supabase } = await import('./supabase');
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `API error ${res.status}`);
  }
  return res.json();
}

// ── Onboarding ──

export function createHousehold(data: CreateHouseholdInput) {
  return apiFetch('/api/onboarding', { method: 'POST', body: JSON.stringify(data) });
}

export function acceptInvite(data: AcceptInviteInput) {
  return apiFetch('/api/onboarding/accept-invite', { method: 'POST', body: JSON.stringify(data) });
}

// ── Settings ──

export function getHousehold() {
  return apiFetch<Household>('/api/settings/household');
}

export function updateHousehold(data: UpdateHouseholdInput) {
  return apiFetch<Household>('/api/settings/household', {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export function getProfile() {
  return apiFetch<Member>('/api/settings/profile');
}

export function updateProfile(data: UpdateProfileInput) {
  return apiFetch<Member>('/api/settings/profile', {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export function getMembers() {
  return apiFetch<MemberSummary[]>('/api/settings/members');
}

export function removeMember(memberId: string) {
  return apiFetch(`/api/settings/members/${memberId}`, { method: 'DELETE' });
}

export function getInvites() {
  return apiFetch<HouseholdInvite[]>('/api/settings/invites');
}

export function sendInvite(data: { email: string; role?: string }) {
  return apiFetch('/api/settings/invites', { method: 'POST', body: JSON.stringify(data) });
}

export function cancelInvite(inviteId: string) {
  return apiFetch(`/api/settings/invites/${inviteId}`, { method: 'DELETE' });
}

// ── Accounts ──

export function getAccounts(householdId: string) {
  return apiFetch<EnrichedAccount[]>(`/api/accounts/${householdId}`);
}

export function getAccountDetail(householdId: string, accountId: string) {
  return apiFetch<AccountDetailResponse>(`/api/accounts/${householdId}/${accountId}`);
}

export function getAccountHoldings(householdId: string, accountId: string) {
  return apiFetch<CurrentPosition[]>(`/api/accounts/${householdId}/${accountId}/holdings`);
}

export function getAccountLots(householdId: string, accountId: string) {
  return apiFetch<TaxLot[]>(`/api/accounts/${householdId}/${accountId}/lots`);
}

export function getAccountBalances(householdId: string, accountId: string) {
  return apiFetch<BalanceSnapshot[]>(`/api/accounts/${householdId}/${accountId}/balances`);
}

export function getAccountHistory(householdId: string, accountId: string, limit = 50, offset = 0) {
  return apiFetch<AccountTimelineEvent[]>(
    `/api/accounts/${householdId}/${accountId}/history?limit=${limit}&offset=${offset}`,
  );
}

export function getHouseholdHoldings(householdId: string) {
  return apiFetch<HouseholdHoldingsResponse>(`/api/holdings/${householdId}`);
}

export function createAccount(householdId: string, data: CreateAccountInput) {
  return apiFetch<Account>(`/api/accounts/${householdId}`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateAccount(householdId: string, accountId: string, data: UpdateAccountInput) {
  return apiFetch<Account>(`/api/accounts/${householdId}/${accountId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export function deleteAccount(householdId: string, accountId: string) {
  return apiFetch(`/api/accounts/${householdId}/${accountId}`, { method: 'DELETE' });
}

// ── Ingest ──

export function ingestManual(householdId: string, accountId: string, data: ManualIngestInput) {
  return apiFetch(`/api/ingest/manual/${householdId}/${accountId}`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function ingestCsv(
  householdId: string,
  accountId: string,
  file: File,
  format?: string,
) {
  const token = await getToken();
  const formData = new FormData();
  formData.append('file', file);
  if (format) formData.append('format', format);

  const res = await fetch(`${API_URL}/api/ingest/csv/${householdId}/${accountId}`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Upload failed: ${res.status}`);
  }
  return res.json();
}

export function syncSource(householdId: string, sourceId: string) {
  return apiFetch(`/api/ingest/sync/${householdId}/${sourceId}`, { method: 'POST' });
}

// ── Duplicates ──

export function getHiddenTransactions(householdId: string, accountId: string) {
  return apiFetch<Transaction[]>(`/api/duplicates/transactions/${householdId}/${accountId}`);
}

export function getHiddenActivity(householdId: string, accountId: string) {
  return apiFetch<InvestmentActivity[]>(`/api/duplicates/activity/${householdId}/${accountId}`);
}

export function getDuplicatesForReview(householdId: string, accountId: string) {
  return apiFetch<(Transaction | InvestmentActivity)[]>(
    `/api/duplicates/review/${householdId}/${accountId}`,
  );
}

export function hideTransaction(id: string, reason?: string) {
  return apiFetch(`/api/duplicates/hide/transaction/${id}`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

export function unhideTransaction(id: string) {
  return apiFetch(`/api/duplicates/unhide/transaction/${id}`, { method: 'POST' });
}

export function hideActivity(id: string, reason?: string) {
  return apiFetch(`/api/duplicates/hide/activity/${id}`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

export function unhideActivity(id: string) {
  return apiFetch(`/api/duplicates/unhide/activity/${id}`, { method: 'POST' });
}
