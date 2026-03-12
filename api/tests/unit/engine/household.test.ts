import { describe, it, expect } from 'vitest';
import { computeHouseholdWaterfall } from '../../../src/engine/household.js';
import type { HouseholdWaterfallInput, WaterfallMemberInput } from '../../../src/engine/types.js';
import type { IncomeSource, CashflowItem, TaxBucket } from '../../../shared/types/index.js';

function makeIncomeSource(overrides: Partial<IncomeSource> = {}): IncomeSource {
  return {
    id: 'inc-1',
    household_id: 'hh-1',
    member_id: 'mem-1',
    name: 'Day Job',
    type: 'employment',
    gross_amount: 100000,
    frequency: 'annual',
    is_active: true,
    created_at: '2025-01-01',
    updated_at: '2025-01-01',
    ...overrides,
  };
}

function makeCashflowItem(overrides: Partial<CashflowItem> = {}): CashflowItem {
  return {
    id: 'cf-1',
    household_id: 'hh-1',
    member_id: 'mem-1',
    name: 'Test Item',
    direction: 'outflow',
    bucket: 'expense',
    amount: 1000,
    frequency: 'monthly',
    is_recurring: true,
    include_in_projection: true,
    start_date: '2025-01-01',
    end_date: null,
    income_source_id: null,
    source_account_id: null,
    destination_account_id: null,
    category: null,
    is_essential: true,
    created_at: '2025-01-01',
    updated_at: '2025-01-01',
    ...overrides,
  };
}

function makeMember(overrides: Partial<WaterfallMemberInput> = {}): WaterfallMemberInput {
  return {
    id: 'mem-1',
    display_name: 'Member A',
    birthday: '1990-01-01',
    target_retirement_age: 65,
    state_of_residence: 'CA',
    tax_mode: 'auto',
    effective_tax_rate_override: null,
    income_sources: [makeIncomeSource()],
    cashflow_items: [],
    account_tax_buckets: new Map<string, TaxBucket>(),
    ...overrides,
  };
}

describe('computeHouseholdWaterfall', () => {
  it('single member household aggregates match member values', () => {
    const input: HouseholdWaterfallInput = {
      tax_filing_status: 'single',
      members: [makeMember()],
    };
    const result = computeHouseholdWaterfall(input);

    expect(result.members).toHaveLength(1);
    expect(result.total_gross_monthly).toBe(result.members[0].total_gross_monthly);
    expect(result.total_tax_monthly).toBe(result.members[0].tax_monthly);
    expect(result.total_residual_monthly).toBe(result.members[0].residual_monthly);
  });

  it('sums two members for non-joint filing', () => {
    const input: HouseholdWaterfallInput = {
      tax_filing_status: 'married_separately',
      members: [
        makeMember({ id: 'mem-1', display_name: 'A' }),
        makeMember({
          id: 'mem-2',
          display_name: 'B',
          income_sources: [
            makeIncomeSource({ id: 'inc-2', member_id: 'mem-2', gross_amount: 80000 }),
          ],
        }),
      ],
    };
    const result = computeHouseholdWaterfall(input);

    expect(result.members).toHaveLength(2);
    // Gross should be sum: $100k + $80k = $180k annual
    expect(result.total_gross_annual).toBeCloseTo(180000, 0);
  });

  it('recomputes taxes jointly for married_jointly filing', () => {
    const memberA = makeMember({ id: 'mem-1', display_name: 'A' });
    const memberB = makeMember({
      id: 'mem-2',
      display_name: 'B',
      income_sources: [makeIncomeSource({ id: 'inc-2', member_id: 'mem-2', gross_amount: 80000 })],
    });

    // Compute separately first for comparison
    const separateResult = computeHouseholdWaterfall({
      tax_filing_status: 'married_separately',
      members: [memberA, memberB],
    });

    const jointResult = computeHouseholdWaterfall({
      tax_filing_status: 'married_jointly',
      members: [memberA, memberB],
    });

    // Joint filing should produce different (typically lower) total tax
    expect(jointResult.total_tax_monthly).not.toBeCloseTo(separateResult.total_tax_monthly, 0);

    // Both should have the same gross
    expect(jointResult.total_gross_annual).toBeCloseTo(separateResult.total_gross_annual, 0);
  });

  it('distributes joint tax proportionally by income', () => {
    const input: HouseholdWaterfallInput = {
      tax_filing_status: 'married_jointly',
      members: [
        makeMember({ id: 'mem-1', display_name: 'A' }),
        makeMember({
          id: 'mem-2',
          display_name: 'B',
          income_sources: [
            makeIncomeSource({ id: 'inc-2', member_id: 'mem-2', gross_amount: 100000 }),
          ],
        }),
      ],
    };
    const result = computeHouseholdWaterfall(input);

    // Equal income → equal tax share
    expect(result.members[0].tax_monthly).toBeCloseTo(result.members[1].tax_monthly, 2);
  });

  it('skips joint recomputation when a member uses manual tax mode', () => {
    const input: HouseholdWaterfallInput = {
      tax_filing_status: 'married_jointly',
      members: [
        makeMember({ id: 'mem-1', display_name: 'A' }),
        makeMember({
          id: 'mem-2',
          display_name: 'B',
          tax_mode: 'manual',
          effective_tax_rate_override: 0.25,
          income_sources: [
            makeIncomeSource({ id: 'inc-2', member_id: 'mem-2', gross_amount: 80000 }),
          ],
        }),
      ],
    };
    const result = computeHouseholdWaterfall(input);

    // Member B should still use manual rate
    expect(result.members[1].tax_breakdown.effective_rate).toBe(0.25);
  });

  it('aggregates expenses across members', () => {
    const input: HouseholdWaterfallInput = {
      tax_filing_status: 'single',
      members: [
        makeMember({
          cashflow_items: [makeCashflowItem({ id: 'cf-1', amount: 1500 })],
        }),
      ],
    };
    const result = computeHouseholdWaterfall(input);

    expect(result.total_expenses_monthly).toBe(1500);
    expect(result.total_expenses_annual).toBe(18000);
  });

  it('waterfall balance holds at household level', () => {
    const input: HouseholdWaterfallInput = {
      tax_filing_status: 'single',
      members: [
        makeMember({
          cashflow_items: [
            makeCashflowItem({
              id: 'cf-401k',
              bucket: 'saving',
              amount: 23500,
              frequency: 'annual',
              income_source_id: 'inc-1',
              destination_account_id: 'acct-401k',
            }),
            makeCashflowItem({
              id: 'cf-roth',
              bucket: 'saving',
              amount: 7000,
              frequency: 'annual',
              destination_account_id: 'acct-roth',
            }),
            makeCashflowItem({ id: 'cf-rent', bucket: 'expense', amount: 2000 }),
          ],
          account_tax_buckets: new Map([
            ['acct-401k', 'pre_tax'],
            ['acct-roth', 'tax_free'],
          ]),
        }),
      ],
    };
    const result = computeHouseholdWaterfall(input);

    const expectedResidual =
      result.total_gross_monthly -
      result.total_pre_tax_deductions_monthly -
      result.total_tax_monthly -
      result.total_post_tax_contributions_monthly -
      result.total_expenses_monthly;

    expect(result.total_residual_monthly).toBeCloseTo(expectedResidual, 2);
  });

  it('handles empty household', () => {
    const result = computeHouseholdWaterfall({
      tax_filing_status: 'single',
      members: [],
    });

    expect(result.members).toHaveLength(0);
    expect(result.total_gross_monthly).toBe(0);
    expect(result.total_residual_monthly).toBe(0);
  });
});
