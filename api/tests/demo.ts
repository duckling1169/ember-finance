import { supabase } from '../src/lib/supabase.js';
import { processIngest } from '../src/services/ingest.js';

async function main() {
  // Setup: household + member
  const { data: hh } = await supabase
    .from('household')
    .insert({ name: 'Demo Household' })
    .select()
    .single();

  await supabase
    .from('member')
    .insert({ household_id: hh!.id, display_name: 'Adam', role: 'owner' });

  const hhId = hh!.id;
  console.log('Household:', hhId, '\n');

  // ── CREATE ACCOUNTS ──
  const accs = [
    { name: 'Chase Checking', institution: 'Chase', account_type: 'checking', is_liability: false },
    { name: 'Fidelity 401k', institution: 'Fidelity', account_type: 'retirement', is_liability: false },
    { name: 'Amex Gold', institution: 'Amex', account_type: 'credit', is_liability: true },
  ];

  const created: Record<string, string> = {};
  for (const acc of accs) {
    const { data } = await supabase
      .from('account')
      .insert({ household_id: hhId, ...acc })
      .select()
      .single();
    created[acc.account_type] = data!.id;
    console.log(`Created: ${acc.name} (${acc.account_type})`);
  }

  // Create manual sources
  const sources: Record<string, string> = {};
  for (const [type, accId] of Object.entries(created)) {
    const { data } = await supabase
      .from('account_source')
      .insert({ account_id: accId, household_id: hhId, provider: 'manual' })
      .select()
      .single();
    sources[type] = data!.id;
  }

  // ── INGEST: Checking transactions ──
  console.log('\n━━━ Checking Account ━━━');
  await processIngest(
    { householdId: hhId, accountId: created.checking, sourceId: sources.checking, sourceType: 'manual_entry' },
    {
      transactions: [
        { date: '2025-03-01', amount: 5200.00, description: 'Paycheck - Direct Deposit', category: 'income' },
        { date: '2025-03-03', amount: -1800.00, description: 'Mortgage Payment', isTransfer: true },
        { date: '2025-03-05', amount: -142.37, description: 'Whole Foods Market', category: 'groceries' },
        { date: '2025-03-06', amount: -65.00, description: 'Electric Bill', category: 'utilities' },
        { date: '2025-03-07', amount: -12.50, description: 'Netflix', category: 'entertainment' },
        { date: '2025-03-08', amount: -45.80, description: 'Shell Gas Station', category: 'transport' },
      ],
      investmentActivity: [],
      balances: [{ date: '2025-03-08', balance: 8234.33, available: 8234.33 }],
      holdings: [],
    }
  );

  const { data: txns } = await supabase
    .from('transaction')
    .select('date, amount, description, category')
    .eq('account_id', created.checking)
    .order('date');
  console.table(txns);

  // ── INGEST: 401k holdings + activity ──
  console.log('\n━━━ Fidelity 401k ━━━');
  await processIngest(
    { householdId: hhId, accountId: created.retirement, sourceId: sources.retirement, sourceType: 'manual_entry' },
    {
      transactions: [],
      investmentActivity: [
        { date: '2025-03-01', activityType: 'buy', symbol: 'VTI', quantity: 5.2, price: 268.50, amount: -1396.20 },
        { date: '2025-03-01', activityType: 'buy', symbol: 'VXUS', quantity: 3.8, price: 58.20, amount: -221.16 },
        { date: '2025-03-01', activityType: 'buy', symbol: 'BND', quantity: 4.0, price: 71.50, amount: -286.00 },
        { date: '2025-03-05', activityType: 'dividend', symbol: 'VTI', amount: 42.30 },
        { date: '2025-03-05', activityType: 'reinvestment', symbol: 'VTI', quantity: 0.157, price: 269.40, amount: -42.30 },
      ],
      balances: [{ date: '2025-03-08', balance: 187542.00 }],
      holdings: [
        { asOf: '2025-03-08', symbol: 'VTI', name: 'Vanguard Total Stock Market ETF', quantity: 412.5, price: 269.40, marketValue: 111127.50, costBasis: 95200.00, assetClass: 'equity' },
        { asOf: '2025-03-08', symbol: 'VXUS', name: 'Vanguard Intl Stock Market ETF', quantity: 285.0, price: 58.80, marketValue: 16758.00, costBasis: 15100.00, assetClass: 'equity' },
        { asOf: '2025-03-08', symbol: 'BND', name: 'Vanguard Total Bond Market ETF', quantity: 520.0, price: 71.80, marketValue: 37336.00, costBasis: 36800.00, assetClass: 'fixed_income' },
        { asOf: '2025-03-08', symbol: 'VTIP', name: 'Vanguard Short-Term TIPS ETF', quantity: 450.0, price: 49.60, marketValue: 22320.00, costBasis: 21500.00, assetClass: 'fixed_income' },
      ],
    }
  );

  console.log('Holdings:');
  const { data: holdings } = await supabase
    .from('holding')
    .select('symbol, quantity, price, market_value, cost_basis, asset_class')
    .eq('account_id', created.retirement)
    .order('market_value', { ascending: false });
  console.table(holdings);

  console.log('Activity:');
  const { data: activity } = await supabase
    .from('investment_activity')
    .select('date, activity_type, symbol, quantity, price, amount')
    .eq('account_id', created.retirement)
    .order('date');
  console.table(activity);

  // ── INGEST: Credit card ──
  console.log('\n━━━ Amex Gold ━━━');
  await processIngest(
    { householdId: hhId, accountId: created.credit, sourceId: sources.credit, sourceType: 'manual_entry' },
    {
      transactions: [
        { date: '2025-03-02', amount: -89.00, description: 'Amazon.com', category: 'shopping' },
        { date: '2025-03-04', amount: -34.50, description: 'Uber Eats', category: 'dining' },
        { date: '2025-03-06', amount: -250.00, description: 'Delta Airlines', category: 'travel' },
        { date: '2025-03-07', amount: 1500.00, description: 'Payment - Thank You', isTransfer: true },
      ],
      investmentActivity: [],
      balances: [{ date: '2025-03-08', balance: -873.50 }],
      holdings: [],
    }
  );

  const { data: ccTxns } = await supabase
    .from('transaction')
    .select('date, amount, description, category')
    .eq('account_id', created.credit)
    .order('date');
  console.table(ccTxns);

  // ── SUMMARY ──
  console.log('\n━━━ All Balances ━━━');
  const { data: balances } = await supabase
    .from('balance_snapshot')
    .select('balance, account:account_id(name, account_type)')
    .eq('household_id', hhId);
  console.table(balances!.map((b: any) => ({
    account: b.account.name,
    type: b.account.account_type,
    balance: b.balance,
  })));

  console.log('\n━━━ Audit Trail ━━━');
  const { data: ingests } = await supabase
    .from('raw_ingest')
    .select('source_type, record_count, status')
    .eq('household_id', hhId)
    .order('created_at');
  console.table(ingests);

  // ── DEDUP TEST ──
  console.log('\n━━━ Dedup Test: re-ingest same checking txns ━━━');
  await processIngest(
    { householdId: hhId, accountId: created.checking, sourceId: sources.checking, sourceType: 'manual_entry' },
    {
      transactions: [
        { date: '2025-03-05', amount: -142.37, description: 'Whole Foods Market', category: 'groceries' },
        { date: '2025-03-06', amount: -65.00, description: 'Electric Bill', category: 'utilities' },
      ],
      investmentActivity: [],
      balances: [],
      holdings: [],
    }
  );

  const { data: txnCount } = await supabase
    .from('transaction')
    .select('id', { count: 'exact' })
    .eq('account_id', created.checking);
  console.log(`Checking txns after re-ingest: ${txnCount!.length} (should still be 6 — dupes ignored)`);

  // ── CLEANUP ──
  console.log('\n━━━ Cleaning up demo data ━━━');
  for (const table of ['net_worth_snapshot', 'balance_snapshot', 'holding', 'investment_activity', 'transaction', 'raw_ingest', 'account_source', 'account', 'member', 'household']) {
    if (table === 'household') {
      await supabase.from(table).delete().eq('id', hhId);
    } else {
      await supabase.from(table).delete().eq('household_id', hhId);
    }
  }
  console.log('Done! All demo data removed.');
}

main().catch(console.error);
