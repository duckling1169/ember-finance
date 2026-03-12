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
  IncomeSource,
  CashflowItem,
  PlanningScenario,
  CreateIncomeSourceInput,
  UpdateIncomeSourceInput,
  CreateCashflowItemInput,
  UpdateCashflowItemInput,
  CreatePlanningScenarioInput,
  UpdatePlanningScenarioInput,
  CashflowSummaryResponse,
  MetricsResponse,
  ProjectionResponse,
  ExpenseCategory,
  CreateExpenseCategoryInput,
  UpdateExpenseCategoryInput,
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

export function getNetWorthHistory(householdId: string, from?: string, to?: string) {
  const params = new URLSearchParams();
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  const qs = params.toString();
  return apiFetch<{ date: string; value: number }[]>(
    `/api/accounts/${householdId}/history/net-worth${qs ? `?${qs}` : ''}`,
  );
}

export function getInvestmentHistory(householdId: string, from?: string, to?: string) {
  const params = new URLSearchParams();
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  const qs = params.toString();
  return apiFetch<{ date: string; value: number }[]>(
    `/api/accounts/${householdId}/history/investments${qs ? `?${qs}` : ''}`,
  );
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

// ── Activity ──

export function getTransactions(
  householdId: string,
  params?: { accountId?: string; from?: string; to?: string; limit?: number; offset?: number },
) {
  const search = new URLSearchParams();
  if (params?.accountId) search.set('accountId', params.accountId);
  if (params?.from) search.set('from', params.from);
  if (params?.to) search.set('to', params.to);
  if (params?.limit) search.set('limit', String(params.limit));
  if (params?.offset) search.set('offset', String(params.offset));
  const qs = search.toString();
  return apiFetch<Transaction[]>(`/api/activity/transactions/${householdId}${qs ? `?${qs}` : ''}`);
}

export function getInvestmentActivity(
  householdId: string,
  params?: {
    accountId?: string;
    from?: string;
    to?: string;
    symbol?: string;
    activityType?: string;
    limit?: number;
    offset?: number;
  },
) {
  const search = new URLSearchParams();
  if (params?.accountId) search.set('accountId', params.accountId);
  if (params?.from) search.set('from', params.from);
  if (params?.to) search.set('to', params.to);
  if (params?.symbol) search.set('symbol', params.symbol);
  if (params?.activityType) search.set('activityType', params.activityType);
  if (params?.limit) search.set('limit', String(params.limit));
  if (params?.offset) search.set('offset', String(params.offset));
  const qs = search.toString();
  return apiFetch<InvestmentActivity[]>(
    `/api/activity/investments/${householdId}${qs ? `?${qs}` : ''}`,
  );
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

// ── Planning: Income Sources ──

export function getIncomeSources(memberId?: string) {
  const qs = memberId ? `?member_id=${memberId}` : '';
  return apiFetch<IncomeSource[]>(`/api/planning/income-sources${qs}`);
}

export function createIncomeSource(data: CreateIncomeSourceInput) {
  return apiFetch<IncomeSource>('/api/planning/income-sources', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateIncomeSource(sourceId: string, data: UpdateIncomeSourceInput) {
  return apiFetch<IncomeSource>(`/api/planning/income-sources/${sourceId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export function deleteIncomeSource(sourceId: string) {
  return apiFetch(`/api/planning/income-sources/${sourceId}`, { method: 'DELETE' });
}

// ── Planning: Flows ──

export function getCashflowItems(memberId?: string) {
  const qs = memberId ? `?member_id=${memberId}` : '';
  return apiFetch<CashflowItem[]>(`/api/planning/flows${qs}`);
}

export function createCashflowItem(data: CreateCashflowItemInput) {
  return apiFetch<CashflowItem>('/api/planning/flows', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateCashflowItem(itemId: string, data: UpdateCashflowItemInput) {
  return apiFetch<CashflowItem>(`/api/planning/flows/${itemId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export function deleteCashflowItem(itemId: string) {
  return apiFetch(`/api/planning/flows/${itemId}`, { method: 'DELETE' });
}

// ── Planning: Expense Categories ──

export function getExpenseCategories() {
  return apiFetch<ExpenseCategory[]>('/api/planning/expense-categories');
}

export function createExpenseCategory(data: CreateExpenseCategoryInput) {
  return apiFetch<ExpenseCategory>('/api/planning/expense-categories', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateExpenseCategory(categoryId: string, data: UpdateExpenseCategoryInput) {
  return apiFetch<ExpenseCategory>(`/api/planning/expense-categories/${categoryId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export function deleteExpenseCategory(categoryId: string) {
  return apiFetch(`/api/planning/expense-categories/${categoryId}`, { method: 'DELETE' });
}

// ── Planning: Scenarios ──

export function getScenarios() {
  return apiFetch<PlanningScenario[]>('/api/planning/scenarios');
}

export function createScenario(data: CreatePlanningScenarioInput) {
  return apiFetch<PlanningScenario>('/api/planning/scenarios', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateScenario(scenarioId: string, data: UpdatePlanningScenarioInput) {
  return apiFetch<PlanningScenario>(`/api/planning/scenarios/${scenarioId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

// ── Planning: Computed Endpoints ──

export function getCashflowSummary(scenarioId?: string) {
  const qs = scenarioId ? `?scenario_id=${scenarioId}` : '';
  return apiFetch<CashflowSummaryResponse>(`/api/planning/cashflow-summary${qs}`);
}

export function getProjections(scenarioId?: string) {
  const qs = scenarioId ? `?scenario_id=${scenarioId}` : '';
  return apiFetch<ProjectionResponse>(`/api/planning/projections${qs}`);
}

export function getMetrics(scenarioId?: string) {
  const qs = scenarioId ? `?scenario_id=${scenarioId}` : '';
  return apiFetch<MetricsResponse>(`/api/planning/metrics${qs}`);
}
