import type {
  AssumptionDefault,
  AssumptionRecord,
  ResolvedAssumption,
  ScenarioAssumptions,
  ContributionGrowthMode,
  TaxFilingStatus,
  USState,
} from '../types/index';
import type { TaxParams, FederalBracket, FICAParams } from './types';

/**
 * Pure assumption resolution.
 *
 * Layers (highest wins): scenario record > household record > default.
 * Within a layer: latest effective_date <= asOf wins; ties broken by
 * created_at. A layer whose rows are all future-dated falls through to
 * the next layer, so a pre-staged change (e.g. next year's brackets)
 * activates automatically on its effective date.
 */
export function resolveAssumptionValues(
  defaults: AssumptionDefault[],
  records: AssumptionRecord[],
  scenarioId: string | null,
  asOf: string,
): Map<string, ResolvedAssumption> {
  const keys = new Set<string>([...defaults.map((d) => d.key), ...records.map((r) => r.key)]);

  const pickLatest = <T extends { effective_date: string; created_at: string }>(
    rows: T[],
  ): T | null => {
    let best: T | null = null;
    for (const row of rows) {
      if (row.effective_date > asOf) continue;
      if (
        !best ||
        row.effective_date > best.effective_date ||
        (row.effective_date === best.effective_date && row.created_at > best.created_at)
      ) {
        best = row;
      }
    }
    return best;
  };

  const resolved = new Map<string, ResolvedAssumption>();

  for (const key of keys) {
    const scenarioRows = scenarioId
      ? records.filter((r) => r.key === key && r.scenario_id === scenarioId)
      : [];
    const householdRows = records.filter((r) => r.key === key && r.scenario_id === null);
    const defaultRows = defaults.filter((d) => d.key === key);

    const fromScenario = pickLatest(scenarioRows);
    if (fromScenario) {
      resolved.set(key, {
        key,
        value: fromScenario.value,
        effective_date: fromScenario.effective_date,
        source: 'scenario',
        record_id: fromScenario.id,
      });
      continue;
    }

    const fromHousehold = pickLatest(householdRows);
    if (fromHousehold) {
      resolved.set(key, {
        key,
        value: fromHousehold.value,
        effective_date: fromHousehold.effective_date,
        source: 'household',
        record_id: fromHousehold.id,
      });
      continue;
    }

    const fromDefault = pickLatest(defaultRows);
    if (fromDefault) {
      resolved.set(key, {
        key,
        value: fromDefault.value,
        effective_date: fromDefault.effective_date,
        source: 'default',
        record_id: null,
      });
    }
  }

  return resolved;
}

/**
 * Planning-knob keys mapped 1:1 onto the ScenarioAssumptions shape.
 *
 * Like buildTaxParams, this throws when a knob is unresolvable — no
 * silent in-code fallbacks. Defaults are seeded by migration, so a
 * missing key is a deployment error, and every number the engine
 * emits keeps a matching provenance entry.
 */
export function buildScenarioAssumptions(
  resolved: Map<string, ResolvedAssumption>,
): Required<ScenarioAssumptions> {
  const get = (key: string): unknown => {
    const entry = resolved.get(key);
    if (!entry) {
      throw new Error(`Missing required planning assumption: ${key} (are defaults seeded?)`);
    }
    return entry.value;
  };
  const num = (key: string): number => {
    const v = get(key);
    if (typeof v !== 'number') {
      throw new Error(`Planning assumption ${key} must be a number, got ${typeof v}`);
    }
    return v;
  };
  const nullableNum = (key: string): number | null => {
    const v = get(key);
    return typeof v === 'number' ? v : null;
  };

  const mode = get('contribution_growth_mode');

  return {
    gross_return_rate: num('gross_return_rate'),
    inflation_rate: num('inflation_rate'),
    real_return_rate: num('real_return_rate'),
    withdrawal_rate: num('withdrawal_rate'),
    retirement_annual_spend_override: nullableNum('retirement_annual_spend_override'),
    contribution_growth_mode:
      mode === 'inflation' || mode === 'fixed_rate' ? (mode as ContributionGrowthMode) : 'none',
    contribution_growth_rate: nullableNum('contribution_growth_rate'),
  };
}

// ── Tax params ──

interface FederalBracketsValue {
  year: number;
  brackets: Record<TaxFilingStatus, FederalBracket[]>;
}

interface StandardDeductionValue {
  year: number;
  amounts: Record<TaxFilingStatus, number>;
}

interface FICAValue extends FICAParams {
  year: number;
}

interface StateRatesValue {
  year: number;
  rates: Partial<Record<USState, number>>;
}

/**
 * Build the versioned tax tables the tax engine runs on.
 *
 * Throws when a required key is unresolvable — a deployment error
 * (defaults are seeded by migration), not a user-input condition.
 */
export function buildTaxParams(resolved: Map<string, ResolvedAssumption>): TaxParams {
  const get = <T>(key: string): T => {
    const entry = resolved.get(key);
    if (!entry || entry.value == null) {
      throw new Error(`Missing required tax assumption: ${key} (are defaults seeded?)`);
    }
    return entry.value as T;
  };

  const brackets = get<FederalBracketsValue>('tax.federal_brackets');
  const deduction = get<StandardDeductionValue>('tax.standard_deduction');
  const fica = get<FICAValue>('tax.fica');
  const stateRates = get<StateRatesValue>('tax.state_rates');

  return {
    year: brackets.year,
    federal_brackets: brackets.brackets,
    standard_deduction: deduction.amounts,
    fica: {
      ss_rate: fica.ss_rate,
      ss_wage_cap: fica.ss_wage_cap,
      medicare_rate: fica.medicare_rate,
      medicare_surtax_rate: fica.medicare_surtax_rate,
      medicare_surtax_threshold: fica.medicare_surtax_threshold,
    },
    state_rates: stateRates.rates,
  };
}
