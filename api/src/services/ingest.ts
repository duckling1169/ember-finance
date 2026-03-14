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

export async function persistIngest(ctx: IngestContext, ingestData: IngestResult) {
  // 1. Write raw payload to raw_ingest (immutable audit trail)
  const totalRecords =
    ingestData.transactions.length +
    ingestData.investmentActivity.length +
    ingestData.balances.length +
    ingestData.holdings.length;

  const { data: rawIngest, error: rawError } = await supabase
    .from('raw_ingest')
    .insert({
      household_id: ctx.householdId,
      account_id: ctx.accountId,
      source_id: ctx.sourceId,
      source_type: ctx.sourceType,
      source_ref: ctx.sourceRef || null,
      payload: ingestData,
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
    if (ingestData.transactions.length > 0) {
      await upsertTransactions(ctx, rawIngestId, ingestData);
    }

    // 3. Upsert investment activity
    if (ingestData.investmentActivity.length > 0) {
      await upsertInvestmentActivity(ctx, rawIngestId, ingestData);
    }

    // 4. Upsert holdings (with deletion semantics for removed positions)
    if (ingestData.holdings.length > 0) {
      if (ctx.sourceType.includes('manual')) {
        await insertZeroHoldingsForRemovedPositions(ctx, ingestData);
      }
      await upsertHoldings(ctx, rawIngestId, ingestData);
    }

    // 5. Upsert balances
    if (ingestData.balances.length > 0) {
      await upsertBalances(ctx, rawIngestId, ingestData);
    }

    // 5b. Derive balance_snapshot from holdings if no explicit balances provided
    if (ingestData.holdings.length > 0 && ingestData.balances.length === 0) {
      await deriveBalanceFromHoldings(ctx, rawIngestId, ingestData);
    }

    // 6. Run cross-source duplicate detection
    const txnDates = ingestData.transactions.map((t) => t.date);
    const actDates = ingestData.investmentActivity.map((a) => a.date);

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

/**
 * For manual ingest: detect positions that exist in current_positions but are
 * absent from the new submission. Insert a zero-quantity holding row for each
 * so the position is recorded as closed in history.
 */
async function insertZeroHoldingsForRemovedPositions(ctx: IngestContext, result: IngestResult) {
  // Get the as_of date from the submitted holdings (all should share the same date)
  const asOf = result.holdings[0]?.asOf;
  if (!asOf) return;

  const submittedSymbols = new Set(result.holdings.map((h) => h.symbol));

  // Query current_positions for this account to find existing symbols
  const { data: existingPositions, error } = await supabase
    .from('current_positions')
    .select('symbol, name, asset_class, currency')
    .eq('account_id', ctx.accountId)
    .gt('quantity', 0);

  if (error || !existingPositions) return;

  // Find symbols that exist but are NOT in the new submission
  const removedPositions = existingPositions.filter((p) => !submittedSymbols.has(p.symbol));

  if (removedPositions.length === 0) return;

  // Append zero-quantity holdings to the result so they get upserted normally
  for (const pos of removedPositions) {
    result.holdings.push({
      asOf,
      symbol: pos.symbol,
      name: pos.name || undefined,
      quantity: 0,
      price: 0,
      marketValue: 0,
      assetClass: pos.asset_class || undefined,
    });
  }
}

/**
 * When holdings are ingested without explicit balances, derive a balance_snapshot
 * from the total market value of the holdings so the planning engine can see it.
 */
async function deriveBalanceFromHoldings(
  ctx: IngestContext,
  rawIngestId: string,
  result: IngestResult,
) {
  // Group holdings by as_of date and sum market values
  const byDate = new Map<string, number>();
  for (const h of result.holdings) {
    byDate.set(h.asOf, (byDate.get(h.asOf) ?? 0) + (h.marketValue ?? 0));
  }

  const rows = Array.from(byDate.entries()).map(([date, balance]) => ({
    household_id: ctx.householdId,
    account_id: ctx.accountId,
    raw_ingest_id: rawIngestId,
    date,
    balance,
    available: null,
    source: 'holdings_derived' as const,
  }));

  const { error } = await supabase.from('balance_snapshot').upsert(rows, {
    onConflict: 'account_id,date,source',
  });

  if (error) throw new Error(`holdings-derived balance_snapshot upsert failed: ${error.message}`);
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
