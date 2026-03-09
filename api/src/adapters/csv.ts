import Papa from 'papaparse';
import type {
  Account,
  AccountSource,
  IngestResult,
  NormalizedTransaction,
  NormalizedInvestmentActivity,
  NormalizedHolding,
  NormalizedBalance,
  ProviderAdapter,
  ActivityType,
  AssetClass,
  AccountType,
  INVESTMENT_ACCOUNT_TYPES,
} from '../types/index.js';

// Known CSV formats from common institutions
type CsvFormat =
  | 'chase_checking'
  | 'chase_credit'
  | 'fidelity_transactions'
  | 'fidelity_positions'
  | 'vanguard_transactions'
  | 'vanguard_positions'
  | 'schwab_transactions'
  | 'schwab_positions'
  | 'generic_banking'     // fallback: Date, Description, Amount
  | 'generic_brokerage';  // fallback: Date, Action, Symbol, Quantity, Price, Amount

interface CsvParseOptions {
  format: CsvFormat;
  accountType: AccountType;
}

/**
 * Strip leading metadata/disclaimer rows that appear before the real CSV headers.
 * Fidelity and Schwab export files often include title rows, disclaimers, or
 * blank lines before the actual header row. We detect the header row by looking
 * for a line that contains several comma-separated tokens matching expected
 * column names for the given format, then discard everything above it.
 */
function stripMetadataRows(content: string, format: CsvFormat): string {
  // Remove BOM
  let cleaned = content.replace(/^\uFEFF/, '');

  // Format-specific header signatures (substrings we expect in the real header row)
  const headerSignatures: Partial<Record<CsvFormat, string[]>> = {
    fidelity_transactions: ['Run Date', 'Action', 'Amount'],
    fidelity_positions: ['Symbol', 'Quantity', 'Current Value'],
    schwab_transactions: ['Date', 'Action', 'Amount'],
    schwab_positions: ['Symbol', 'Quantity', 'Market Value'],
  };

  const sigs = headerSignatures[format];
  if (!sigs) return cleaned;

  const lines = cleaned.split(/\r?\n/);
  let headerIdx = 0;
  for (let i = 0; i < Math.min(lines.length, 15); i++) {
    const line = lines[i];
    if (sigs.every((sig) => line.toLowerCase().includes(sig.toLowerCase()))) {
      headerIdx = i;
      break;
    }
  }

  if (headerIdx > 0) {
    return lines.slice(headerIdx).join('\n');
  }

  return cleaned;
}

/**
 * Strip trailing summary/totals rows from Schwab-style CSVs.
 * Schwab appends "Transactions Total" or similar footer rows after the data.
 */
function stripFooterRows(rows: Record<string, string>[], format: CsvFormat): Record<string, string>[] {
  if (format !== 'schwab_transactions' && format !== 'schwab_positions') return rows;

  return rows.filter((row) => {
    const firstVal = Object.values(row)[0]?.trim() || '';
    // Schwab footer rows start with "Transactions Total" or "Account Total"
    if (firstVal.toLowerCase().includes('transactions total')) return false;
    if (firstVal.toLowerCase().includes('account total')) return false;
    return true;
  });
}

export class CsvAdapter implements ProviderAdapter {
  async sync(_account: Account, _source: AccountSource): Promise<IngestResult> {
    throw new Error('CSV adapter does not support sync — use parse()');
  }

  async parse(file: Buffer, format: string): Promise<IngestResult> {
    const raw = file.toString('utf-8');
    const opts = JSON.parse(format) as CsvParseOptions;

    // Pre-process: strip metadata rows, BOM, etc.
    const content = stripMetadataRows(raw, opts.format);

    const { data, errors } = Papa.parse(content, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h: string) => h.trim(),
    });

    if (errors.length > 0 && data.length === 0) {
      throw new Error(`CSV parse failed: ${errors[0].message}`);
    }

    let rows = data as Record<string, string>[];
    rows = stripFooterRows(rows, opts.format);

    switch (opts.format) {
      case 'chase_checking':
      case 'chase_credit':
        return parseChaseBanking(rows, opts);
      case 'fidelity_transactions':
        return parseFidelityTransactions(rows);
      case 'fidelity_positions':
        return parseFidelityPositions(rows);
      case 'vanguard_transactions':
        return parseVanguardTransactions(rows);
      case 'vanguard_positions':
        return parseVanguardPositions(rows);
      case 'schwab_transactions':
        return parseSchwabTransactions(rows);
      case 'schwab_positions':
        return parseSchwabPositions(rows);
      case 'generic_banking':
        return parseGenericBanking(rows);
      case 'generic_brokerage':
        return parseGenericBrokerage(rows);
      default:
        throw new Error(`Unknown CSV format: ${opts.format}`);
    }
  }
}

// ── Helpers ──

function parseDate(raw: string): string {
  // Handle MM/DD/YYYY, YYYY-MM-DD, M/D/YYYY
  const cleaned = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) return cleaned;

  const parts = cleaned.split('/');
  if (parts.length === 3) {
    const [m, d, y] = parts;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  throw new Error(`Cannot parse date: ${raw}`);
}

function parseAmount(raw: string): number {
  // Remove $, commas, spaces, handle parens for negative
  let cleaned = raw.trim().replace(/[$,\s]/g, '');
  if (cleaned.startsWith('(') && cleaned.endsWith(')')) {
    cleaned = '-' + cleaned.slice(1, -1);
  }
  const num = parseFloat(cleaned);
  if (isNaN(num)) throw new Error(`Cannot parse amount: ${raw}`);
  return num;
}

function findColumn(row: Record<string, string>, ...candidates: string[]): string | undefined {
  for (const c of candidates) {
    const key = Object.keys(row).find((k) => k.toLowerCase().trim() === c.toLowerCase());
    if (key && row[key]?.trim()) return row[key].trim();
  }
  return undefined;
}

function emptyResult(): IngestResult {
  return { transactions: [], investmentActivity: [], balances: [], holdings: [] };
}

// ── Chase Banking (checking/savings/credit) ──
// Real Chase checking columns: Details, Posting Date, Description, Amount, Type, Balance, Check or Slip #
// Real Chase credit columns:   Transaction Date, Post Date, Description, Category, Type, Amount, Memo

function parseChaseBanking(rows: Record<string, string>[], opts: CsvParseOptions): IngestResult {
  const result = emptyResult();

  for (const row of rows) {
    // Chase checking uses "Posting Date", credit uses "Transaction Date"
    const dateStr = findColumn(row, 'Transaction Date', 'Posting Date', 'Post Date', 'Date');
    const description = findColumn(row, 'Description');
    const amountStr = findColumn(row, 'Amount');

    if (!dateStr || !description || !amountStr) continue;

    let amount = parseAmount(amountStr);
    // Chase credit CSVs: positive = charge, negative = payment/credit. Flip for our convention.
    // Chase checking: negative = debit, positive = credit — already matches our convention.
    if (opts.format === 'chase_credit') amount = -amount;

    result.transactions.push({
      date: parseDate(dateStr),
      amount,
      description,
      category: findColumn(row, 'Category') || undefined,
    });
  }

  return result;
}

// ── Fidelity Transactions ──
// Columns: Run Date, Action, Symbol, Description, Type, Quantity, Price ($), Commission ($), Fees ($), Amount ($)

function parseFidelityTransactions(rows: Record<string, string>[]): IngestResult {
  const result = emptyResult();

  for (const row of rows) {
    const dateStr = findColumn(row, 'Run Date', 'Date', 'Settlement Date');
    const action = findColumn(row, 'Action');
    const amountStr = findColumn(row, 'Amount ($)', 'Amount');

    if (!dateStr || !amountStr) continue;

    const amount = parseAmount(amountStr);
    const symbol = findColumn(row, 'Symbol')?.replace(/\s/g, '') || undefined;
    const quantityStr = findColumn(row, 'Quantity');
    const priceStr = findColumn(row, 'Price ($)', 'Price');
    const commissionStr = findColumn(row, 'Commission ($)', 'Commission');

    const activityType = mapFidelityAction(action || '');

    result.investmentActivity.push({
      date: parseDate(dateStr),
      activityType,
      symbol,
      description: findColumn(row, 'Description') || action || undefined,
      quantity: quantityStr ? Math.abs(parseAmount(quantityStr)) : undefined,
      price: priceStr ? parseAmount(priceStr) : undefined,
      amount,
      commission: commissionStr ? Math.abs(parseAmount(commissionStr)) : undefined,
    });
  }

  return result;
}

function mapFidelityAction(action: string): ActivityType {
  const a = action.toUpperCase().trim();
  if (a.includes('BOUGHT') || a.includes('BUY') || a.includes('PURCHASE')) return 'buy';
  if (a.includes('SOLD') || a.includes('SELL')) return 'sell';
  if (a.includes('REINVEST')) return 'reinvestment';
  if (a.includes('DIVIDEND') || a.includes('DIV') || a.includes('CAP GAIN') || a.includes('CAPITAL GAIN')) return 'dividend';
  if (a.includes('SPLIT')) return 'split';
  if (a.includes('TRANSFER') && a.includes('IN')) return 'transfer_in';
  if (a.includes('TRANSFER') && a.includes('OUT')) return 'transfer_out';
  if (a.includes('FEE') || a.includes('ADVISORY')) return 'fee';
  if (a.includes('INTEREST')) return 'interest';
  if (a.includes('RETURN OF CAPITAL') || a.includes('ROC')) return 'return_of_capital';
  return 'buy'; // fallback
}

// ── Fidelity Positions ──
// Columns: Account Number, Symbol, Description, Quantity, Last Price, Current Value, Cost Basis Total, ...

function parseFidelityPositions(rows: Record<string, string>[]): IngestResult {
  const result = emptyResult();
  const today = new Date().toISOString().split('T')[0];

  for (const row of rows) {
    const symbol = findColumn(row, 'Symbol')?.replace(/\s/g, '');
    const quantityStr = findColumn(row, 'Quantity');
    const valueStr = findColumn(row, 'Current Value');

    if (!symbol || !quantityStr || !valueStr) continue;
    if (symbol === 'Pending Activity' || symbol.includes('**')) continue;

    const quantity = parseAmount(quantityStr);
    const marketValue = parseAmount(valueStr);
    const priceStr = findColumn(row, 'Last Price', 'Last Price Change');
    const costStr = findColumn(row, 'Cost Basis Total', 'Cost Basis Per Share');

    result.holdings.push({
      asOf: today,
      symbol,
      name: findColumn(row, 'Description') || undefined,
      quantity,
      price: priceStr ? parseAmount(priceStr) : undefined,
      marketValue,
      costBasis: costStr ? parseAmount(costStr) : undefined,
      assetClass: guessAssetClass(symbol),
    });
  }

  // Derive balance from total holdings
  if (result.holdings.length > 0) {
    const total = result.holdings.reduce((sum, h) => sum + h.marketValue, 0);
    result.balances.push({ date: today, balance: Math.round(total * 100) / 100 });
  }

  return result;
}

// ── Vanguard Transactions ──
// Columns: Account Number, Trade Date, Settlement Date, Transaction Type, Transaction Description, Investment Name, Symbol, Shares, Share Price, Principal Amount, Commission Fees, Net Amount

function parseVanguardTransactions(rows: Record<string, string>[]): IngestResult {
  const result = emptyResult();

  for (const row of rows) {
    const dateStr = findColumn(row, 'Trade Date', 'Settlement Date', 'Date');
    const amountStr = findColumn(row, 'Net Amount', 'Principal Amount', 'Amount');

    if (!dateStr || !amountStr) continue;

    const txnType = findColumn(row, 'Transaction Type', 'Transaction Description') || '';
    const symbol = findColumn(row, 'Symbol')?.replace(/\s/g, '') || undefined;
    const sharesStr = findColumn(row, 'Shares', 'Quantity');
    const priceStr = findColumn(row, 'Share Price', 'Price');
    const commStr = findColumn(row, 'Commission Fees', 'Commission');

    result.investmentActivity.push({
      date: parseDate(dateStr),
      activityType: mapVanguardType(txnType),
      symbol,
      description: findColumn(row, 'Investment Name', 'Transaction Description') || undefined,
      quantity: sharesStr ? Math.abs(parseAmount(sharesStr)) : undefined,
      price: priceStr ? parseAmount(priceStr) : undefined,
      amount: parseAmount(amountStr),
      commission: commStr ? Math.abs(parseAmount(commStr)) : undefined,
    });
  }

  return result;
}

function mapVanguardType(type: string): ActivityType {
  const t = type.toUpperCase();
  if (t.includes('BUY') || t.includes('PURCHASE') || t.includes('CONTRIBUTION')) return 'buy';
  if (t.includes('SELL') || t.includes('REDEMPTION') || t.includes('WITHDRAWAL')) return 'sell';
  if (t.includes('REINVESTMENT') || t.includes('REINVEST')) return 'reinvestment';
  if (t.includes('DIVIDEND') || t.includes('CAPITAL GAIN') || t.includes('DISTRIBUTION')) return 'dividend';
  if (t.includes('TRANSFER IN') || t.includes('ROLLOVER')) return 'transfer_in';
  if (t.includes('TRANSFER OUT')) return 'transfer_out';
  if (t.includes('FEE')) return 'fee';
  return 'buy';
}

// ── Vanguard Positions ──

function parseVanguardPositions(rows: Record<string, string>[]): IngestResult {
  const result = emptyResult();
  const today = new Date().toISOString().split('T')[0];

  for (const row of rows) {
    const symbol = findColumn(row, 'Symbol', 'Ticker')?.replace(/\s/g, '');
    const sharesStr = findColumn(row, 'Shares', 'Quantity');
    const valueStr = findColumn(row, 'Total Value', 'Current Value', 'Market Value');

    if (!symbol || !sharesStr || !valueStr) continue;

    result.holdings.push({
      asOf: today,
      symbol,
      name: findColumn(row, 'Investment Name', 'Name', 'Description') || undefined,
      quantity: parseAmount(sharesStr),
      price: findColumn(row, 'Share Price', 'Price') ? parseAmount(findColumn(row, 'Share Price', 'Price')!) : undefined,
      marketValue: parseAmount(valueStr),
      costBasis: findColumn(row, 'Cost Basis', 'Total Cost') ? parseAmount(findColumn(row, 'Cost Basis', 'Total Cost')!) : undefined,
      assetClass: guessAssetClass(symbol),
    });
  }

  if (result.holdings.length > 0) {
    const total = result.holdings.reduce((sum, h) => sum + h.marketValue, 0);
    result.balances.push({ date: today, balance: Math.round(total * 100) / 100 });
  }

  return result;
}

// ── Schwab Transactions ──
// Columns: Date, Action, Symbol, Description, Quantity, Price, Fees & Comm, Amount

function parseSchwabTransactions(rows: Record<string, string>[]): IngestResult {
  const result = emptyResult();

  for (const row of rows) {
    const dateStr = findColumn(row, 'Date');
    const amountStr = findColumn(row, 'Amount');

    if (!dateStr || !amountStr) continue;

    const action = findColumn(row, 'Action') || '';
    const symbol = findColumn(row, 'Symbol')?.replace(/\s/g, '') || undefined;

    result.investmentActivity.push({
      date: parseDate(dateStr),
      activityType: mapSchwabAction(action),
      symbol,
      description: findColumn(row, 'Description') || action || undefined,
      quantity: findColumn(row, 'Quantity') ? Math.abs(parseAmount(findColumn(row, 'Quantity')!)) : undefined,
      price: findColumn(row, 'Price') ? parseAmount(findColumn(row, 'Price')!) : undefined,
      amount: parseAmount(amountStr),
      commission: findColumn(row, 'Fees & Comm', 'Fees & Commission') ? Math.abs(parseAmount(findColumn(row, 'Fees & Comm', 'Fees & Commission')!)) : undefined,
    });
  }

  return result;
}

function mapSchwabAction(action: string): ActivityType {
  const a = action.toUpperCase();
  if (a.includes('BUY')) return 'buy';
  if (a.includes('SELL')) return 'sell';
  if (a.includes('REINVEST')) return 'reinvestment';
  if (a.includes('DIVIDEND') || a.includes('QUAL DIV') || a.includes('CASH DIV')) return 'dividend';
  if (a.includes('ADV FEE') || a.includes('FEE')) return 'fee';
  if (a.includes('INTEREST') || a.includes('BANK INT')) return 'interest';
  if (a.includes('JOURNAL') && a.includes('IN')) return 'transfer_in';
  if (a.includes('JOURNAL') && a.includes('OUT')) return 'transfer_out';
  return 'buy';
}

// ── Schwab Positions ──

function parseSchwabPositions(rows: Record<string, string>[]): IngestResult {
  const result = emptyResult();
  const today = new Date().toISOString().split('T')[0];

  for (const row of rows) {
    const symbol = findColumn(row, 'Symbol')?.replace(/\s/g, '');
    const quantityStr = findColumn(row, 'Quantity');
    const valueStr = findColumn(row, 'Market Value');

    if (!symbol || !quantityStr || !valueStr) continue;
    if (symbol === 'Account Total' || symbol === '--') continue;

    result.holdings.push({
      asOf: today,
      symbol,
      name: findColumn(row, 'Name', 'Description') || undefined,
      quantity: parseAmount(quantityStr),
      price: findColumn(row, 'Price') ? parseAmount(findColumn(row, 'Price')!) : undefined,
      marketValue: parseAmount(valueStr),
      costBasis: findColumn(row, 'Cost Basis') ? parseAmount(findColumn(row, 'Cost Basis')!) : undefined,
      assetClass: guessAssetClass(symbol),
    });
  }

  if (result.holdings.length > 0) {
    const total = result.holdings.reduce((sum, h) => sum + h.marketValue, 0);
    result.balances.push({ date: today, balance: Math.round(total * 100) / 100 });
  }

  return result;
}

// ── Generic Fallbacks ──

function parseGenericBanking(rows: Record<string, string>[]): IngestResult {
  const result = emptyResult();

  for (const row of rows) {
    const dateStr = findColumn(row, 'Date', 'Transaction Date', 'Post Date', 'Posting Date');
    const description = findColumn(row, 'Description', 'Memo', 'Payee', 'Name');
    const amountStr = findColumn(row, 'Amount', 'Transaction Amount');

    if (!dateStr || !description || !amountStr) continue;

    result.transactions.push({
      date: parseDate(dateStr),
      amount: parseAmount(amountStr),
      description,
      category: findColumn(row, 'Category', 'Type') || undefined,
    });
  }

  return result;
}

function parseGenericBrokerage(rows: Record<string, string>[]): IngestResult {
  const result = emptyResult();

  for (const row of rows) {
    const dateStr = findColumn(row, 'Date', 'Trade Date', 'Settlement Date');
    const amountStr = findColumn(row, 'Amount', 'Net Amount', 'Total');

    if (!dateStr || !amountStr) continue;

    const action = findColumn(row, 'Action', 'Type', 'Transaction Type') || 'buy';
    const symbol = findColumn(row, 'Symbol', 'Ticker') || undefined;

    result.investmentActivity.push({
      date: parseDate(dateStr),
      activityType: mapGenericAction(action),
      symbol,
      description: findColumn(row, 'Description', 'Name') || undefined,
      quantity: findColumn(row, 'Quantity', 'Shares') ? Math.abs(parseAmount(findColumn(row, 'Quantity', 'Shares')!)) : undefined,
      price: findColumn(row, 'Price', 'Share Price') ? parseAmount(findColumn(row, 'Price', 'Share Price')!) : undefined,
      amount: parseAmount(amountStr),
    });
  }

  return result;
}

function mapGenericAction(action: string): ActivityType {
  const a = action.toUpperCase();
  if (a.includes('BUY') || a.includes('PURCHASE')) return 'buy';
  if (a.includes('SELL') || a.includes('SOLD')) return 'sell';
  if (a.includes('DIV') && a.includes('REINV')) return 'reinvestment';
  if (a.includes('DIV')) return 'dividend';
  if (a.includes('FEE')) return 'fee';
  if (a.includes('INTEREST') || a.includes('INT')) return 'interest';
  if (a.includes('SPLIT')) return 'split';
  return 'buy';
}

function guessAssetClass(symbol: string): AssetClass {
  const s = symbol.toUpperCase();
  if (['BND', 'VBTLX', 'AGG', 'TLT', 'VTIP', 'BNDX', 'BSV', 'BIV', 'BLV', 'TIPS'].some((b) => s.includes(b))) return 'fixed_income';
  if (['BTC', 'ETH', 'GBTC', 'ETHE', 'BITO'].some((c) => s.includes(c))) return 'crypto';
  if (['VNQ', 'VGSLX', 'SCHH', 'IYR', 'REIT'].some((r) => s.includes(r))) return 'real_estate';
  if (['GLD', 'SLV', 'IAU', 'DBA', 'USO'].some((c) => s.includes(c))) return 'commodity';
  if (['SPAXX', 'FDRXX', 'VMFXX', 'SWVXX'].some((c) => s === c)) return 'cash';
  return 'equity';
}
