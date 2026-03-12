// ── Onboarding Enums ──

export const TAX_FILING_STATUSES = [
  'single',
  'married_jointly',
  'married_separately',
  'head_of_household',
] as const;
export type TaxFilingStatus = (typeof TAX_FILING_STATUSES)[number];

export const EMPLOYMENT_TYPES = ['w2', '1099', 'mixed'] as const;
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];

export const RISK_TOLERANCES = ['conservative', 'moderate', 'aggressive'] as const;
export type RiskTolerance = (typeof RISK_TOLERANCES)[number];

export const US_STATES = [
  'AL',
  'AK',
  'AZ',
  'AR',
  'CA',
  'CO',
  'CT',
  'DE',
  'FL',
  'GA',
  'HI',
  'ID',
  'IL',
  'IN',
  'IA',
  'KS',
  'KY',
  'LA',
  'ME',
  'MD',
  'MA',
  'MI',
  'MN',
  'MS',
  'MO',
  'MT',
  'NE',
  'NV',
  'NH',
  'NJ',
  'NM',
  'NY',
  'NC',
  'ND',
  'OH',
  'OK',
  'OR',
  'PA',
  'RI',
  'SC',
  'SD',
  'TN',
  'TX',
  'UT',
  'VT',
  'VA',
  'WA',
  'WV',
  'WI',
  'WY',
  'DC',
] as const;
export type USState = (typeof US_STATES)[number];

// ── Account Types ──

export const ACCOUNT_TYPES = [
  'checking',
  'savings',
  'credit',
  'brokerage',
  'retirement',
  'hsa',
  'loan',
  'mortgage',
  'other',
] as const;

export type AccountType = (typeof ACCOUNT_TYPES)[number];

export const INVESTMENT_ACCOUNT_TYPES: AccountType[] = ['brokerage', 'retirement', 'hsa'];
export const BANKING_ACCOUNT_TYPES: AccountType[] = ['checking', 'savings', 'credit'];
export const LIABILITY_TYPES: AccountType[] = ['credit', 'loan', 'mortgage'];

export const NET_WORTH_GROUPS = {
  cash: ['checking', 'savings'] as AccountType[],
  investments: ['brokerage', 'retirement', 'hsa'] as AccountType[],
  debt: ['credit', 'loan', 'mortgage'] as AccountType[],
};

// ── Asset Types (non-account items tracked for net worth) ──

export const ASSET_CATEGORIES = ['real_estate', 'vehicle', 'other'] as const;
export type AssetCategory = (typeof ASSET_CATEGORIES)[number];

export type Provider = 'teller' | 'snaptrade' | 'csv' | 'pdf' | 'manual';

export type ActivityType =
  | 'buy'
  | 'sell'
  | 'dividend'
  | 'reinvestment'
  | 'split'
  | 'transfer_in'
  | 'transfer_out'
  | 'fee'
  | 'interest'
  | 'return_of_capital';

export type AssetClass =
  | 'equity'
  | 'fixed_income'
  | 'cash'
  | 'crypto'
  | 'real_estate'
  | 'commodity'
  | 'other';

// ── Tax Treatment (canonical vocabulary) ──

export const TAX_TREATMENTS = ['pre_tax', 'after_tax', 'tax_free', 'none'] as const;
export type TaxTreatment = (typeof TAX_TREATMENTS)[number];

// ── DB Row Types ──

export interface Household {
  id: string;
  name: string;
  tax_filing_status: TaxFilingStatus | null;
  state: USState | null;
  currency: string;
  created_at: string;
}

export interface Member {
  id: string;
  household_id: string;
  auth_user_id: string | null;
  display_name: string;
  role: 'owner' | 'viewer';
  birthday: string | null;
  target_retirement_age: number | null;
  employment_type: EmploymentType | null;
  risk_tolerance: RiskTolerance | null;
  state_of_residence: string | null;
  tax_mode: TaxMode;
  effective_tax_rate_override: number | null;
  created_at: string;
}

export interface HouseholdInvite {
  id: string;
  household_id: string;
  email: string;
  invited_by: string;
  role: 'owner' | 'viewer';
  expires_at: string;
  accepted_at: string | null;
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
  include_in_fi_portfolio: boolean;
  tax_treatment: TaxTreatment;
  created_at: string;
}

export interface Asset {
  id: string;
  household_id: string;
  name: string;
  category: AssetCategory;
  estimated_value: number;
  created_at: string;
  updated_at: string;
}

export interface AccountSource {
  id: string;
  account_id: string;
  household_id: string;
  provider: Provider;
  provider_account_id: string | null;
  provider_meta: Uint8Array | null; // encrypted
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
  triggered_by: string | null;
  processed_at: string | null;
  created_at: string;
}

export type AccountEventType =
  | 'account_created'
  | 'account_updated'
  | 'link_connected'
  | 'link_disconnected'
  | 'source_added'
  | 'source_removed';

export interface AccountEvent {
  id: string;
  household_id: string;
  account_id: string;
  event_type: AccountEventType;
  triggered_by: string | null;
  detail: Record<string, unknown>;
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

// ── Security Price & Tax Lot Types ──

export type TaxLotSource = 'provider_lot' | 'computed_fifo' | 'manual';
export type HoldingPeriod = 'short_term' | 'long_term';

export interface SecurityPrice {
  symbol: string;
  name: string | null;
  price: number;
  prev_close: number | null;
  day_change_pct: number | null;
  currency: string;
  source: string;
  updated_at: string;
  created_at: string;
}

export interface TaxLot {
  id: string;
  household_id: string;
  account_id: string;
  symbol: string;
  acquired_date: string;
  quantity: number;
  original_quantity: number;
  cost_basis_per_share: number;
  cost_basis_total: number;
  source: TaxLotSource;
  provider_lot_id: string | null;
  origin_activity_id: string | null;
  is_closed: boolean;
  closed_date: string | null;
  realized_gain_loss: number | null;
  wash_sale_adjustment: number;
  created_at: string;
  updated_at: string;
}

export interface LotDisposition {
  id: string;
  household_id: string;
  tax_lot_id: string;
  sell_activity_id: string;
  quantity: number;
  proceeds: number;
  cost_basis: number;
  gain_loss: number;
  is_short_term: boolean;
  created_at: string;
}

export interface CurrentPosition {
  holding_id: string;
  household_id: string;
  account_id: string;
  as_of: string;
  symbol: string;
  name: string | null;
  quantity: number;
  snapshot_price: number | null;
  snapshot_market_value: number;
  cost_basis: number | null;
  currency: string;
  asset_class: AssetClass | null;
  live_price: number | null;
  prev_close: number | null;
  day_change_pct: number | null;
  price_updated_at: string | null;
  effective_price: number | null;
  live_market_value: number | null;
  unrealized_gain_loss: number | null;
  unrealized_gain_loss_pct: number | null;
}

export interface HouseholdPositionSummary {
  household_id: string;
  symbol: string;
  name: string | null;
  asset_class: AssetClass | null;
  currency: string;
  total_quantity: number;
  live_price: number | null;
  day_change_pct: number | null;
  total_market_value: number | null;
  total_cost_basis: number | null;
  total_unrealized_gain_loss: number | null;
  account_count: number;
  price_updated_at: string | null;
}

// ── API Response Types ──

export interface EnrichedAccount extends Account {
  balance: number;
  balance_date: string | null;
  linked: boolean;
  last_synced: string | null;
}

export interface AccountTimelineEvent {
  id: string;
  kind: string;
  event_type: string;
  detail: Record<string, unknown>;
  triggered_by: string | null;
  created_at: string;
}

export interface AccountDetailResponse {
  account: Account;
  balance: Pick<BalanceSnapshot, 'balance' | 'available' | 'date' | 'source'> | null;
  balance_history: Pick<BalanceSnapshot, 'date' | 'balance' | 'source'>[];
  holdings: CurrentPosition[];
  lots: TaxLot[];
  sources: AccountSource[];
  history: AccountTimelineEvent[];
}

export interface HouseholdHoldingsResponse {
  positions: CurrentPosition[];
  summary: HouseholdPositionSummary[];
  lots: TaxLot[];
}

export interface MemberSummary {
  id: string;
  household_id: string;
  display_name: string;
  role: 'owner' | 'viewer';
  created_at: string;
}

// ── API Input Types ──

export interface CreateHouseholdInput {
  householdName: string;
  displayName: string;
  birthday?: string | null;
  targetRetirementAge?: number | null;
  taxFilingStatus?: TaxFilingStatus | null;
  state?: USState | null;
  currency?: string;
  employmentType?: EmploymentType | null;
  riskTolerance?: RiskTolerance | null;
}

export interface AcceptInviteInput {
  inviteId: string;
  displayName: string;
  birthday?: string | null;
}

export interface UpdateHouseholdInput {
  name?: string;
  taxFilingStatus?: TaxFilingStatus | null;
  state?: USState | null;
  currency?: string;
}

export interface UpdateProfileInput {
  displayName?: string;
  birthday?: string | null;
  targetRetirementAge?: number | null;
  employmentType?: EmploymentType | null;
  riskTolerance?: RiskTolerance | null;
  stateOfResidence?: string | null;
  taxMode?: TaxMode;
  effectiveTaxRateOverride?: number | null;
}

export interface CreateAccountInput {
  name: string;
  institution?: string;
  account_type: AccountType;
  member_id?: string;
  currency?: string;
  meta?: Record<string, unknown>;
  tax_treatment?: TaxTreatment;
}

export interface UpdateAccountInput {
  name?: string;
  institution?: string;
  account_type?: AccountType;
  member_id?: string;
  currency?: string;
  meta?: Record<string, unknown>;
  is_active?: boolean;
  include_in_fi_portfolio?: boolean;
}

export interface ManualIngestInput {
  transactions?: NormalizedTransaction[];
  investmentActivity?: NormalizedInvestmentActivity[];
  balances?: NormalizedBalance[];
  holdings?: NormalizedHolding[];
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

// ── Planning Types ──

export type TaxMode = 'auto' | 'manual';

export type CashflowDirection = 'inflow' | 'outflow';

export const CASHFLOW_BUCKETS = ['savings', 'employer_match', 'expense'] as const;
export type CashflowBucket = (typeof CASHFLOW_BUCKETS)[number];

export const CASHFLOW_FREQUENCIES = ['monthly', 'biweekly', 'annual', 'one_time'] as const;
export type CashflowFrequency = (typeof CASHFLOW_FREQUENCIES)[number];

export const INCOME_SOURCE_TYPES = ['employment', 'self_employment', 'passive', 'other'] as const;
export type IncomeSourceType = (typeof INCOME_SOURCE_TYPES)[number];

export type ContributionGrowthMode = 'inflation' | 'fixed_rate' | 'none';

export interface IncomeSource {
  id: string;
  household_id: string;
  member_id: string;
  name: string;
  type: IncomeSourceType;
  gross_amount: number;
  frequency: CashflowFrequency;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CashflowItem {
  id: string;
  household_id: string;
  member_id: string | null;
  name: string;
  direction: CashflowDirection;
  bucket: CashflowBucket;
  amount: number;
  frequency: CashflowFrequency;
  is_recurring: boolean;
  include_in_projection: boolean;
  start_date: string;
  end_date: string | null;
  income_source_id: string | null;
  source_account_id: string | null;
  destination_account_id: string | null;
  category: string | null;
  is_essential: boolean;
  created_at: string;
  updated_at: string;
}

export interface ExpenseCategory {
  id: string;
  household_id: string;
  name: string;
  is_essential: boolean;
  created_at: string;
  updated_at: string;
}

export interface ScenarioAssumptions {
  gross_return_rate?: number;
  inflation_rate?: number;
  real_return_rate?: number;
  withdrawal_rate?: number;
  retirement_annual_spend_override?: number | null;
  contribution_growth_mode?: ContributionGrowthMode;
  contribution_growth_rate?: number | null;
}

export interface PlanningScenario {
  id: string;
  household_id: string;
  name: string;
  is_base: boolean;
  assumptions: ScenarioAssumptions;
  created_at: string;
  updated_at: string;
}

// ── Planning API Input Types ──

export interface CreateIncomeSourceInput {
  member_id: string;
  name: string;
  type: IncomeSourceType;
  gross_amount: number;
  frequency: CashflowFrequency;
  is_active?: boolean;
}

export interface UpdateIncomeSourceInput {
  name?: string;
  type?: IncomeSourceType;
  gross_amount?: number;
  frequency?: CashflowFrequency;
  is_active?: boolean;
}

export interface CreateCashflowItemInput {
  member_id?: string | null;
  name: string;
  direction: CashflowDirection;
  bucket: CashflowBucket;
  amount: number;
  frequency: CashflowFrequency;
  is_recurring?: boolean;
  include_in_projection?: boolean;
  start_date: string;
  end_date?: string | null;
  income_source_id?: string | null;
  source_account_id?: string | null;
  destination_account_id?: string | null;
  category?: string | null;
  is_essential?: boolean;
}

export interface UpdateCashflowItemInput {
  name?: string;
  direction?: CashflowDirection;
  bucket?: CashflowBucket;
  amount?: number;
  frequency?: CashflowFrequency;
  is_recurring?: boolean;
  include_in_projection?: boolean;
  start_date?: string;
  end_date?: string | null;
  income_source_id?: string | null;
  source_account_id?: string | null;
  destination_account_id?: string | null;
  category?: string | null;
  is_essential?: boolean;
}

export interface CreateExpenseCategoryInput {
  name: string;
  is_essential?: boolean;
}

export interface UpdateExpenseCategoryInput {
  name?: string;
  is_essential?: boolean;
}

export interface CreatePlanningScenarioInput {
  name: string;
  is_base?: boolean;
  assumptions?: ScenarioAssumptions;
}

export interface UpdatePlanningScenarioInput {
  name?: string;
  is_base?: boolean;
  assumptions?: ScenarioAssumptions;
}

// ── Engine Output Types (mirrored from api/src/engine/types.ts for frontend use) ──

export interface TaxBreakdown {
  federal: number;
  state: number;
  social_security: number;
  medicare: number;
  fica_total: number;
  total: number;
  effective_rate: number;
}

export interface IncomeSourceSummary {
  income_source_id: string;
  name: string;
  gross_monthly: number;
  pre_tax_deductions_monthly: number;
  taxable_from_source: number;
}

export interface ContributionSummary {
  cashflow_item_id: string;
  name: string;
  monthly: number;
  destination_account_id: string | null;
}

export interface MemberWaterfall {
  member_id: string;
  display_name: string;
  total_gross_monthly: number;
  total_gross_annual: number;
  income_sources: IncomeSourceSummary[];
  total_pre_tax_deductions_monthly: number;
  taxable_income_annual: number;
  tax_breakdown: TaxBreakdown;
  tax_monthly: number;
  net_income_monthly: number;
  net_income_annual: number;
  post_tax_contributions: ContributionSummary[];
  total_post_tax_contributions_monthly: number;
  disposable_income_monthly: number;
  total_expenses_monthly: number;
  total_expenses_annual: number;
  residual_monthly: number;
  residual_annual: number;
}

export interface HouseholdWaterfall {
  members: MemberWaterfall[];
  total_gross_monthly: number;
  total_gross_annual: number;
  total_pre_tax_deductions_monthly: number;
  total_tax_monthly: number;
  total_net_income_monthly: number;
  total_post_tax_contributions_monthly: number;
  total_disposable_income_monthly: number;
  total_expenses_monthly: number;
  total_expenses_annual: number;
  total_residual_monthly: number;
  total_residual_annual: number;
}

export interface FIMetricsInput {
  fi_portfolio_value: number;
  yearly_contributions: number;
  yearly_expenses: number;
  real_return_rate: number;
  withdrawal_rate: number;
  current_age: number;
  desired_retirement_age: number;
  retirement_annual_spend: number;
}

export interface FIMetrics {
  fire_number: number;
  security_fi: number;
  coast_fi: number;
  boiling_point: number;
  progress_pct: number;
  years_to_fire: number | null;
  projected_retirement_age: number | null;
  on_track: 'ahead' | 'on_track' | 'behind' | 'unreachable';
}

export interface SavingsRates {
  investment_rate: number;
  savings_rate: number;
  total_savings_rate: number;
}

export interface ProjectionYear {
  year: number;
  age: number | null;
  starting_portfolio: number;
  contributions: number;
  growth: number;
  ending_portfolio: number;
  account_detail?: { account_id: string; name: string; contribution: number }[];
}

export interface ProjectionResult {
  years: ProjectionYear[];
  final_portfolio: number;
  total_contributions: number;
  total_growth: number;
}

// ── Planning API Response Types ──

export interface ResolvedScenario {
  id: string;
  name: string;
  assumptions: Required<ScenarioAssumptions>;
}

export interface CashflowSummaryResponse {
  scenario: ResolvedScenario;
  waterfall: HouseholdWaterfall;
}

export interface MetricsResponse {
  scenario: ResolvedScenario;
  fi_portfolio_value: number;
  inputs: FIMetricsInput;
  metrics: FIMetrics;
  savings_rates: SavingsRates;
}

export interface ProjectionResponse {
  scenario: ResolvedScenario;
  fi_portfolio_value: number;
  projection: ProjectionResult;
}
