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

export function createHousehold(data: Record<string, unknown>) {
  return apiFetch('/api/onboarding', { method: 'POST', body: JSON.stringify(data) });
}

export function acceptInvite(data: Record<string, unknown>) {
  return apiFetch('/api/onboarding/accept-invite', { method: 'POST', body: JSON.stringify(data) });
}

// ── Settings ──

export function getHousehold() {
  return apiFetch<Record<string, unknown>>('/api/settings/household');
}

export function updateHousehold(data: Record<string, unknown>) {
  return apiFetch('/api/settings/household', { method: 'PATCH', body: JSON.stringify(data) });
}

export function getProfile() {
  return apiFetch<Record<string, unknown>>('/api/settings/profile');
}

export function updateProfile(data: Record<string, unknown>) {
  return apiFetch('/api/settings/profile', { method: 'PATCH', body: JSON.stringify(data) });
}

export function getMembers() {
  return apiFetch<Record<string, unknown>[]>('/api/settings/members');
}

export function removeMember(memberId: string) {
  return apiFetch(`/api/settings/members/${memberId}`, { method: 'DELETE' });
}

export function getInvites() {
  return apiFetch<Record<string, unknown>[]>('/api/settings/invites');
}

export function sendInvite(data: { email: string; role?: string }) {
  return apiFetch('/api/settings/invites', { method: 'POST', body: JSON.stringify(data) });
}

export function cancelInvite(inviteId: string) {
  return apiFetch(`/api/settings/invites/${inviteId}`, { method: 'DELETE' });
}

// ── Accounts ──

export function getAccounts(householdId: string) {
  return apiFetch<Record<string, unknown>[]>(`/api/accounts/${householdId}`);
}

export function createAccount(householdId: string, data: Record<string, unknown>) {
  return apiFetch(`/api/accounts/${householdId}`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateAccount(
  householdId: string,
  accountId: string,
  data: Record<string, unknown>,
) {
  return apiFetch(`/api/accounts/${householdId}/${accountId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export function deleteAccount(householdId: string, accountId: string) {
  return apiFetch(`/api/accounts/${householdId}/${accountId}`, { method: 'DELETE' });
}

// ── Sources ──

export function getSources(householdId: string, accountId: string) {
  return apiFetch<Record<string, unknown>[]>(`/api/sources/${householdId}/${accountId}`);
}

export function createSource(
  householdId: string,
  accountId: string,
  data: { provider: string; provider_account_id?: string },
) {
  return apiFetch(`/api/sources/${householdId}/${accountId}`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// ── Ingest ──

export function ingestManual(
  householdId: string,
  accountId: string,
  data: Record<string, unknown>,
) {
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

// ── History (audit trail + balance snapshots) ──

export function getAccountHistory(householdId: string, accountId: string, limit = 50, offset = 0) {
  return apiFetch<Record<string, unknown>[]>(
    `/api/history/${householdId}/${accountId}?limit=${limit}&offset=${offset}`,
  );
}

export function getAccountEvents(householdId: string, accountId: string) {
  return apiFetch<Record<string, unknown>[]>(`/api/history/events/${householdId}/${accountId}`);
}

export function getBalanceHistory(householdId: string, accountId: string) {
  return apiFetch<Record<string, unknown>[]>(`/api/history/balances/${householdId}/${accountId}`);
}

export function getLatestBalance(householdId: string, accountId: string) {
  return apiFetch<Record<string, unknown>>(
    `/api/history/balances/${householdId}/${accountId}/latest`,
  );
}

// ── Duplicates ──

export function getHiddenTransactions(householdId: string, accountId: string) {
  return apiFetch<Record<string, unknown>[]>(
    `/api/duplicates/transactions/${householdId}/${accountId}`,
  );
}

export function getHiddenActivity(householdId: string, accountId: string) {
  return apiFetch<Record<string, unknown>[]>(
    `/api/duplicates/activity/${householdId}/${accountId}`,
  );
}

export function getDuplicatesForReview(householdId: string, accountId: string) {
  return apiFetch<Record<string, unknown>[]>(`/api/duplicates/review/${householdId}/${accountId}`);
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
