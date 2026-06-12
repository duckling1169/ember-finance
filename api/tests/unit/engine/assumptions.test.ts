import { describe, it, expect } from 'vitest';
import {
  resolveAssumptionValues,
  buildScenarioAssumptions,
  buildTaxParams,
} from '../../../src/engine/assumptions.js';
import type { AssumptionDefault, AssumptionRecord } from '../../../src/types/index.js';
import { TAX_PARAMS_2025 } from './fixtures.js';

function makeDefault(overrides: Partial<AssumptionDefault> = {}): AssumptionDefault {
  return {
    id: 'def-1',
    key: 'real_return_rate',
    value: 0.06,
    effective_date: '2025-01-01',
    source: 'ember default',
    created_at: '2025-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeRecord(overrides: Partial<AssumptionRecord> = {}): AssumptionRecord {
  return {
    id: 'rec-1',
    household_id: 'hh-1',
    scenario_id: null,
    key: 'real_return_rate',
    value: 0.05,
    effective_date: '2026-01-01',
    note: null,
    created_by: null,
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

const AS_OF = '2026-06-11';

describe('resolveAssumptionValues', () => {
  it('falls back to the default when no records exist', () => {
    const resolved = resolveAssumptionValues([makeDefault()], [], null, AS_OF);
    const entry = resolved.get('real_return_rate');
    expect(entry?.value).toBe(0.06);
    expect(entry?.source).toBe('default');
    expect(entry?.record_id).toBeNull();
  });

  it('household record overrides the default', () => {
    const resolved = resolveAssumptionValues([makeDefault()], [makeRecord()], null, AS_OF);
    const entry = resolved.get('real_return_rate');
    expect(entry?.value).toBe(0.05);
    expect(entry?.source).toBe('household');
    expect(entry?.record_id).toBe('rec-1');
  });

  it('scenario record overrides the household record', () => {
    const resolved = resolveAssumptionValues(
      [makeDefault()],
      [makeRecord(), makeRecord({ id: 'rec-2', scenario_id: 'scn-1', value: 0.04 })],
      'scn-1',
      AS_OF,
    );
    const entry = resolved.get('real_return_rate');
    expect(entry?.value).toBe(0.04);
    expect(entry?.source).toBe('scenario');
  });

  it('ignores scenario records for a different scenario', () => {
    const resolved = resolveAssumptionValues(
      [makeDefault()],
      [makeRecord({ id: 'rec-2', scenario_id: 'scn-other', value: 0.04 })],
      'scn-1',
      AS_OF,
    );
    expect(resolved.get('real_return_rate')?.source).toBe('default');
  });

  it('picks the latest effective_date <= as-of within a layer', () => {
    const resolved = resolveAssumptionValues(
      [],
      [
        makeRecord({ id: 'old', effective_date: '2025-06-01', value: 0.055 }),
        makeRecord({ id: 'new', effective_date: '2026-03-01', value: 0.05 }),
        makeRecord({ id: 'future', effective_date: '2027-01-01', value: 0.045 }),
      ],
      null,
      AS_OF,
    );
    const entry = resolved.get('real_return_rate');
    expect(entry?.record_id).toBe('new');
    expect(entry?.value).toBe(0.05);
  });

  it('falls through to the default when all records are future-dated', () => {
    const resolved = resolveAssumptionValues(
      [makeDefault()],
      [makeRecord({ effective_date: '2027-01-01' })],
      null,
      AS_OF,
    );
    expect(resolved.get('real_return_rate')?.source).toBe('default');
  });

  it('breaks effective_date ties by created_at (latest edit wins)', () => {
    const resolved = resolveAssumptionValues(
      [],
      [
        makeRecord({ id: 'first', created_at: '2026-01-01T00:00:00Z', value: 0.05 }),
        makeRecord({ id: 'second', created_at: '2026-02-01T00:00:00Z', value: 0.052 }),
      ],
      null,
      AS_OF,
    );
    expect(resolved.get('real_return_rate')?.record_id).toBe('second');
  });

  it('is deterministic for the same inputs', () => {
    const defaults = [makeDefault()];
    const records = [makeRecord()];
    const a = resolveAssumptionValues(defaults, records, null, AS_OF);
    const b = resolveAssumptionValues(defaults, records, null, AS_OF);
    expect(Array.from(a.entries())).toEqual(Array.from(b.entries()));
  });
});

describe('buildScenarioAssumptions', () => {
  it('builds the planning knobs from resolved values', () => {
    const resolved = resolveAssumptionValues(
      [
        makeDefault({ id: 'd1', key: 'gross_return_rate', value: 0.09 }),
        makeDefault({ id: 'd2', key: 'inflation_rate', value: 0.03 }),
        makeDefault({ id: 'd3', key: 'real_return_rate', value: 0.06 }),
        makeDefault({ id: 'd4', key: 'withdrawal_rate', value: 0.04 }),
        makeDefault({ id: 'd5', key: 'retirement_annual_spend_override', value: null }),
        makeDefault({ id: 'd6', key: 'contribution_growth_mode', value: 'none' }),
        makeDefault({ id: 'd7', key: 'contribution_growth_rate', value: null }),
      ],
      [makeRecord({ key: 'withdrawal_rate', value: 0.035 })],
      null,
      AS_OF,
    );

    const assumptions = buildScenarioAssumptions(resolved);
    expect(assumptions.withdrawal_rate).toBe(0.035);
    expect(assumptions.gross_return_rate).toBe(0.09);
    expect(assumptions.retirement_annual_spend_override).toBeNull();
    expect(assumptions.contribution_growth_mode).toBe('none');
  });
});

describe('buildTaxParams', () => {
  const taxDefaults: AssumptionDefault[] = [
    makeDefault({
      id: 'tx1',
      key: 'tax.federal_brackets',
      value: { year: 2025, brackets: TAX_PARAMS_2025.federal_brackets },
    }),
    makeDefault({
      id: 'tx2',
      key: 'tax.standard_deduction',
      value: { year: 2025, amounts: TAX_PARAMS_2025.standard_deduction },
    }),
    makeDefault({
      id: 'tx3',
      key: 'tax.fica',
      value: { year: 2025, ...TAX_PARAMS_2025.fica },
    }),
    makeDefault({
      id: 'tx4',
      key: 'tax.state_rates',
      value: { year: 2025, rates: TAX_PARAMS_2025.state_rates },
    }),
  ];

  it('assembles TaxParams from resolved assumption values', () => {
    const resolved = resolveAssumptionValues(taxDefaults, [], null, AS_OF);
    const params = buildTaxParams(resolved);
    expect(params.year).toBe(2025);
    expect(params.federal_brackets.single[0].rate).toBe(0.1);
    expect(params.standard_deduction.married_jointly).toBe(30000);
    expect(params.fica.ss_wage_cap).toBe(176100);
    expect(params.state_rates.CA).toBe(0.065);
  });

  it('a household bracket edit changes the params and the year stamp', () => {
    const records = [
      makeRecord({
        key: 'tax.federal_brackets',
        value: {
          year: 2026,
          brackets: {
            ...TAX_PARAMS_2025.federal_brackets,
            single: [{ min: 0, max: null, rate: 0.2 }],
          },
        },
      }),
    ];
    const resolved = resolveAssumptionValues(taxDefaults, records, null, AS_OF);
    const params = buildTaxParams(resolved);
    expect(params.year).toBe(2026);
    expect(params.federal_brackets.single).toHaveLength(1);
  });

  it('throws a clear error when a required key is missing', () => {
    const resolved = resolveAssumptionValues(taxDefaults.slice(0, 2), [], null, AS_OF);
    expect(() => buildTaxParams(resolved)).toThrow(/tax\.fica/);
  });
});
