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

// Onboarding
export function createHousehold(data: Record<string, unknown>) {
  return apiFetch('/api/onboarding', { method: 'POST', body: JSON.stringify(data) });
}

// Settings
export function getHousehold() {
  return apiFetch<Record<string, unknown>>('/api/settings/household');
}

export function getProfile() {
  return apiFetch<Record<string, unknown>>('/api/settings/profile');
}

// Accounts
export function getAccounts(householdId: string) {
  return apiFetch<Record<string, unknown>[]>(`/api/accounts/${householdId}`);
}

export function createAccount(householdId: string, data: Record<string, unknown>) {
  return apiFetch(`/api/accounts/${householdId}`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// Ingest
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
