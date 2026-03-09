import type {
  Account,
  AccountSource,
  IngestResult,
  NormalizedTransaction,
  NormalizedInvestmentActivity,
  NormalizedBalance,
  NormalizedHolding,
  ProviderAdapter,
} from '../types/index.js';

// Manual entry — the user provides the data directly via the API.
// This adapter just passes through the normalized shapes.

interface ManualEntryPayload {
  transactions?: NormalizedTransaction[];
  investmentActivity?: NormalizedInvestmentActivity[];
  balances?: NormalizedBalance[];
  holdings?: NormalizedHolding[];
}

export class ManualAdapter implements ProviderAdapter {
  private payload: ManualEntryPayload;

  constructor(payload: ManualEntryPayload) {
    this.payload = payload;
  }

  async sync(_account: Account, _source: AccountSource): Promise<IngestResult> {
    return {
      transactions: this.payload.transactions || [],
      investmentActivity: this.payload.investmentActivity || [],
      balances: this.payload.balances || [],
      holdings: this.payload.holdings || [],
    };
  }
}
