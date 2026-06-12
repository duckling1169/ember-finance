import type { CashflowItem, IncomeSource } from '../types/index';
import { toMonthly, toAnnual } from './normalize';

/**
 * Resolve a cashflow item's amount to a monthly dollar value.
 *
 * For 'fixed' items, this is simply toMonthly(amount, frequency).
 * For 'percent' items, we compute the percentage of the linked income source's
 * monthly gross and return that directly as a monthly value.
 */
export function resolveItemMonthly(item: CashflowItem, incomeSources: IncomeSource[]): number {
  if (item.amount_type === 'percent' && item.income_source_id) {
    const source = incomeSources.find((s) => s.id === item.income_source_id);
    if (!source) return 0;
    const monthlyGross = toMonthly(source.gross_amount, source.frequency);
    return monthlyGross * (item.amount / 100);
  }
  return toMonthly(item.amount, item.frequency);
}

/**
 * Resolve a cashflow item's amount to an annual dollar value.
 */
export function resolveItemAnnual(item: CashflowItem, incomeSources: IncomeSource[]): number {
  if (item.amount_type === 'percent' && item.income_source_id) {
    return resolveItemMonthly(item, incomeSources) * 12;
  }
  return toAnnual(item.amount, item.frequency);
}
