import { describe, it, expect } from 'vitest';
import { computeMemberWaterfall } from '../../../src/engine/waterfall.js';
import type { WaterfallMemberInput } from '../../../src/engine/types.js';
import type { IncomeSource, CashflowItem, TaxTreatment } from '../../../src/types/index.js';
import { TAX_PARAMS_2025 } from './fixtures.js';

const run = (member: WaterfallMemberInput) => computeMemberWaterfall(member, TAX_PARAMS_2025);

function makeIncomeSource(overrides: Partial<IncomeSource> = {}): IncomeSource {
  return {
    id: 'inc-1',
    household_id: 'hh-1',
    member_id: 'mem-1',
    name: 'Day Job',
    type: 'employment',
    gross_amount: 125900,
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
    display_name: 'Test User',
    birthday: '1998-10-21',
    target_retirement_age: 45,
    state: 'CA',
    tax_mode: 'auto',
    effective_tax_rate_override: null,
    income_sources: [makeIncomeSource()],
    cashflow_items: [],
    account_tax_treatments: new Map<string, TaxTreatment>(),
    ...overrides,
  };
}

describe('computeMemberWaterfall', () => {
  it('computes gross income from income sources', () => {
    const result = run(makeMember());

    // $125,900/yr → $10,491.67/mo
    expect(result.total_gross_monthly).toBeCloseTo(10491.67, 0);
    expect(result.total_gross_annual).toBeCloseTo(125900, 0);
  });

  it('filters out inactive income sources', () => {
    const result = run(
      makeMember({
        income_sources: [
          makeIncomeSource({ gross_amount: 100000 }),
          makeIncomeSource({ id: 'inc-2', gross_amount: 50000, is_active: false }),
        ],
      }),
    );

    expect(result.total_gross_annual).toBeCloseTo(100000, 0);
  });

  it('deducts pre-tax saving items linked to income source', () => {
    const result = run(
      makeMember({
        cashflow_items: [
          makeCashflowItem({
            id: 'cf-401k',
            name: '401k Deferral',
            bucket: 'savings',
            amount: 23500,
            frequency: 'annual',
            income_source_id: 'inc-1',
            destination_account_id: 'acct-401k',
          }),
        ],
        account_tax_treatments: new Map([['acct-401k', 'pre_tax']]),
      }),
    );

    expect(result.total_pre_tax_deductions_monthly).toBeCloseTo(23500 / 12, 0);
    expect(result.taxable_income_annual).toBeCloseTo(125900 - 23500, 0);
  });

  it('applies manual tax mode with override rate', () => {
    const result = run(
      makeMember({
        tax_mode: 'manual',
        effective_tax_rate_override: 0.28,
      }),
    );

    // Tax on $125,900 at 28% = $35,252
    expect(result.tax_breakdown.total).toBeCloseTo(125900 * 0.28, 0);
    expect(result.tax_breakdown.effective_rate).toBe(0.28);
  });

  it('computes auto taxes with federal + state + FICA', () => {
    const result = run(makeMember());

    expect(result.tax_breakdown.federal).toBeGreaterThan(0);
    expect(result.tax_breakdown.state).toBeGreaterThan(0);
    expect(result.tax_breakdown.fica_total).toBeGreaterThan(0);
    expect(result.tax_breakdown.total).toBe(
      result.tax_breakdown.federal + result.tax_breakdown.state + result.tax_breakdown.fica_total,
    );
  });

  it('tracks post-tax contributions (saving to non-pre-tax account)', () => {
    const result = run(
      makeMember({
        cashflow_items: [
          makeCashflowItem({
            id: 'cf-roth',
            name: 'Roth IRA',
            bucket: 'savings',
            amount: 7000,
            frequency: 'annual',
            destination_account_id: 'acct-roth',
          }),
        ],
        account_tax_treatments: new Map([['acct-roth', 'tax_free']]),
      }),
    );

    expect(result.post_tax_contributions).toHaveLength(1);
    expect(result.post_tax_contributions[0].destination_account_id).toBe('acct-roth');
    expect(result.total_post_tax_contributions_monthly).toBeCloseTo(7000 / 12, 0);
  });

  it('computes expenses and residual', () => {
    const result = run(
      makeMember({
        cashflow_items: [
          makeCashflowItem({ id: 'cf-rent', name: 'Rent', amount: 2000, frequency: 'monthly' }),
          makeCashflowItem({
            id: 'cf-food',
            name: 'Food',
            amount: 600,
            frequency: 'monthly',
          }),
        ],
      }),
    );

    expect(result.total_expenses_monthly).toBe(2600);
    expect(result.total_expenses_annual).toBe(31200);
    // Residual = disposable - expenses
    expect(result.residual_monthly).toBeCloseTo(
      result.disposable_income_monthly - result.total_expenses_monthly,
      2,
    );
  });

  it('full waterfall flows balance: gross - pretax - tax - posttax - expenses = residual', () => {
    const result = run(
      makeMember({
        cashflow_items: [
          makeCashflowItem({
            id: 'cf-401k',
            bucket: 'savings',
            amount: 23500,
            frequency: 'annual',
            income_source_id: 'inc-1',
            destination_account_id: 'acct-401k',
          }),
          makeCashflowItem({
            id: 'cf-roth',
            bucket: 'savings',
            amount: 7000,
            frequency: 'annual',
            destination_account_id: 'acct-roth',
          }),
          makeCashflowItem({
            id: 'cf-rent',
            bucket: 'expense',
            amount: 2000,
            frequency: 'monthly',
          }),
        ],
        account_tax_treatments: new Map([
          ['acct-401k', 'pre_tax'],
          ['acct-roth', 'tax_free'],
        ]),
      }),
    );

    const expectedResidual =
      result.total_gross_monthly -
      result.total_pre_tax_deductions_monthly -
      result.tax_monthly -
      result.total_post_tax_contributions_monthly -
      result.total_expenses_monthly;

    expect(result.residual_monthly).toBeCloseTo(expectedResidual, 2);
  });

  it('handles zero income gracefully', () => {
    const result = run(makeMember({ income_sources: [] }));

    expect(result.total_gross_monthly).toBe(0);
    expect(result.tax_monthly).toBe(0);
    expect(result.residual_monthly).toBe(0);
  });

  it('handles biweekly income sources', () => {
    const result = run(
      makeMember({
        income_sources: [makeIncomeSource({ gross_amount: 4842.31, frequency: 'biweekly' })],
      }),
    );

    // $4842.31 * 26/12 = ~$10,491.67/mo → ~$125,900/yr
    expect(result.total_gross_annual).toBeCloseTo(125900, 0);
  });

  it('saving without destination account is treated as post-tax', () => {
    const result = run(
      makeMember({
        cashflow_items: [
          makeCashflowItem({
            id: 'cf-save',
            name: 'General Savings',
            bucket: 'savings',
            amount: 500,
            frequency: 'monthly',
            destination_account_id: null,
          }),
        ],
      }),
    );

    // Should appear as post-tax contribution, not pre-tax deduction
    expect(result.total_pre_tax_deductions_monthly).toBe(0);
    expect(result.total_post_tax_contributions_monthly).toBeCloseTo(500, 0);
  });
});
