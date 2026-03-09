// ── Account Types ──

export const ACCOUNT_TYPES = [
  'checking', 'savings', 'credit',
  'brokerage', 'retirement', 'hsa',
  'loan', 'mortgage',
  'property', 'vehicle', 'other',
] as const;

export type AccountType = (typeof ACCOUNT_TYPES)[number];

export const INVESTMENT_ACCOUNT_TYPES: AccountType[] = ['brokerage', 'retirement', 'hsa'];
export const BANKING_ACCOUNT_TYPES: AccountType[] = ['checking', 'savings', 'credit'];
export const LIABILITY_TYPES: AccountType[] = ['credit', 'loan', 'mortgage'];

export const NET_WORTH_GROUPS = {
  cash: ['checking', 'savings'] as AccountType[],
  investments: ['brokerage', 'retirement', 'hsa'] as AccountType[],
  debt: ['credit', 'loan', 'mortgage'] as AccountType[],
  illiquid: ['property', 'vehicle', 'other'] as AccountType[],
};

export type Provider = 'teller' | 'snaptrade' | 'csv' | 'pdf' | 'manual';

export type ActivityType =
  | 'buy' | 'sell' | 'dividend' | 'reinvestment' | 'split'
  | 'transfer_in' | 'transfer_out' | 'fee' | 'interest' | 'return_of_capital';

export type AssetClass =
  | 'equity' | 'fixed_income' | 'cash' | 'crypto'
  | 'real_estate' | 'commodity' | 'other';

// ── DB Row Types ──

export interface Household {
  id: string;
  name: string;
  created_at: string;
}

export interface Member {
  id: string;
  household_id: string;
  auth_user_id: string | null;
  display_name: string;
  role: 'owner' | 'viewer';
  created_at: string;
}

export interface Account {
  id: string;
  household_id: string;
  member_id: string | null;
  name: string;
  institution: string | null;
  account_type: AccountType;
  currency: string;
  meta: Record<string, unknown>;
  is_active: boolean;
  is_liability: boolean;
  created_at: string;
}

export interface AccountSource {
  id: string;
  account_id: string;
  household_id: string;
  provider: Provider;
  provider_account_id: string | null;
  provider_meta: Uint8Array | null;  // encrypted
  is_active: boolean;
  last_synced: string | null;
  created_at: string;
}

export interface RawIngest {
  id: string;
  household_id: string;
  account_id: string | null;
  source_id: string | null;
  source_type: string;
  source_ref: string | null;
  payload: unknown;
  record_count: number | null;
  status: 'pending' | 'processed' | 'failed' | 'skipped';
  error: string | null;
  processed_at: string | null;
  created_at: string;
}

export interface Transaction {
  id: string;
  household_id: string;
  account_id: string;
  raw_ingest_id: string | null;
  date: string;
  amount: number;
  description: string;
  category: string | null;
  is_transfer: boolean;
  provider_txn_id: string | null;
  fingerprint: string | null;
  is_hidden: boolean;
  hidden_reason: string | null;
  created_at: string;
}

export interface InvestmentActivity {
  id: string;
  household_id: string;
  account_id: string;
  raw_ingest_id: string | null;
  date: string;
  activity_type: ActivityType;
  symbol: string | null;
  description: string | null;
  quantity: number | null;
  price: number | null;
  amount: number;
  commission: number;
  currency: string;
  lot_id: string | null;
  provider_txn_id: string | null;
  fingerprint: string | null;
  is_hidden: boolean;
  hidden_reason: string | null;
  created_at: string;
}

export interface Holding {
  id: string;
  household_id: string;
  account_id: string;
  raw_ingest_id: string | null;
  as_of: string;
  symbol: string;
  name: string | null;
  quantity: number;
  price: number | null;
  market_value: number;
  cost_basis: number | null;
  currency: string;
  asset_class: AssetClass | null;
  created_at: string;
}

export interface BalanceSnapshot {
  id: string;
  household_id: string;
  account_id: string;
  raw_ingest_id: string | null;
  date: string;
  balance: number;
  available: number | null;
  source: 'provider_sync' | 'csv_derived' | 'manual';
  created_at: string;
}

export interface NetWorthSnapshot {
  id: string;
  household_id: string;
  date: string;
  total_assets: number;
  total_liabilities: number;
  net_worth: number;
  breakdown: Record<string, number>;
  created_at: string;
}

// ── Adapter Interfaces ──

export interface NormalizedTransaction {
  providerTxnId?: string;
  date: string;
  amount: number;
  description: string;
  category?: string;
  isTransfer?: boolean;
}

export interface NormalizedInvestmentActivity {
  providerTxnId?: string;
  date: string;
  activityType: ActivityType;
  symbol?: string;
  description?: string;
  quantity?: number;
  price?: number;
  amount: number;
  commission?: number;
  lotId?: string;
}

export interface NormalizedBalance {
  date: string;
  balance: number;
  available?: number;
}

export interface NormalizedHolding {
  asOf: string;
  symbol: string;
  name?: string;
  quantity: number;
  price?: number;
  marketValue: number;
  costBasis?: number;
  assetClass?: AssetClass;
}

export interface IngestResult {
  transactions: NormalizedTransaction[];
  investmentActivity: NormalizedInvestmentActivity[];
  balances: NormalizedBalance[];
  holdings: NormalizedHolding[];
}

export interface ProviderAdapter {
  sync(account: Account, source: AccountSource): Promise<IngestResult>;
  parse?(file: Buffer, format: string): Promise<IngestResult>;
}
