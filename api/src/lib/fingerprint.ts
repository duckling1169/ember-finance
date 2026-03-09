import { createHash } from 'crypto';

// Generate a dedup fingerprint for file/manual imports (no provider ID available)
export function transactionFingerprint(
  accountId: string,
  date: string,
  amount: number,
  description: string
): string {
  return createHash('sha256')
    .update(`${accountId}|${date}|${amount}|${description}`)
    .digest('hex');
}

export function investmentActivityFingerprint(
  accountId: string,
  date: string,
  activityType: string,
  amount: number,
  symbol?: string
): string {
  return createHash('sha256')
    .update(`${accountId}|${date}|${activityType}|${amount}|${symbol || ''}`)
    .digest('hex');
}
