import { supabase } from '../lib/supabase.js';
import { transactionFingerprint, investmentActivityFingerprint } from '../lib/fingerprint.js';
import { detectDuplicateTransactions, detectDuplicateActivity } from './dedup.js';
import type { IngestResult } from '../types/index.js';

interface IngestContext {
  householdId: string;
  accountId: string;
  sourceId: string;
  sourceType: string;
  sourceRef?: string;
  triggeredBy?: string;
}

export async function processIngest(ctx: IngestContext, result: IngestResult) {
  // 1. Write raw payload to raw_ingest (immutable audit trail)
  const totalRecords =
    result.transactions.length +
    result.investmentActivity.length +
    result.balances.length +
    result.holdings.length;

  const { data: rawIngest, error: rawError } = await supabase
    .from('raw_ingest')
    .insert({
      household_id: ctx.householdId,
      account_id: ctx.accountId,
      source_id: ctx.sourceId,
      source_type: ctx.sourceType,
      source_ref: ctx.sourceRef || null,
      payload: result,
      record_count: totalRecords,
      triggered_by: ctx.triggeredBy || null,
      status: 'pending',
    })
    .select()
    .single();

  if (rawError) throw new Error(`raw_ingest write failed: ${rawError.message}`);
  const rawIngestId = rawIngest.id;

  try {
    // 2. Upsert transactions
    if (result.transactions.length > 0) {
      await upsertTransactions(ctx, rawIngestId, result);
    }

    // 3. Upsert investment activity
    if (result.investmentActivity.length > 0) {
      await upsertInvestmentActivity(ctx, rawIngestId, result);
    }

    // 4. Upsert holdings
    if (result.holdings.length > 0) {
      await upsertHoldings(ctx, rawIngestId, result);
    }

    // 5. Upsert balances
    if (result.balances.length > 0) {
      await upsertBalances(ctx, rawIngestId, result);
    }

    // 6. Run cross-source duplicate detection
    const txnDates = result.transactions.map((t) => t.date);
    const actDates = result.investmentActivity.map((a) => a.date);

    const [txnDedup, actDedup] = await Promise.all([
      txnDates.length > 0
        ? detectDuplicateTransactions(ctx.accountId, txnDates)
        : { autoHidden: 0, potentialDupes: 0 },
      actDates.length > 0
        ? detectDuplicateActivity(ctx.accountId, actDates)
        : { autoHidden: 0, potentialDupes: 0 },
    ]);

    // 7. Mark raw_ingest as processed
    await supabase
      .from('raw_ingest')
      .update({ status: 'processed', processed_at: new Date().toISOString() })
      .eq('id', rawIngestId);

    // 8. Update last_synced on account_source
    await supabase
      .from('account_source')
      .update({ last_synced: new Date().toISOString() })
      .eq('id', ctx.sourceId);

    return {
      rawIngestId,
      recordCount: totalRecords,
      dedup: {
        transactionsAutoHidden: txnDedup.autoHidden,
        transactionsPotentialDupes: txnDedup.potentialDupes,
        activityAutoHidden: actDedup.autoHidden,
        activityPotentialDupes: actDedup.potentialDupes,
      },
    };
  } catch (err) {
    // Mark as failed
    const message = err instanceof Error ? err.message : String(err);
    await supabase
      .from('raw_ingest')
      .update({ status: 'failed', error: message })
      .eq('id', rawIngestId);
    throw err;
  }
}

async function upsertTransactions(ctx: IngestContext, rawIngestId: string, result: IngestResult) {
  const rows = result.transactions.map((t) => ({
    household_id: ctx.householdId,
    account_id: ctx.accountId,
    raw_ingest_id: rawIngestId,
    date: t.date,
    amount: t.amount,
    description: t.description,
    category: t.category || null,
    is_transfer: t.isTransfer || false,
    provider_txn_id: t.providerTxnId || null,
    fingerprint: t.providerTxnId
      ? null
      : transactionFingerprint(ctx.accountId, t.date, t.amount, t.description),
  }));

  const { error } = await supabase.from('transaction').upsert(rows, {
    onConflict: rows[0].provider_txn_id ? 'account_id,provider_txn_id' : 'account_id,fingerprint',
    ignoreDuplicates: true,
  });

  if (error) throw new Error(`transaction upsert failed: ${error.message}`);
}

async function upsertInvestmentActivity(
  ctx: IngestContext,
  rawIngestId: string,
  result: IngestResult,
) {
  const rows = result.investmentActivity.map((a) => ({
    household_id: ctx.householdId,
    account_id: ctx.accountId,
    raw_ingest_id: rawIngestId,
    date: a.date,
    activity_type: a.activityType,
    symbol: a.symbol || null,
    description: a.description || null,
    quantity: a.quantity ?? null,
    price: a.price ?? null,
    amount: a.amount,
    commission: a.commission ?? 0,
    lot_id: a.lotId || null,
    provider_txn_id: a.providerTxnId || null,
    fingerprint: a.providerTxnId
      ? null
      : investmentActivityFingerprint(ctx.accountId, a.date, a.activityType, a.amount, a.symbol),
  }));

  const { error } = await supabase.from('investment_activity').upsert(rows, {
    onConflict: rows[0].provider_txn_id ? 'account_id,provider_txn_id' : 'account_id,fingerprint',
    ignoreDuplicates: true,
  });

  if (error) throw new Error(`investment_activity upsert failed: ${error.message}`);
}

async function upsertHoldings(ctx: IngestContext, rawIngestId: string, result: IngestResult) {
  const rows = result.holdings.map((h) => ({
    household_id: ctx.householdId,
    account_id: ctx.accountId,
    raw_ingest_id: rawIngestId,
    as_of: h.asOf,
    symbol: h.symbol,
    name: h.name || null,
    quantity: h.quantity,
    price: h.price ?? null,
    market_value: h.marketValue,
    cost_basis: h.costBasis ?? null,
    asset_class: h.assetClass || null,
  }));

  // Holdings use replace semantics — latest snapshot wins
  const { error } = await supabase.from('holding').upsert(rows, {
    onConflict: 'account_id,as_of,symbol',
  });

  if (error) throw new Error(`holding upsert failed: ${error.message}`);
}

async function upsertBalances(ctx: IngestContext, rawIngestId: string, result: IngestResult) {
  const sourceType = ctx.sourceType.includes('manual')
    ? 'manual'
    : ctx.sourceType.includes('csv')
      ? 'csv_derived'
      : 'provider_sync';

  const rows = result.balances.map((b) => ({
    household_id: ctx.householdId,
    account_id: ctx.accountId,
    raw_ingest_id: rawIngestId,
    date: b.date,
    balance: b.balance,
    available: b.available ?? null,
    source: sourceType,
  }));

  const { error } = await supabase.from('balance_snapshot').upsert(rows, {
    onConflict: 'account_id,date,source',
  });

  if (error) throw new Error(`balance_snapshot upsert failed: ${error.message}`);
}
