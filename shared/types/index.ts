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

export type Provider = 'teller' | 'snaptrade' | 'csv' | 'manual';

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
  state: USState | null;
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

export interface AccountSource {
  id: string;
  account_id: string;
  household_id: string;
  provider: Provider;
  provider_account_id: string | null;
  is_active: boolean;
  last_synced: string | null;
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
  source: 'provider_sync' | 'csv_derived' | 'manual' | 'holdings_derived';
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
  currency?: string;
}

export interface UpdateProfileInput {
  displayName?: string;
  birthday?: string | null;
  targetRetirementAge?: number | null;
  employmentType?: EmploymentType | null;
  riskTolerance?: RiskTolerance | null;
  state?: USState | null;
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
  tax_treatment?: TaxTreatment;
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

export const AMOUNT_TYPES = ['fixed', 'percent'] as const;
export type AmountType = (typeof AMOUNT_TYPES)[number];

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
  amount_type: AmountType;
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
  amount_type?: AmountType;
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
  amount_type?: AmountType;
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
}

export interface UpdatePlanningScenarioInput {
  name?: string;
  is_base?: boolean;
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
  /** Tax-table year the figures were computed with; null for manual flat-rate overrides */
  tax_year: number | null;
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
  /** Per-key provenance for every resolved assumption (audit trail) */
  assumptions_detail: ResolvedAssumption[];
  waterfall: HouseholdWaterfall;
}

export interface MetricsResponse {
  scenario: ResolvedScenario;
  assumptions_detail: ResolvedAssumption[];
  fi_portfolio_value: number;
  inputs: FIMetricsInput;
  metrics: FIMetrics;
  savings_rates: SavingsRates;
}

export interface ProjectionResponse {
  scenario: ResolvedScenario;
  assumptions_detail: ResolvedAssumption[];
  fi_portfolio_value: number;
  projection: ProjectionResult;
}

// ── Sync API Response Types ──

export interface DeltaSyncResponse {
  synced_at: string;
  changes: {
    accounts: Account[];
    transactions: Transaction[];
    investment_activity: InvestmentActivity[];
    holdings: Holding[];
    balance_snapshots: BalanceSnapshot[];
    income_sources: IncomeSource[];
    cashflow_items: CashflowItem[];
    planning_scenarios: PlanningScenario[];
  };
}

// ── Assumptions System ──
//
// Every assumption that drives projections — planning knobs and
// rule-shaped tax parameters — is an individually date-stamped record.
// Resolution layers (highest wins): scenario record > household record
// > Ember-shipped dated default. assumption_record is append-only;
// edits insert new rows, so history is the audit trail.

export type AssumptionSource = 'default' | 'household' | 'scenario';

/** Global Ember-shipped dated default (assumption_default table) */
export interface AssumptionDefault {
  id: string;
  key: string;
  value: unknown;
  effective_date: string;
  source: string;
  created_at: string;
}

/** Household/scenario-scoped, append-only record (assumption_record table) */
export interface AssumptionRecord {
  id: string;
  household_id: string;
  scenario_id: string | null;
  key: string;
  value: unknown;
  effective_date: string;
  note: string | null;
  created_by: string | null;
  created_at: string;
}

/** One assumption after layer resolution at an as-of date */
export interface ResolvedAssumption {
  key: string;
  value: unknown;
  effective_date: string;
  source: AssumptionSource;
  /** assumption_record id when source != 'default' */
  record_id: string | null;
}

export interface CreateAssumptionRecordInput {
  key: string;
  value: unknown;
  /** defaults to today */
  effective_date?: string;
  /** null/omitted = household baseline; set = scenario override */
  scenario_id?: string | null;
  note?: string | null;
}

export interface AssumptionsResponse {
  scenario_id: string | null;
  as_of: string;
  assumptions: ResolvedAssumption[];
}

export interface AssumptionHistoryEntry {
  id: string | null;
  value: unknown;
  effective_date: string;
  source: AssumptionSource;
  scenario_id: string | null;
  note: string | null;
  created_at: string;
}

export interface AssumptionHistoryResponse {
  key: string;
  history: AssumptionHistoryEntry[];
}

// ── Assumption Key Registry ──

export type AssumptionGroup =
  | 'returns'
  | 'retirement'
  | 'tax_core'
  | 'tax_limits'
  | 'tax_rules'
  | 'allocation';

export type AssumptionValueKind = 'rate' | 'currency' | 'enum' | 'table';

export interface AssumptionKeyMeta {
  key: string;
  label: string;
  group: AssumptionGroup;
  kind: AssumptionValueKind;
  description: string;
  /** valid values when kind = 'enum' */
  enum_options?: readonly string[];
  /** value may be null (e.g. optional overrides) */
  nullable?: boolean;
}

export const ASSUMPTION_GROUP_LABELS: Record<AssumptionGroup, string> = {
  returns: 'Returns & Inflation',
  retirement: 'Retirement & Contributions',
  tax_core: 'Tax Tables',
  tax_limits: 'Contribution Limits & RMD',
  tax_rules: 'Tax Rules (ACA, IRMAA, NIIT, AMT, Roth)',
  allocation: 'Portfolio Allocation',
};

export const ASSUMPTION_KEYS: readonly AssumptionKeyMeta[] = [
  {
    key: 'gross_return_rate',
    label: 'Gross Return Rate',
    group: 'returns',
    kind: 'rate',
    description: 'Expected nominal annual portfolio return before inflation.',
  },
  {
    key: 'inflation_rate',
    label: 'Inflation Rate',
    group: 'returns',
    kind: 'rate',
    description: 'Expected long-run annual inflation.',
  },
  {
    key: 'real_return_rate',
    label: 'Real Return Rate',
    group: 'returns',
    kind: 'rate',
    description: 'Inflation-adjusted annual return. Drives all FI metrics and projections.',
  },
  {
    key: 'withdrawal_rate',
    label: 'Withdrawal Rate',
    group: 'retirement',
    kind: 'rate',
    description: 'Safe withdrawal rate used to derive the FIRE number.',
  },
  {
    key: 'retirement_annual_spend_override',
    label: 'Retirement Annual Spend Override',
    group: 'retirement',
    kind: 'currency',
    description: 'Overrides budget-derived expenses for retirement spending. Blank = use budget.',
    nullable: true,
  },
  {
    key: 'contribution_growth_mode',
    label: 'Contribution Growth Mode',
    group: 'retirement',
    kind: 'enum',
    description: 'How projected contributions grow over time.',
    enum_options: ['none', 'inflation', 'fixed_rate'],
  },
  {
    key: 'contribution_growth_rate',
    label: 'Contribution Growth Rate',
    group: 'retirement',
    kind: 'rate',
    description: 'Annual contribution growth when mode is fixed_rate.',
    nullable: true,
  },
  {
    key: 'tax.federal_brackets',
    label: 'Federal Tax Brackets',
    group: 'tax_core',
    kind: 'table',
    description: 'Progressive federal income tax brackets by filing status, year-stamped.',
  },
  {
    key: 'tax.standard_deduction',
    label: 'Standard Deduction',
    group: 'tax_core',
    kind: 'table',
    description: 'Federal standard deduction by filing status.',
  },
  {
    key: 'tax.fica',
    label: 'FICA (Social Security & Medicare)',
    group: 'tax_core',
    kind: 'table',
    description: 'Social Security rate and wage cap, Medicare rates and surtax thresholds.',
  },
  {
    key: 'tax.state_rates',
    label: 'State Effective Tax Rates',
    group: 'tax_core',
    kind: 'table',
    description: 'Simplified flat effective income tax rate per state.',
  },
  {
    key: 'tax.retirement_limits',
    label: 'Retirement Contribution Limits',
    group: 'tax_limits',
    kind: 'table',
    description: '401(k)/IRA/HSA contribution limits and catch-up amounts.',
  },
  {
    key: 'tax.rmd_ages',
    label: 'RMD Start Ages',
    group: 'tax_limits',
    kind: 'table',
    description: 'Required minimum distribution start ages by birth year (SECURE 2.0).',
  },
  {
    key: 'tax.aca',
    label: 'ACA Subsidy Parameters',
    group: 'tax_rules',
    kind: 'table',
    description: 'Premium tax credit applicable percentages, FPL table, and 400% FPL cliff.',
  },
  {
    key: 'tax.irmaa',
    label: 'Medicare IRMAA Tiers',
    group: 'tax_rules',
    kind: 'table',
    description: 'Income-related Medicare premium surcharge tiers.',
  },
  {
    key: 'tax.niit',
    label: 'Net Investment Income Tax',
    group: 'tax_rules',
    kind: 'table',
    description: 'NIIT rate and MAGI thresholds by filing status.',
  },
  {
    key: 'tax.amt',
    label: 'Alternative Minimum Tax',
    group: 'tax_rules',
    kind: 'table',
    description: 'AMT exemption amounts, phaseout thresholds, and rates.',
  },
  {
    key: 'tax.roth_conversion',
    label: 'Roth Conversion Plan',
    group: 'tax_rules',
    kind: 'table',
    description: 'Planned annual Roth conversion amount and target bracket ceiling.',
  },
  {
    key: 'allocation.targets',
    label: 'Target Allocation Bands',
    group: 'allocation',
    kind: 'table',
    description: 'Target percentage and drift band per allocation bucket.',
  },
  {
    key: 'allocation.symbol_overrides',
    label: 'Symbol Classification Overrides',
    group: 'allocation',
    kind: 'table',
    description: 'Per-symbol allocation bucket overrides (stock/bond/intl/cash/alt).',
  },
];

export const ASSUMPTION_KEY_SET: ReadonlySet<string> = new Set(ASSUMPTION_KEYS.map((k) => k.key));

// ── Allocation Buckets ──

export const ALLOCATION_BUCKETS = ['stock', 'bond', 'intl', 'cash', 'alt'] as const;
export type AllocationBucket = (typeof ALLOCATION_BUCKETS)[number];

export interface AllocationTarget {
  bucket: AllocationBucket;
  /** decimal 0–1 */
  target_pct: number;
  /** allowed absolute drift before alerting, decimal (e.g. 0.05 = ±5pp) */
  band_pct: number;
}

// ── Portfolio Composition ──

/**
 * Why a position landed in its bucket. Every position is tagged so the
 * UI can always explain a classification — never classify silently.
 */
export type ClassificationSource = 'override' | 'intl_heuristic' | 'asset_class' | 'fallback';

export interface CompositionBucket {
  bucket: AllocationBucket;
  value: number;
  /** share of total portfolio value, decimal 0–1 (0 when total is 0) */
  pct: number;
  target_pct: number | null;
  band_pct: number | null;
  /** pct - target_pct; null when no target is set for this bucket */
  drift: number | null;
  /** |drift| > band_pct; false when no target is set */
  drift_alert: boolean;
}

export interface CompositionPosition {
  symbol: string;
  name: string | null;
  value: number;
  /** share of total portfolio value, decimal 0–1 */
  pct: number;
  bucket: AllocationBucket;
  classification_source: ClassificationSource;
  account_id: string;
}

/** One row of the asset-location matrix (bucket value by tax treatment). */
export interface AssetLocationRow {
  tax_treatment: TaxTreatment;
  total_value: number;
  by_bucket: Record<AllocationBucket, number>;
}

/** Pure engine output — what computeComposition returns. */
export interface PortfolioComposition {
  total_value: number;
  buckets: CompositionBucket[];
  positions: CompositionPosition[];
  asset_location: AssetLocationRow[];
}

export interface PortfolioCompositionResponse extends PortfolioComposition {
  /** ISO date the composition was resolved at */
  as_of: string;
  /** effective_date of the resolved allocation.targets assumption */
  targets_effective_date: string | null;
  /** which layer the resolved allocation.targets came from */
  targets_source: AssumptionSource;
}
