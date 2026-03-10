// Mock data for dev bypass mode — used when NEXT_PUBLIC_DEV_BYPASS_AUTH=true
//
// Shapes mirror the real DB types from shared/types.
// - Account: core record from `account` table
// - AccountSource: from `account_source` table (tracks providers/links)
// - BalanceSnapshot: from `balance_snapshot` table
// - RawIngest: from `raw_ingest` table (audit trail)
//
// The frontend composes these into enriched views (balance, linked status, etc.)

// ── Accounts (matches DB `account` table + meta for tax_bucket/notes) ──

export const mockAccounts = [
  {
    id: 'mock-1',
    household_id: 'mock-household',
    name: 'Fidelity 401(k)',
    institution: 'Fidelity',
    account_type: 'retirement',
    currency: 'USD',
    meta: { tax_bucket: 'traditional', notes: 'Employer match 4%' },
    is_active: true,
    is_liability: false,
    created_at: '2026-01-10T13:45:00Z',
  },
  {
    id: 'mock-2',
    household_id: 'mock-household',
    name: 'Chase Checking',
    institution: 'Chase',
    account_type: 'checking',
    currency: 'USD',
    meta: { tax_bucket: 'taxable', notes: '' },
    is_active: true,
    is_liability: false,
    created_at: '2026-02-01T08:50:00Z',
  },
  {
    id: 'mock-3',
    household_id: 'mock-household',
    name: 'Vanguard Brokerage',
    institution: 'Vanguard',
    account_type: 'brokerage',
    currency: 'USD',
    meta: { tax_bucket: 'taxable', notes: '' },
    is_active: true,
    is_liability: false,
    created_at: '2025-12-20T10:00:00Z',
  },
  {
    id: 'mock-4',
    household_id: 'mock-household',
    name: 'Schwab Roth IRA',
    institution: 'Schwab',
    account_type: 'retirement',
    currency: 'USD',
    meta: { tax_bucket: 'roth', notes: '' },
    is_active: true,
    is_liability: false,
    created_at: '2026-01-20T10:00:00Z',
  },
  {
    id: 'mock-5',
    household_id: 'mock-household',
    name: 'Amex Platinum',
    institution: 'American Express',
    account_type: 'credit',
    currency: 'USD',
    meta: { tax_bucket: 'none', notes: 'Annual fee due July' },
    is_active: true,
    is_liability: true,
    created_at: '2026-01-15T12:00:00Z',
  },
  {
    id: 'mock-6',
    household_id: 'mock-household',
    name: 'Marcus Savings',
    institution: 'Goldman Sachs',
    account_type: 'savings',
    currency: 'USD',
    meta: { tax_bucket: 'taxable', notes: 'Emergency fund' },
    is_active: true,
    is_liability: false,
    created_at: '2025-12-01T09:00:00Z',
  },
];

// ── Account Sources (matches DB `account_source` table) ──

export const mockSources: Record<
  string,
  {
    id: string;
    account_id: string;
    provider: string;
    is_active: boolean;
    last_synced: string | null;
    created_at: string;
  }[]
> = {
  'mock-1': [
    {
      id: 'src-1a',
      account_id: 'mock-1',
      provider: 'csv',
      is_active: true,
      last_synced: '2026-01-10T14:00:00Z',
      created_at: '2026-01-10T14:00:00Z',
    },
    {
      id: 'src-1b',
      account_id: 'mock-1',
      provider: 'teller',
      is_active: true,
      last_synced: '2026-03-09T08:30:00Z',
      created_at: '2026-01-15T10:00:00Z',
    },
  ],
  'mock-2': [
    {
      id: 'src-2a',
      account_id: 'mock-2',
      provider: 'teller',
      is_active: true,
      last_synced: '2026-03-09T08:30:00Z',
      created_at: '2026-02-01T09:00:00Z',
    },
  ],
  'mock-3': [
    {
      id: 'src-3a',
      account_id: 'mock-3',
      provider: 'csv',
      is_active: true,
      last_synced: '2026-03-07T14:22:00Z',
      created_at: '2026-01-04T11:45:00Z',
    },
  ],
  'mock-4': [
    {
      id: 'src-4a',
      account_id: 'mock-4',
      provider: 'csv',
      is_active: true,
      last_synced: '2026-01-20T10:30:00Z',
      created_at: '2026-01-20T10:30:00Z',
    },
    {
      id: 'src-4b',
      account_id: 'mock-4',
      provider: 'snaptrade',
      is_active: true,
      last_synced: '2026-03-09T08:30:00Z',
      created_at: '2026-01-20T11:00:00Z',
    },
  ],
  'mock-5': [
    {
      id: 'src-5a',
      account_id: 'mock-5',
      provider: 'csv',
      is_active: true,
      last_synced: '2026-03-05T10:15:00Z',
      created_at: '2026-01-15T12:00:00Z',
    },
  ],
  'mock-6': [
    {
      id: 'src-6a',
      account_id: 'mock-6',
      provider: 'manual',
      is_active: true,
      last_synced: '2026-03-01T12:00:00Z',
      created_at: '2025-12-01T09:00:00Z',
    },
  ],
};

// ── Latest Balance Snapshots (matches DB `balance_snapshot` table) ──

export const mockLatestBalances: Record<string, { balance: number; date: string; source: string }> =
  {
    'mock-1': { balance: 456789.12, date: '2026-03-09', source: 'provider_sync' },
    'mock-2': { balance: 12345.67, date: '2026-03-09', source: 'provider_sync' },
    'mock-3': { balance: 234567.89, date: '2026-03-07', source: 'csv_derived' },
    'mock-4': { balance: 89012.34, date: '2026-03-09', source: 'provider_sync' },
    'mock-5': { balance: -4567.89, date: '2026-03-05', source: 'csv_derived' },
    'mock-6': { balance: 50000.0, date: '2026-03-01', source: 'manual' },
  };

export interface AccountHistoryEvent {
  id: string;
  date: string;
  type:
    | 'api_sync'
    | 'file_import'
    | 'manual_override'
    | 'manual_delta'
    | 'link_connected'
    | 'link_disconnected'
    | 'account_created';
  description: string;
  detail?: string; // filename, balance value, etc.
  balance_after?: number;
  records?: number;
}

export const mockAccountHistory: Record<string, AccountHistoryEvent[]> = {
  'mock-1': [
    {
      id: 'h-1-1',
      date: '2026-03-09T08:30:00Z',
      type: 'api_sync',
      description: 'API sync',
      balance_after: 456789.12,
      records: 12,
    },
    {
      id: 'h-1-2',
      date: '2026-03-08T08:30:00Z',
      type: 'api_sync',
      description: 'API sync',
      balance_after: 455200.0,
      records: 3,
    },
    {
      id: 'h-1-3',
      date: '2026-03-07T08:30:00Z',
      type: 'api_sync',
      description: 'API sync',
      balance_after: 454800.5,
      records: 5,
    },
    {
      id: 'h-1-4',
      date: '2026-01-15T10:00:00Z',
      type: 'link_connected',
      description: 'Account linked via API',
    },
    {
      id: 'h-1-5',
      date: '2026-01-10T14:00:00Z',
      type: 'file_import',
      description: 'Uploaded fidelity-2025.csv',
      detail: 'fidelity-2025.csv',
      records: 156,
    },
    {
      id: 'h-1-6',
      date: '2026-01-10T13:45:00Z',
      type: 'account_created',
      description: 'Account created',
    },
  ],
  'mock-2': [
    {
      id: 'h-2-1',
      date: '2026-03-09T08:30:00Z',
      type: 'api_sync',
      description: 'API sync',
      balance_after: 12345.67,
      records: 28,
    },
    {
      id: 'h-2-2',
      date: '2026-03-08T08:30:00Z',
      type: 'api_sync',
      description: 'API sync',
      balance_after: 12100.0,
      records: 15,
    },
    {
      id: 'h-2-3',
      date: '2026-02-01T09:00:00Z',
      type: 'link_connected',
      description: 'Account linked via API',
    },
    {
      id: 'h-2-4',
      date: '2026-02-01T08:50:00Z',
      type: 'account_created',
      description: 'Account created',
    },
  ],
  'mock-3': [
    {
      id: 'h-3-1',
      date: '2026-03-07T14:22:00Z',
      type: 'file_import',
      description: 'Uploaded vanguard-march-2026.csv',
      detail: 'vanguard-march-2026.csv',
      balance_after: 234567.89,
      records: 47,
    },
    {
      id: 'h-3-2',
      date: '2026-02-05T09:10:00Z',
      type: 'file_import',
      description: 'Uploaded vanguard-feb-2026.csv',
      detail: 'vanguard-feb-2026.csv',
      balance_after: 233000.0,
      records: 38,
    },
    {
      id: 'h-3-3',
      date: '2026-01-04T11:45:00Z',
      type: 'file_import',
      description: 'Uploaded vanguard-jan-2026.csv',
      detail: 'vanguard-jan-2026.csv',
      balance_after: 230000.0,
      records: 42,
    },
    {
      id: 'h-3-4',
      date: '2025-12-20T10:00:00Z',
      type: 'account_created',
      description: 'Account created',
    },
  ],
  'mock-4': [
    {
      id: 'h-4-1',
      date: '2026-03-09T08:30:00Z',
      type: 'api_sync',
      description: 'API sync',
      balance_after: 89012.34,
      records: 8,
    },
    {
      id: 'h-4-2',
      date: '2026-03-08T08:30:00Z',
      type: 'api_sync',
      description: 'API sync',
      balance_after: 88500.0,
      records: 2,
    },
    {
      id: 'h-4-3',
      date: '2026-01-20T11:00:00Z',
      type: 'link_connected',
      description: 'Account linked via API',
    },
    {
      id: 'h-4-4',
      date: '2026-01-20T10:30:00Z',
      type: 'file_import',
      description: 'Uploaded schwab-history.csv',
      detail: 'schwab-history.csv',
      records: 89,
    },
    {
      id: 'h-4-5',
      date: '2026-01-20T10:00:00Z',
      type: 'account_created',
      description: 'Account created',
    },
  ],
  'mock-5': [
    {
      id: 'h-5-1',
      date: '2026-03-05T10:15:00Z',
      type: 'file_import',
      description: 'Uploaded amex-statement-mar.csv',
      detail: 'amex-statement-mar.csv',
      balance_after: -4567.89,
      records: 63,
    },
    {
      id: 'h-5-2',
      date: '2026-02-03T16:30:00Z',
      type: 'file_import',
      description: 'Uploaded amex-statement-feb.csv',
      detail: 'amex-statement-feb.csv',
      balance_after: -5100.0,
      records: 55,
    },
    {
      id: 'h-5-3',
      date: '2026-01-15T12:00:00Z',
      type: 'account_created',
      description: 'Account created',
    },
  ],
  'mock-6': [
    {
      id: 'h-6-1',
      date: '2026-03-01T12:00:00Z',
      type: 'manual_override',
      description: 'Balance set to $50,000.00',
      balance_after: 50000,
    },
    {
      id: 'h-6-2',
      date: '2026-02-15T09:00:00Z',
      type: 'manual_delta',
      description: 'Deposit',
      detail: '+$2,000.00',
      balance_after: 48000,
    },
    {
      id: 'h-6-3',
      date: '2026-02-01T10:00:00Z',
      type: 'manual_override',
      description: 'Balance set to $46,000.00',
      balance_after: 46000,
    },
    {
      id: 'h-6-4',
      date: '2025-12-01T09:00:00Z',
      type: 'account_created',
      description: 'Account created',
    },
  ],
};

export const mockBalanceHistory: Record<string, { date: string; balance: number }[]> = {
  'mock-1': [
    { date: '2025-04', balance: 410000 },
    { date: '2025-05', balance: 418000 },
    { date: '2025-06', balance: 415000 },
    { date: '2025-07', balance: 425000 },
    { date: '2025-08', balance: 430000 },
    { date: '2025-09', balance: 435000 },
    { date: '2025-10', balance: 438000 },
    { date: '2025-11', balance: 442000 },
    { date: '2025-12', balance: 445000 },
    { date: '2026-01', balance: 448000 },
    { date: '2026-02', balance: 452000 },
    { date: '2026-03', balance: 456789 },
  ],
  'mock-2': [
    { date: '2025-04', balance: 8500 },
    { date: '2025-05', balance: 9200 },
    { date: '2025-06', balance: 11000 },
    { date: '2025-07', balance: 10200 },
    { date: '2025-08', balance: 13500 },
    { date: '2025-09', balance: 12800 },
    { date: '2025-10', balance: 11500 },
    { date: '2025-11', balance: 14200 },
    { date: '2025-12', balance: 13000 },
    { date: '2026-01', balance: 11800 },
    { date: '2026-02', balance: 12900 },
    { date: '2026-03', balance: 12346 },
  ],
  'mock-3': [
    { date: '2025-04', balance: 200000 },
    { date: '2025-05', balance: 208000 },
    { date: '2025-06', balance: 205000 },
    { date: '2025-07', balance: 215000 },
    { date: '2025-08', balance: 212000 },
    { date: '2025-09', balance: 220000 },
    { date: '2025-10', balance: 218000 },
    { date: '2025-11', balance: 225000 },
    { date: '2025-12', balance: 228000 },
    { date: '2026-01', balance: 230000 },
    { date: '2026-02', balance: 233000 },
    { date: '2026-03', balance: 234568 },
  ],
  'mock-4': [
    { date: '2025-04', balance: 72000 },
    { date: '2025-05', balance: 74500 },
    { date: '2025-06', balance: 73800 },
    { date: '2025-07', balance: 76000 },
    { date: '2025-08', balance: 78500 },
    { date: '2025-09', balance: 80000 },
    { date: '2025-10', balance: 81200 },
    { date: '2025-11', balance: 83000 },
    { date: '2025-12', balance: 84500 },
    { date: '2026-01', balance: 86000 },
    { date: '2026-02', balance: 87500 },
    { date: '2026-03', balance: 89012 },
  ],
  'mock-5': [
    { date: '2025-04', balance: -3200 },
    { date: '2025-05', balance: -2800 },
    { date: '2025-06', balance: -4100 },
    { date: '2025-07', balance: -3500 },
    { date: '2025-08', balance: -5200 },
    { date: '2025-09', balance: -4800 },
    { date: '2025-10', balance: -3900 },
    { date: '2025-11', balance: -5500 },
    { date: '2025-12', balance: -4200 },
    { date: '2026-01', balance: -3800 },
    { date: '2026-02', balance: -5100 },
    { date: '2026-03', balance: -4568 },
  ],
  'mock-6': [
    { date: '2025-04', balance: 35000 },
    { date: '2025-05', balance: 37000 },
    { date: '2025-06', balance: 38500 },
    { date: '2025-07', balance: 40000 },
    { date: '2025-08', balance: 41000 },
    { date: '2025-09', balance: 42500 },
    { date: '2025-10', balance: 44000 },
    { date: '2025-11', balance: 45000 },
    { date: '2025-12', balance: 46500 },
    { date: '2026-01', balance: 48000 },
    { date: '2026-02', balance: 48000 },
    { date: '2026-03', balance: 50000 },
  ],
};

export const mockHoldings = [
  {
    id: 'h-1',
    symbol: 'VTI',
    name: 'Vanguard Total Stock Market',
    shares: 150,
    price: 245.67,
    value: 36850.5,
    cost_basis: 28616.38,
    gain: 8234.12,
    gain_pct: 28.8,
    account_id: 'mock-3',
  },
  {
    id: 'h-2',
    symbol: 'VXUS',
    name: 'Vanguard Intl Stock',
    shares: 200,
    price: 58.23,
    value: 11646.0,
    cost_basis: 12669.45,
    gain: -1023.45,
    gain_pct: -8.1,
    account_id: 'mock-3',
  },
  {
    id: 'h-3',
    symbol: 'BND',
    name: 'Vanguard Total Bond',
    shares: 100,
    price: 72.45,
    value: 7245.0,
    cost_basis: 7122.0,
    gain: 123.0,
    gain_pct: 1.7,
    account_id: 'mock-1',
  },
  {
    id: 'h-4',
    symbol: 'AAPL',
    name: 'Apple Inc.',
    shares: 50,
    price: 198.5,
    value: 9925.0,
    cost_basis: 6468.22,
    gain: 3456.78,
    gain_pct: 53.4,
    account_id: 'mock-3',
  },
  {
    id: 'h-5',
    symbol: 'GOOGL',
    name: 'Alphabet Inc.',
    shares: 25,
    price: 175.23,
    value: 4380.75,
    cost_basis: 4615.31,
    gain: -234.56,
    gain_pct: -5.1,
    account_id: 'mock-4',
  },
  {
    id: 'h-6',
    symbol: 'FXAIX',
    name: 'Fidelity 500 Index',
    shares: 312,
    price: 198.42,
    value: 61907.04,
    cost_basis: 48230.0,
    gain: 13677.04,
    gain_pct: 28.4,
    account_id: 'mock-1',
  },
  {
    id: 'h-7',
    symbol: 'MSFT',
    name: 'Microsoft Corp.',
    shares: 30,
    price: 442.58,
    value: 13277.4,
    cost_basis: 9840.0,
    gain: 3437.4,
    gain_pct: 34.9,
    account_id: 'mock-4',
  },
];

// ── Tax Lots (matches DB `tax_lot` table via `open_tax_lots` view) ──

export interface MockTaxLot {
  id: string;
  account_id: string;
  symbol: string;
  acquired_date: string;
  quantity: number;
  cost_basis_per_share: number;
  cost_basis_total: number;
  live_price: number;
  live_market_value: number;
  unrealized_gain_loss: number;
  holding_period: 'short_term' | 'long_term';
  source: 'provider_lot' | 'computed_fifo' | 'manual';
}

export const mockTaxLots: MockTaxLot[] = [
  // VTI lots (mock-3: Vanguard Brokerage)
  {
    id: 'lot-1',
    account_id: 'mock-3',
    symbol: 'VTI',
    acquired_date: '2024-03-15',
    quantity: 80,
    cost_basis_per_share: 178.5,
    cost_basis_total: 14280,
    live_price: 245.67,
    live_market_value: 19653.6,
    unrealized_gain_loss: 5373.6,
    holding_period: 'long_term',
    source: 'computed_fifo',
  },
  {
    id: 'lot-2',
    account_id: 'mock-3',
    symbol: 'VTI',
    acquired_date: '2025-06-10',
    quantity: 70,
    cost_basis_per_share: 204.8,
    cost_basis_total: 14336.38,
    live_price: 245.67,
    live_market_value: 17196.9,
    unrealized_gain_loss: 2860.52,
    holding_period: 'short_term',
    source: 'computed_fifo',
  },
  // VXUS lots (mock-3)
  {
    id: 'lot-3',
    account_id: 'mock-3',
    symbol: 'VXUS',
    acquired_date: '2024-01-20',
    quantity: 120,
    cost_basis_per_share: 62.1,
    cost_basis_total: 7452,
    live_price: 58.23,
    live_market_value: 6987.6,
    unrealized_gain_loss: -464.4,
    holding_period: 'long_term',
    source: 'computed_fifo',
  },
  {
    id: 'lot-4',
    account_id: 'mock-3',
    symbol: 'VXUS',
    acquired_date: '2025-09-05',
    quantity: 80,
    cost_basis_per_share: 65.22,
    cost_basis_total: 5217.45,
    live_price: 58.23,
    live_market_value: 4658.4,
    unrealized_gain_loss: -559.05,
    holding_period: 'short_term',
    source: 'computed_fifo',
  },
  // BND lots (mock-1: Fidelity 401k)
  {
    id: 'lot-5',
    account_id: 'mock-1',
    symbol: 'BND',
    acquired_date: '2023-08-12',
    quantity: 60,
    cost_basis_per_share: 70.5,
    cost_basis_total: 4230,
    live_price: 72.45,
    live_market_value: 4347,
    unrealized_gain_loss: 117,
    holding_period: 'long_term',
    source: 'provider_lot',
  },
  {
    id: 'lot-6',
    account_id: 'mock-1',
    symbol: 'BND',
    acquired_date: '2025-11-20',
    quantity: 40,
    cost_basis_per_share: 72.3,
    cost_basis_total: 2892,
    live_price: 72.45,
    live_market_value: 2898,
    unrealized_gain_loss: 6,
    holding_period: 'short_term',
    source: 'provider_lot',
  },
  // AAPL lots (mock-3)
  {
    id: 'lot-7',
    account_id: 'mock-3',
    symbol: 'AAPL',
    acquired_date: '2023-01-10',
    quantity: 30,
    cost_basis_per_share: 110.25,
    cost_basis_total: 3307.5,
    live_price: 198.5,
    live_market_value: 5955,
    unrealized_gain_loss: 2647.5,
    holding_period: 'long_term',
    source: 'computed_fifo',
  },
  {
    id: 'lot-8',
    account_id: 'mock-3',
    symbol: 'AAPL',
    acquired_date: '2025-04-22',
    quantity: 20,
    cost_basis_per_share: 158.04,
    cost_basis_total: 3160.72,
    live_price: 198.5,
    live_market_value: 3970,
    unrealized_gain_loss: 809.28,
    holding_period: 'short_term',
    source: 'computed_fifo',
  },
  // GOOGL lots (mock-4: Schwab Roth IRA)
  {
    id: 'lot-9',
    account_id: 'mock-4',
    symbol: 'GOOGL',
    acquired_date: '2025-07-15',
    quantity: 25,
    cost_basis_per_share: 184.61,
    cost_basis_total: 4615.31,
    live_price: 175.23,
    live_market_value: 4380.75,
    unrealized_gain_loss: -234.56,
    holding_period: 'short_term',
    source: 'provider_lot',
  },
  // FXAIX lots (mock-1: Fidelity 401k)
  {
    id: 'lot-10',
    account_id: 'mock-1',
    symbol: 'FXAIX',
    acquired_date: '2022-06-01',
    quantity: 200,
    cost_basis_per_share: 142.5,
    cost_basis_total: 28500,
    live_price: 198.42,
    live_market_value: 39684,
    unrealized_gain_loss: 11184,
    holding_period: 'long_term',
    source: 'provider_lot',
  },
  {
    id: 'lot-11',
    account_id: 'mock-1',
    symbol: 'FXAIX',
    acquired_date: '2025-08-15',
    quantity: 112,
    cost_basis_per_share: 176.16,
    cost_basis_total: 19730,
    live_price: 198.42,
    live_market_value: 22223.04,
    unrealized_gain_loss: 2493.04,
    holding_period: 'short_term',
    source: 'provider_lot',
  },
  // MSFT lots (mock-4: Schwab Roth IRA)
  {
    id: 'lot-12',
    account_id: 'mock-4',
    symbol: 'MSFT',
    acquired_date: '2023-11-30',
    quantity: 15,
    cost_basis_per_share: 310.0,
    cost_basis_total: 4650,
    live_price: 442.58,
    live_market_value: 6638.7,
    unrealized_gain_loss: 1988.7,
    holding_period: 'long_term',
    source: 'provider_lot',
  },
  {
    id: 'lot-13',
    account_id: 'mock-4',
    symbol: 'MSFT',
    acquired_date: '2025-10-01',
    quantity: 15,
    cost_basis_per_share: 346.0,
    cost_basis_total: 5190,
    live_price: 442.58,
    live_market_value: 6638.7,
    unrealized_gain_loss: 1448.7,
    holding_period: 'short_term',
    source: 'provider_lot',
  },
];

// Generate daily history data from a start value with random walk
function generateDailyHistory(
  startDate: string,
  endDate: string,
  startValue: number,
  endValue: number,
  volatility = 0.003,
): { date: string; value: number }[] {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const totalDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  const dailyDrift = (endValue - startValue) / totalDays;
  const points: { date: string; value: number }[] = [];
  let value = startValue;
  for (let i = 0; i <= totalDays; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    // Skip weekends for realism
    if (d.getDay() === 0 || d.getDay() === 6) continue;
    const noise = (Math.random() - 0.5) * 2 * volatility * value;
    value = value + dailyDrift + noise;
    points.push({
      date: d.toISOString().slice(0, 10),
      value: Math.round(value * 100) / 100,
    });
  }
  // Pin last value exactly
  if (points.length > 0) points[points.length - 1].value = endValue;
  return points;
}

export const mockNetWorthHistory = generateDailyHistory(
  '2025-04-01',
  '2026-03-10',
  780000,
  838147.13,
  0.002,
);

// Portfolio value over time (line chart)
export const mockPortfolioHistory = generateDailyHistory(
  '2025-04-01',
  '2026-03-10',
  120000,
  145231.69,
  0.003,
);

// ── Enriched Account View (composed for frontend display) ──
// In production, this would be assembled from API calls to accounts + sources + balances.

import { devBypass, API_PROVIDERS } from '@/lib/constants';
export { devBypass };

import type { EnrichedAccount } from '@shared/types';

export function enrichAccounts(): EnrichedAccount[] {
  return mockAccounts.map((a) => {
    const sources = mockSources[a.id] || [];
    const latestBalance = mockLatestBalances[a.id];
    const linked = sources.some((s) => API_PROVIDERS.includes(s.provider) && s.is_active);
    const lastSynced =
      sources
        .map((s) => s.last_synced)
        .filter(Boolean)
        .sort()
        .reverse()[0] || null;

    return {
      ...a,
      member_id: null,
      balance: latestBalance?.balance ?? 0,
      balance_date: latestBalance ? '2026-03-09' : null,
      linked,
      last_synced: lastSynced,
      tax_bucket: (a.meta.tax_bucket as string) || 'none',
    } as EnrichedAccount;
  });
}
