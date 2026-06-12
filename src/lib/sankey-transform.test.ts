import { describe, it, expect } from 'vitest';
import { buildSankeyData } from './sankey-transform';
import type {
  HouseholdWaterfall,
  MemberWaterfall,
  CashflowItem,
  IncomeSource,
  EnrichedAccount,
} from '@shared/types';

// ── Fixtures ──

function makeMemberWaterfall(overrides: Partial<MemberWaterfall> = {}): MemberWaterfall {
  return {
    member_id: 'm1',
    display_name: 'Member',
    total_gross_monthly: 10_000,
    total_gross_annual: 120_000,
    income_sources: [
      {
        income_source_id: 'src1',
        name: 'Day Job',
        gross_monthly: 10_000,
        pre_tax_deductions_monthly: 0,
        taxable_from_source: 10_000,
      },
    ],
    total_pre_tax_deductions_monthly: 0,
    taxable_income_annual: 120_000,
    tax_breakdown: {
      federal: 18_000,
      state: 6_000,
      social_security: 7_440,
      medicare: 1_740,
      fica_total: 9_180,
      total: 33_180,
      effective_rate: 0.2765,
      tax_year: 2025,
    },
    tax_monthly: 2_765,
    net_income_monthly: 7_235,
    net_income_annual: 86_820,
    post_tax_contributions: [],
    total_post_tax_contributions_monthly: 0,
    disposable_income_monthly: 7_235,
    total_expenses_monthly: 3_000,
    total_expenses_annual: 36_000,
    residual_monthly: 4_235,
    residual_annual: 50_820,
    ...overrides,
  };
}

function makeWaterfall(overrides: Partial<HouseholdWaterfall> = {}): HouseholdWaterfall {
  const member = makeMemberWaterfall();
  return {
    members: [member],
    total_gross_monthly: member.total_gross_monthly,
    total_gross_annual: member.total_gross_annual,
    total_pre_tax_deductions_monthly: member.total_pre_tax_deductions_monthly,
    total_tax_monthly: member.tax_monthly,
    total_net_income_monthly: member.net_income_monthly,
    total_post_tax_contributions_monthly: member.total_post_tax_contributions_monthly,
    total_disposable_income_monthly: member.disposable_income_monthly,
    total_expenses_monthly: member.total_expenses_monthly,
    total_expenses_annual: member.total_expenses_annual,
    total_residual_monthly: member.residual_monthly,
    total_residual_annual: member.residual_annual,
    ...overrides,
  };
}

function makeItem(overrides: Partial<CashflowItem>): CashflowItem {
  return {
    id: 'item1',
    household_id: 'hh1',
    member_id: 'm1',
    income_source_id: null,
    source_account_id: null,
    destination_account_id: null,
    name: 'Item',
    direction: 'outflow',
    bucket: 'savings',
    amount: 100,
    amount_type: 'fixed',
    frequency: 'monthly',
    is_recurring: true,
    include_in_projection: true,
    start_date: '2026-01-01',
    end_date: null,
    category: null,
    is_essential: true,
    created_at: '',
    updated_at: '',
    ...overrides,
  } as CashflowItem;
}

function makeAccount(id: string, overrides: Partial<EnrichedAccount> = {}): EnrichedAccount {
  return {
    id,
    household_id: 'hh1',
    member_id: null,
    name: `Account ${id}`,
    institution: null,
    account_type: 'brokerage',
    currency: 'USD',
    meta: {},
    is_active: true,
    is_liability: false,
    include_in_fi_portfolio: true,
    tax_treatment: 'after_tax',
    created_at: '',
    balance: 0,
    balance_date: null,
    linked: false,
    last_synced: null,
    ...overrides,
  } as EnrichedAccount;
}

const incomeSources: IncomeSource[] = [
  {
    id: 'src1',
    household_id: 'hh1',
    member_id: 'm1',
    name: 'Day Job',
    type: 'employment',
    gross_amount: 120_000,
    frequency: 'annual',
    is_active: true,
    created_at: '',
    updated_at: '',
  },
];

// ── Tests ──

describe('buildSankeyData', () => {
  it('returns empty data for zero gross income', () => {
    const result = buildSankeyData(makeWaterfall({ total_gross_annual: 0 }), [], []);
    expect(result.nodes).toEqual([]);
    expect(result.links).toEqual([]);
    expect(result.grossAnnual).toBe(0);
  });

  it('builds income → gross → taxes/net structure', () => {
    const result = buildSankeyData(makeWaterfall(), [], incomeSources);

    const ids = result.nodes.map((n) => n.id);
    expect(ids).toContain('inc-src1');
    expect(ids).toContain('gross-income');
    expect(ids).toContain('taxes');
    expect(ids).toContain('net-income');

    const grossLink = result.links.find(
      (l) => l.source === 'inc-src1' && l.target === 'gross-income',
    );
    expect(grossLink?.value).toBe(120_000);

    const taxLink = result.links.find((l) => l.source === 'gross-income' && l.target === 'taxes');
    expect(taxLink?.value).toBe(33_180);
  });

  it('routes pre-tax savings through the Pre-tax hub to the account', () => {
    const accounts = [makeAccount('a1', { tax_treatment: 'pre_tax', name: '401k' })];
    const items = [makeItem({ destination_account_id: 'a1', amount: 1_000, frequency: 'monthly' })];

    const result = buildSankeyData(makeWaterfall(), items, incomeSources, accounts);

    expect(result.nodes.map((n) => n.id)).toContain('pre-tax');
    const toHub = result.links.find((l) => l.source === 'gross-income' && l.target === 'pre-tax');
    expect(toHub?.value).toBe(12_000);
    const toAccount = result.links.find((l) => l.source === 'pre-tax' && l.target === 'acct-a1');
    expect(toAccount?.value).toBe(12_000);
  });

  it('routes post-tax savings out of net income', () => {
    const accounts = [makeAccount('a2', { name: 'Brokerage' })];
    const items = [makeItem({ destination_account_id: 'a2', amount: 500, frequency: 'monthly' })];

    // Waterfall consistent with the $500/mo contribution:
    // residual = net (86,820) - contributions (6,000) - expenses (36,000)
    const waterfall = makeWaterfall({
      total_post_tax_contributions_monthly: 500,
      total_disposable_income_monthly: 6_735,
      total_residual_monthly: 3_735,
      total_residual_annual: 44_820,
    });
    const result = buildSankeyData(waterfall, items, incomeSources, accounts);

    const link = result.links.find((l) => l.source === 'net-income' && l.target === 'acct-a2');
    expect(link?.value).toBe(6_000);
  });

  it('resolves percent-type items against their income source', () => {
    const accounts = [makeAccount('a1', { tax_treatment: 'pre_tax' })];
    const items = [
      makeItem({
        destination_account_id: 'a1',
        amount_type: 'percent',
        amount: 10, // 10% of $120k = $12k
        income_source_id: 'src1',
      }),
    ];

    const result = buildSankeyData(makeWaterfall(), items, incomeSources, accounts);
    const toAccount = result.links.find((l) => l.source === 'pre-tax' && l.target === 'acct-a1');
    expect(toAccount?.value).toBe(12_000);
  });

  it('shows surplus when residual is positive', () => {
    const result = buildSankeyData(makeWaterfall(), [], incomeSources);
    const surplus = result.links.find((l) => l.source === 'net-income' && l.target === 'surplus');
    expect(surplus?.value).toBe(50_820);
  });

  it('omits surplus and caps outflows when planned spending exceeds net income', () => {
    // Net income $86,820; plan $100k of expenses → deficit
    const items = [
      makeItem({
        id: 'exp1',
        bucket: 'expense',
        amount: 100_000,
        frequency: 'annual',
        name: 'Lifestyle',
      }),
    ];
    const waterfall = makeWaterfall({
      total_residual_monthly: (86_820 - 100_000) / 12,
      total_residual_annual: 86_820 - 100_000,
      total_expenses_monthly: 100_000 / 12,
      total_expenses_annual: 100_000,
    });

    const result = buildSankeyData(waterfall, items, incomeSources);

    expect(result.links.find((l) => l.target === 'surplus')).toBeUndefined();
    // Outflow is capped to net income so columns balance
    const expLink = result.links.find((l) => l.target === 'exp-exp1');
    expect(expLink?.value).toBe(86_820);
    // The node keeps the real planned amount for labels
    const expNode = result.nodes.find((n) => n.id === 'exp-exp1');
    expect(expNode?.displayValue).toBe(100_000);
  });

  it('filters by income source and scales shared totals proportionally', () => {
    const member = makeMemberWaterfall({
      income_sources: [
        {
          income_source_id: 'src1',
          name: 'Day Job',
          gross_monthly: 7_500,
          pre_tax_deductions_monthly: 0,
          taxable_from_source: 7_500,
        },
        {
          income_source_id: 'src2',
          name: 'Side Gig',
          gross_monthly: 2_500,
          pre_tax_deductions_monthly: 0,
          taxable_from_source: 2_500,
        },
      ],
    });
    const waterfall = makeWaterfall({ members: [member] });

    const result = buildSankeyData(waterfall, [], incomeSources, [], new Set(['src1']));

    // Only the filtered source appears
    const ids = result.nodes.map((n) => n.id);
    expect(ids).toContain('inc-src1');
    expect(ids).not.toContain('inc-src2');

    // src1 is 75% of gross; taxes scale to 75%
    expect(result.grossAnnual).toBe(90_000);
    const taxLink = result.links.find((l) => l.target === 'taxes');
    expect(taxLink?.value).toBe(Math.round(33_180 * 0.75));
  });

  it('orders savings nodes above cost nodes', () => {
    const accounts = [makeAccount('a2', { name: 'Brokerage' })];
    const items = [
      makeItem({ id: 's1', destination_account_id: 'a2', amount: 500 }),
      makeItem({ id: 'e1', bucket: 'expense', amount: 2_000, name: 'Rent' }),
    ];

    const result = buildSankeyData(makeWaterfall(), items, incomeSources, accounts);
    const idx = (id: string) => result.nodes.findIndex((n) => n.id === id);
    expect(idx('acct-a2')).toBeLessThan(idx('exp-e1'));
  });
});
