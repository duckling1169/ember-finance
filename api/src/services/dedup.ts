import { supabase } from '../lib/supabase';

// Source authority ranking — higher number = more authoritative.
// When dupes are found, the less authoritative record gets hidden.
const SOURCE_AUTHORITY: Record<string, number> = {
  manual_entry: 1,
  csv_upload: 2,
  snaptrade_sync: 3,
  teller_sync: 4,
};

function getAuthority(sourceType: string): number {
  return SOURCE_AUTHORITY[sourceType] ?? 0;
}

interface DedupResult {
  autoHidden: number;
  potentialDupes: number; // same date+amount but >2 matches — needs manual review
}

/**
 * After ingesting new records, scan for likely duplicates.
 *
 * Strategy:
 * - Group by (account_id, date, amount) — exact match on the key financial facts
 * - If a group has exactly 2 records from different sources → auto-hide the less authoritative one
 * - If a group has >2 records → flag for manual review (could be legit, e.g. two coffees)
 * - Never auto-hide if both records are from the same source type (already deduped by constraints)
 */
export async function detectDuplicateTransactions(
  accountId: string,
  dates: string[], // dates affected by this ingest, to scope the scan
): Promise<DedupResult> {
  if (dates.length === 0) return { autoHidden: 0, potentialDupes: 0 };

  const minDate = dates.reduce((a, b) => (a < b ? a : b));
  const maxDate = dates.reduce((a, b) => (a > b ? a : b));

  // Fetch all visible transactions in the date range
  const { data: transactions, error } = await supabase
    .from('transaction')
    .select('id, date, amount, description, raw_ingest_id, provider_txn_id, fingerprint, is_hidden')
    .eq('account_id', accountId)
    .eq('is_hidden', false)
    .gte('date', minDate)
    .lte('date', maxDate);

  if (error || !transactions) return { autoHidden: 0, potentialDupes: 0 };

  // Group by (date, amount)
  const groups = new Map<string, typeof transactions>();
  for (const txn of transactions) {
    const key = `${txn.date}|${txn.amount}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(txn);
  }

  let autoHidden = 0;
  let potentialDupes = 0;

  for (const [, group] of groups) {
    if (group.length < 2) continue;

    // Determine source types by looking up raw_ingest
    const withSources = await Promise.all(
      group.map(async (txn) => {
        if (!txn.raw_ingest_id) return { ...txn, sourceType: 'unknown' };
        const { data } = await supabase
          .from('raw_ingest')
          .select('source_type')
          .eq('id', txn.raw_ingest_id)
          .single();
        return { ...txn, sourceType: data?.source_type ?? 'unknown' };
      }),
    );

    // Only consider cross-source duplicates
    const sourceTypes = new Set(withSources.map((t) => t.sourceType));
    if (sourceTypes.size < 2) continue; // same source — already deduped by constraints

    if (group.length === 2) {
      // Exactly 2 from different sources — auto-hide the less authoritative
      const sorted = withSources.sort(
        (a, b) => getAuthority(a.sourceType) - getAuthority(b.sourceType),
      );
      const toHide = sorted[0]; // least authoritative

      await supabase
        .from('transaction')
        .update({
          is_hidden: true,
          hidden_reason: 'auto:cross_source_duplicate',
        })
        .eq('id', toHide.id);

      autoHidden++;
    } else {
      // 3+ matches on same (date, amount) — could be legit (two coffees)
      // Don't auto-hide, but count as needing review
      potentialDupes += group.length;
    }
  }

  return { autoHidden, potentialDupes };
}

/**
 * Same logic for investment_activity.
 * Groups on (account_id, date, amount, activity_type, symbol) for tighter matching.
 */
export async function detectDuplicateActivity(
  accountId: string,
  dates: string[],
): Promise<DedupResult> {
  if (dates.length === 0) return { autoHidden: 0, potentialDupes: 0 };

  const minDate = dates.reduce((a, b) => (a < b ? a : b));
  const maxDate = dates.reduce((a, b) => (a > b ? a : b));

  const { data: activities, error } = await supabase
    .from('investment_activity')
    .select(
      'id, date, amount, activity_type, symbol, raw_ingest_id, provider_txn_id, fingerprint, is_hidden',
    )
    .eq('account_id', accountId)
    .eq('is_hidden', false)
    .gte('date', minDate)
    .lte('date', maxDate);

  if (error || !activities) return { autoHidden: 0, potentialDupes: 0 };

  // Tighter grouping for investment activity: (date, amount, activity_type, symbol)
  const groups = new Map<string, typeof activities>();
  for (const act of activities) {
    const key = `${act.date}|${act.amount}|${act.activity_type}|${act.symbol ?? ''}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(act);
  }

  let autoHidden = 0;
  let potentialDupes = 0;

  for (const [, group] of groups) {
    if (group.length < 2) continue;

    const withSources = await Promise.all(
      group.map(async (act) => {
        if (!act.raw_ingest_id) return { ...act, sourceType: 'unknown' };
        const { data } = await supabase
          .from('raw_ingest')
          .select('source_type')
          .eq('id', act.raw_ingest_id)
          .single();
        return { ...act, sourceType: data?.source_type ?? 'unknown' };
      }),
    );

    const sourceTypes = new Set(withSources.map((t) => t.sourceType));
    if (sourceTypes.size < 2) continue;

    if (group.length === 2) {
      const sorted = withSources.sort(
        (a, b) => getAuthority(a.sourceType) - getAuthority(b.sourceType),
      );

      await supabase
        .from('investment_activity')
        .update({
          is_hidden: true,
          hidden_reason: 'auto:cross_source_duplicate',
        })
        .eq('id', sorted[0].id);

      autoHidden++;
    } else {
      potentialDupes += group.length;
    }
  }

  return { autoHidden, potentialDupes };
}
