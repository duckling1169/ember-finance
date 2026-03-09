import { describe, it, expect } from 'vitest';
import { CsvAdapter } from '../../src/adapters/csv.js';

const adapter = new CsvAdapter();
const parse = (csv: string, format: string) =>
  adapter.parse(Buffer.from(csv), JSON.stringify(format));

// ── Chase Checking (real format) ──

describe('CSV: Chase Checking', () => {
  // Real Chase checking export format: Details,Posting Date,Description,Amount,Type,Balance,Check or Slip #
  const csv = `Details,Posting Date,Description,Amount,Type,Balance,Check or Slip #
DEBIT,01/16/2025,"WHOLE FOODS MARKET #1234",-142.37,DEBIT_CARD,3857.63,
CREDIT,01/10/2025,"PAYROLL DIRECT DEP",5200.00,ACH_CREDIT,4000.00,
DEBIT,01/19/2025,"SHELL OIL 57442",-45.80,DEBIT_CARD,3811.83,
DEBIT,01/20/2025,"NETFLIX.COM",-15.99,ACH_DEBIT,3795.84,
DEBIT,01/22/2025,"ZELLE PAYMENT TO JOHN",-200.00,DEBIT_CARD,3595.84,
DEBIT,01/25/2025,"ATM WITHDRAWAL",-100.00,ATM,3495.84,`;

  it('parses all rows as transactions', async () => {
    const result = await parse(csv, { format: 'chase_checking', accountType: 'checking' });

    expect(result.transactions).toHaveLength(6);
    expect(result.investmentActivity).toHaveLength(0);
    expect(result.holdings).toHaveLength(0);
  });

  it('parses dates from MM/DD/YYYY to YYYY-MM-DD', async () => {
    const result = await parse(csv, { format: 'chase_checking', accountType: 'checking' });
    expect(result.transactions[0].date).toBe('2025-01-16');
  });

  it('preserves amounts correctly (negative = outflow)', async () => {
    const result = await parse(csv, { format: 'chase_checking', accountType: 'checking' });
    const groceries = result.transactions.find((t) => t.description.includes('WHOLE FOODS'));
    expect(groceries!.amount).toBe(-142.37);

    const payroll = result.transactions.find((t) => t.description.includes('PAYROLL'));
    expect(payroll!.amount).toBe(5200.00);
  });

  it('works with legacy Transaction Date format too', async () => {
    const legacyCsv = `Transaction Date,Post Date,Description,Category,Type,Amount,Memo
01/15/2025,01/16/2025,WHOLE FOODS,-142.37,Sale,-142.37,`;
    const result = await parse(legacyCsv, { format: 'chase_checking', accountType: 'checking' });
    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0].date).toBe('2025-01-15');
  });
});

// ── Chase Credit Card ──

describe('CSV: Chase Credit Card', () => {
  // Real Chase credit format: Transaction Date,Post Date,Description,Category,Type,Amount,Memo
  const csv = `Transaction Date,Post Date,Description,Category,Type,Amount,Memo
03/02/2025,03/03/2025,AMAZON.COM*ABC123,Shopping,Sale,89.00,
03/05/2025,03/06/2025,UBER EATS,Food & Drink,Sale,34.50,
03/10/2025,03/10/2025,PAYMENT THANK YOU,Payment,Payment,-1500.00,
03/12/2025,03/13/2025,DELTA AIR LINES,Travel,Sale,250.00,`;

  it('flips sign for credit card convention', async () => {
    // Our convention: negative = money out of your pocket, positive = money in
    // Chase credit: 89.00 (charge) should become -89.00 (you spent money)
    const result = await parse(csv, { format: 'chase_credit', accountType: 'credit' });

    const amazon = result.transactions.find((t) => t.description.includes('AMAZON'));
    expect(amazon!.amount).toBe(-89.00);

    const payment = result.transactions.find((t) => t.description.includes('PAYMENT'));
    expect(payment!.amount).toBe(1500.00); // payment reduces what you owe = positive
  });

  it('captures categories from credit card CSV', async () => {
    const result = await parse(csv, { format: 'chase_credit', accountType: 'credit' });
    const amazon = result.transactions.find((t) => t.description.includes('AMAZON'));
    expect(amazon!.category).toBe('Shopping');
  });
});

// ── Fidelity Transactions ──

describe('CSV: Fidelity Transactions', () => {
  const csv = `Run Date,Action,Symbol,Description,Type,Quantity,Price ($),Commission ($),Fees ($),Amount ($)
01/02/2025, YOU BOUGHT,VTI,VANGUARD TOT STK MKT,Cash,50,250.00,0.00,0.00,-12500.00
01/02/2025, YOU BOUGHT,VXUS,VANGUARD INTL STK,Cash,100,58.00,0.00,0.00,-5800.00
03/15/2025, DIVIDEND RECEIVED,VTI,VANGUARD TOT STK MKT,Cash,,,,,85.20
03/15/2025, REINVESTMENT,VTI,VANGUARD TOT STK MKT,Cash,0.317,268.77,,,-85.20
04/10/2025, YOU SOLD,AAPL,APPLE INC,Cash,10,195.00,0.00,0.00,1950.00
06/01/2025, SHORT-TERM CAP GAIN,VTI,VANGUARD TOT STK MKT,Cash,,,,,12.45`;

  it('parses all rows as investment activity', async () => {
    const result = await parse(csv, { format: 'fidelity_transactions', accountType: 'brokerage' });
    expect(result.investmentActivity).toHaveLength(6);
    expect(result.transactions).toHaveLength(0);
  });

  it('maps action types correctly', async () => {
    const result = await parse(csv, { format: 'fidelity_transactions', accountType: 'brokerage' });

    const types = result.investmentActivity.map((a) => a.activityType);
    expect(types).toEqual(['buy', 'buy', 'dividend', 'reinvestment', 'sell', 'dividend']);
  });

  it('parses quantities and prices', async () => {
    const result = await parse(csv, { format: 'fidelity_transactions', accountType: 'brokerage' });

    const vtiBuy = result.investmentActivity.find((a) => a.symbol === 'VTI' && a.activityType === 'buy');
    expect(vtiBuy!.quantity).toBe(50);
    expect(vtiBuy!.price).toBe(250.00);
    expect(vtiBuy!.amount).toBe(-12500.00);
  });

  it('handles DRIP reinvestment with fractional shares', async () => {
    const result = await parse(csv, { format: 'fidelity_transactions', accountType: 'brokerage' });

    const reinvest = result.investmentActivity.find((a) => a.activityType === 'reinvestment');
    expect(reinvest!.symbol).toBe('VTI');
    expect(reinvest!.quantity).toBe(0.317);
    expect(reinvest!.amount).toBe(-85.20);
  });

  it('handles sell correctly', async () => {
    const result = await parse(csv, { format: 'fidelity_transactions', accountType: 'brokerage' });

    const sell = result.investmentActivity.find((a) => a.activityType === 'sell');
    expect(sell!.symbol).toBe('AAPL');
    expect(sell!.quantity).toBe(10);
    expect(sell!.amount).toBe(1950.00);
  });

  it('handles Fidelity CSV with disclaimer rows before headers', async () => {
    const csvWithDisclaimer = `Brokerage
Account Z12345678

Run Date,Action,Symbol,Description,Type,Quantity,Price ($),Commission ($),Fees ($),Amount ($)
01/02/2025, YOU BOUGHT,VTI,VANGUARD TOT STK MKT,Cash,50,250.00,0.00,0.00,-12500.00`;

    const result = await parse(csvWithDisclaimer, { format: 'fidelity_transactions', accountType: 'brokerage' });
    expect(result.investmentActivity).toHaveLength(1);
    expect(result.investmentActivity[0].symbol).toBe('VTI');
  });
});

// ── Fidelity Positions ──

describe('CSV: Fidelity Positions', () => {
  const csv = `Account Number,Symbol,Description,Quantity,Last Price,Current Value,Cost Basis Total,Type
Z12345678,VTI,VANGUARD TOT STK MKT ETF,412.500,$269.40,"$111,127.50","$95,200.00",Cash
Z12345678,VXUS,VANGUARD INTL STK MKT ETF,285.000,$58.80,"$16,758.00","$15,100.00",Cash
Z12345678,BND,VANGUARD TOT BOND MKT ETF,520.000,$71.80,"$37,336.00","$36,800.00",Cash
Z12345678,SPAXX,FID GOVT MMKT,1250.000,$1.00,"$1,250.00","$1,250.00",Cash
Z12345678,Pending Activity,,,,,, `;

  it('parses holdings with dollar signs and commas', async () => {
    const result = await parse(csv, { format: 'fidelity_positions', accountType: 'brokerage' });

    expect(result.holdings).toHaveLength(4); // skips Pending Activity
    const vti = result.holdings.find((h) => h.symbol === 'VTI');
    expect(vti!.quantity).toBe(412.5);
    expect(vti!.price).toBe(269.40);
    expect(vti!.marketValue).toBe(111127.50);
    expect(vti!.costBasis).toBe(95200.00);
  });

  it('guesses asset classes', async () => {
    const result = await parse(csv, { format: 'fidelity_positions', accountType: 'brokerage' });

    const vti = result.holdings.find((h) => h.symbol === 'VTI');
    expect(vti!.assetClass).toBe('equity');

    const bnd = result.holdings.find((h) => h.symbol === 'BND');
    expect(bnd!.assetClass).toBe('fixed_income');

    const spaxx = result.holdings.find((h) => h.symbol === 'SPAXX');
    expect(spaxx!.assetClass).toBe('cash');
  });

  it('derives balance from total holdings', async () => {
    const result = await parse(csv, { format: 'fidelity_positions', accountType: 'brokerage' });

    expect(result.balances).toHaveLength(1);
    const expectedTotal = 111127.50 + 16758.00 + 37336.00 + 1250.00;
    expect(result.balances[0].balance).toBe(expectedTotal);
  });

  it('handles positions CSV with disclaimer rows', async () => {
    const csvWithDisclaimer = `Fidelity Investments
Portfolio Positions as of 01/15/2025

Account Number,Symbol,Description,Quantity,Last Price,Current Value,Cost Basis Total,Type
Z12345678,VTI,VANGUARD TOT STK MKT ETF,100.000,$269.40,"$26,940.00","$25,000.00",Cash`;

    const result = await parse(csvWithDisclaimer, { format: 'fidelity_positions', accountType: 'brokerage' });
    expect(result.holdings).toHaveLength(1);
    expect(result.holdings[0].symbol).toBe('VTI');
  });
});

// ── Schwab Transactions ──

describe('CSV: Schwab Transactions', () => {
  const csv = `Date,Action,Symbol,Description,Quantity,Price,Fees & Comm,Amount
01/15/2025,Buy,VTI,VANGUARD TOT STK MKT,20,$260.00,$0.00,"-$5,200.00"
02/01/2025,Qual Div,VTI,VANGUARD TOT STK MKT,,,,$42.30
02/01/2025,Reinvest Shares,VTI,VANGUARD TOT STK MKT,0.158,$267.72,$0.00,"-$42.30"
03/10/2025,Sell,AAPL,APPLE INC,5,$195.00,$4.95,$970.05
03/15/2025,Bank Interest,,,,,,$2.15
03/20/2025,Adv Fee,,ADV FEE Q1 2025,,,,-$35.00`;

  it('maps Schwab actions correctly', async () => {
    const result = await parse(csv, { format: 'schwab_transactions', accountType: 'brokerage' });

    const types = result.investmentActivity.map((a) => a.activityType);
    expect(types).toEqual(['buy', 'dividend', 'reinvestment', 'sell', 'interest', 'fee']);
  });

  it('parses dollar amounts with $ prefix and commas', async () => {
    const result = await parse(csv, { format: 'schwab_transactions', accountType: 'brokerage' });

    const buy = result.investmentActivity.find((a) => a.activityType === 'buy');
    expect(buy!.amount).toBe(-5200.00);
    expect(buy!.price).toBe(260.00);
  });

  it('captures commissions', async () => {
    const result = await parse(csv, { format: 'schwab_transactions', accountType: 'brokerage' });

    const sell = result.investmentActivity.find((a) => a.activityType === 'sell');
    expect(sell!.commission).toBe(4.95);
  });

  it('handles fee with no symbol', async () => {
    const result = await parse(csv, { format: 'schwab_transactions', accountType: 'brokerage' });

    const fee = result.investmentActivity.find((a) => a.activityType === 'fee');
    expect(fee!.symbol).toBeUndefined();
    expect(fee!.amount).toBe(-35.00);
  });

  it('handles Schwab CSV with header metadata rows', async () => {
    const csvWithHeader = `"Transactions for account XXXX-1234 as of 01/20/2025"

Date,Action,Symbol,Description,Quantity,Price,Fees & Comm,Amount
01/15/2025,Buy,VTI,VANGUARD TOT STK MKT,20,$260.00,$0.00,"-$5,200.00"
Transactions Total,,,,,,,"$-5,200.00"`;

    const result = await parse(csvWithHeader, { format: 'schwab_transactions', accountType: 'brokerage' });
    expect(result.investmentActivity).toHaveLength(1);
    expect(result.investmentActivity[0].activityType).toBe('buy');
    expect(result.investmentActivity[0].amount).toBe(-5200.00);
  });

  it('strips Schwab footer totals rows', async () => {
    const csvWithFooter = `Date,Action,Symbol,Description,Quantity,Price,Fees & Comm,Amount
01/15/2025,Buy,VTI,VANGUARD TOT STK MKT,20,$260.00,$0.00,"-$5,200.00"
02/01/2025,Qual Div,VTI,VANGUARD TOT STK MKT,,,,$42.30
Transactions Total,,,,,,,"$-5,157.70"`;

    const result = await parse(csvWithFooter, { format: 'schwab_transactions', accountType: 'brokerage' });
    expect(result.investmentActivity).toHaveLength(2);
  });
});

// ── Schwab Positions ──

describe('CSV: Schwab Positions', () => {
  const csv = `Symbol,Description,Quantity,Price,Price Change %,Price Change $,Market Value,Day Change %,Day Change $,Cost Basis,Gain/Loss %,Gain/Loss $,Ratings,Reinvest Dividends?,Reinvest Cap Gains?,% Of Account
VTI,VANGUARD TOT STK MKT,100,$260.00,0.5%,$1.30,"$26,000.00",0.5%,$130.00,"$24,000.00",8.33%,"$2,000.00",A,Yes,Yes,52%
VXUS,VANGUARD INTL STK,200,$58.00,-0.2%,-$0.12,"$11,600.00",-0.2%,-$23.20,"$10,800.00",7.41%,$800.00,B+,Yes,Yes,23.2%
SPAXX,FID GOVT MMKT,"12,500",$1.00,--,--,"$12,500.00",--,--,"$12,500.00",0%,$0.00,--,--,--,25%
Account Total,,,,,,"$50,100.00",,,,,,,,, `;

  it('parses Schwab positions with extended columns', async () => {
    const result = await parse(csv, { format: 'schwab_positions', accountType: 'brokerage' });

    expect(result.holdings).toHaveLength(3); // skips Account Total
    const vti = result.holdings.find((h) => h.symbol === 'VTI');
    expect(vti!.quantity).toBe(100);
    expect(vti!.price).toBe(260.00);
    expect(vti!.marketValue).toBe(26000.00);
  });

  it('skips Account Total row', async () => {
    const result = await parse(csv, { format: 'schwab_positions', accountType: 'brokerage' });
    const symbols = result.holdings.map((h) => h.symbol);
    expect(symbols).not.toContain('Account Total');
  });

  it('derives balance from holdings', async () => {
    const result = await parse(csv, { format: 'schwab_positions', accountType: 'brokerage' });
    expect(result.balances).toHaveLength(1);
    expect(result.balances[0].balance).toBe(26000.00 + 11600.00 + 12500.00);
  });
});

// ── Generic Banking ──

describe('CSV: Generic Banking', () => {
  const csv = `Date,Description,Amount,Category
2025-01-15,Grocery Store,-42.50,Food
2025-01-16,Salary,5200.00,Income
2025-01-17,Electric Bill,-65.00,Utilities`;

  it('parses with ISO dates', async () => {
    const result = await parse(csv, { format: 'generic_banking', accountType: 'checking' });

    expect(result.transactions).toHaveLength(3);
    expect(result.transactions[0].date).toBe('2025-01-15');
  });

  it('handles amounts without dollar signs', async () => {
    const result = await parse(csv, { format: 'generic_banking', accountType: 'checking' });
    expect(result.transactions[0].amount).toBe(-42.50);
    expect(result.transactions[1].amount).toBe(5200.00);
  });
});

// ── Edge cases ──

describe('CSV: Edge cases', () => {
  it('handles empty file', async () => {
    const csv = `Date,Description,Amount\n`;
    const result = await parse(csv, { format: 'generic_banking', accountType: 'checking' });
    expect(result.transactions).toHaveLength(0);
  });

  it('handles amounts in parentheses (negative)', async () => {
    const csv = `Date,Description,Amount
01/15/2025,Some Charge,(42.50)
01/16/2025,Payment,100.00`;

    const result = await parse(csv, { format: 'generic_banking', accountType: 'checking' });
    expect(result.transactions[0].amount).toBe(-42.50);
  });

  it('skips rows with missing required fields', async () => {
    const csv = `Date,Description,Amount
01/15/2025,Good Row,-50.00
,,
01/16/2025,,100.00
,Missing Date,-25.00`;

    const result = await parse(csv, { format: 'generic_banking', accountType: 'checking' });
    expect(result.transactions).toHaveLength(1); // only first row is complete
  });

  it('handles BOM and extra whitespace in headers', async () => {
    const csv = `\uFEFF Date , Description , Amount \n01/15/2025,Test,-50.00`;
    const result = await parse(csv, { format: 'generic_banking', accountType: 'checking' });
    expect(result.transactions).toHaveLength(1);
  });

  it('rejects unparseable format option', async () => {
    const csv = `Date,Amount\n2025-01-01,100`;
    await expect(parse(csv, { format: 'nonexistent_bank', accountType: 'checking' }))
      .rejects.toThrow('Unknown CSV format');
  });

  it('handles quoted fields with commas inside', async () => {
    const csv = `Date,Description,Amount
01/15/2025,"PAYMENT TO SMITH, JOHN",-500.00`;

    const result = await parse(csv, { format: 'generic_banking', accountType: 'checking' });
    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0].description).toBe('PAYMENT TO SMITH, JOHN');
  });

  it('handles CRLF line endings', async () => {
    const csv = `Date,Description,Amount\r\n01/15/2025,Test,-50.00\r\n01/16/2025,Test2,100.00\r\n`;
    const result = await parse(csv, { format: 'generic_banking', accountType: 'checking' });
    expect(result.transactions).toHaveLength(2);
  });
});
