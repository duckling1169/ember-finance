import {
  ASSUMPTION_KEYS,
  ALLOCATION_BUCKETS,
  US_STATES,
  type AssumptionKeyMeta,
} from '../types/index.js';

/**
 * Boundary validation for user-submitted assumption values.
 *
 * The four engine-critical tax keys get structural validation (a bad
 * shape would crash the tax engine); other table-shaped keys only need
 * to be JSON objects/arrays. Returns an error message, or null if valid.
 */
export function validateAssumptionValue(key: string, value: unknown): string | null {
  const meta = ASSUMPTION_KEYS.find((k) => k.key === key);
  if (!meta) return `Unknown assumption key: ${key}`;

  if (value === null) {
    return meta.nullable ? null : `${key} cannot be null`;
  }

  switch (meta.kind) {
    case 'rate':
      return validateRate(key, value);
    case 'currency':
      return validateCurrency(key, value);
    case 'enum':
      return validateEnum(meta, value);
    case 'table':
      return validateTable(key, value);
  }
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function validateRate(key: string, value: unknown): string | null {
  if (!isFiniteNumber(value)) return `${key} must be a number`;
  // Rates are stored as decimals (0.07 = 7%) — reject percent-style values
  if (value <= -1 || value >= 1) {
    return `${key} must be a decimal between -1 and 1 (e.g. 0.07 for 7%)`;
  }
  if (key === 'withdrawal_rate' && value <= 0) {
    return 'withdrawal_rate must be greater than 0';
  }
  return null;
}

function validateCurrency(key: string, value: unknown): string | null {
  if (!isFiniteNumber(value) || value < 0) return `${key} must be a non-negative number`;
  return null;
}

function validateEnum(meta: AssumptionKeyMeta, value: unknown): string | null {
  if (typeof value !== 'string' || !meta.enum_options?.includes(value)) {
    return `${meta.key} must be one of: ${meta.enum_options?.join(', ')}`;
  }
  return null;
}

const FILING_STATUSES = [
  'single',
  'married_jointly',
  'married_separately',
  'head_of_household',
] as const;

function validateTable(key: string, value: unknown): string | null {
  switch (key) {
    case 'tax.federal_brackets':
      return validateFederalBrackets(value);
    case 'tax.standard_deduction':
      return validateStandardDeduction(value);
    case 'tax.fica':
      return validateFICA(value);
    case 'tax.state_rates':
      return validateStateRates(value);
    case 'allocation.targets':
      return validateAllocationTargets(value);
    case 'allocation.symbol_overrides':
      return validateSymbolOverrides(value);
    default:
      // Rule-shaped values not yet consumed by the engine — require JSON structure only
      if (typeof value !== 'object') return `${key} must be a JSON object or array`;
      return null;
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function validateYear(obj: Record<string, unknown>, key: string): string | null {
  if (!isFiniteNumber(obj.year) || obj.year < 1900 || obj.year > 2200) {
    return `${key} must include a numeric "year"`;
  }
  return null;
}

function validateFederalBrackets(value: unknown): string | null {
  const obj = asRecord(value);
  if (!obj) return 'tax.federal_brackets must be an object';
  const yearErr = validateYear(obj, 'tax.federal_brackets');
  if (yearErr) return yearErr;

  const brackets = asRecord(obj.brackets);
  if (!brackets) return 'tax.federal_brackets must include a "brackets" object';

  for (const status of FILING_STATUSES) {
    const list = brackets[status];
    if (!Array.isArray(list) || list.length === 0) {
      return `tax.federal_brackets.brackets.${status} must be a non-empty array`;
    }
    let prevMin = -1;
    for (let i = 0; i < list.length; i++) {
      const b = asRecord(list[i]);
      if (!b) return `tax.federal_brackets.${status}[${i}] must be an object`;
      if (!isFiniteNumber(b.min) || b.min < 0) {
        return `tax.federal_brackets.${status}[${i}].min must be a non-negative number`;
      }
      if (b.max !== null && (!isFiniteNumber(b.max) || b.max <= b.min)) {
        return `tax.federal_brackets.${status}[${i}].max must be null or greater than min`;
      }
      if (!isFiniteNumber(b.rate) || b.rate < 0 || b.rate >= 1) {
        return `tax.federal_brackets.${status}[${i}].rate must be a decimal between 0 and 1`;
      }
      if (b.min <= prevMin) {
        return `tax.federal_brackets.${status} brackets must be sorted by ascending min`;
      }
      prevMin = b.min;
    }
    const first = asRecord(list[0]);
    const last = asRecord(list[list.length - 1]);
    if (first?.min !== 0) return `tax.federal_brackets.${status} must start at min 0`;
    if (last?.max !== null) return `tax.federal_brackets.${status} top bracket must have max null`;
  }
  return null;
}

function validateStatusAmounts(
  obj: unknown,
  label: string,
  opts: { positive?: boolean } = {},
): string | null {
  const rec = asRecord(obj);
  if (!rec) return `${label} must be an object`;
  for (const status of FILING_STATUSES) {
    const v = rec[status];
    if (!isFiniteNumber(v) || v < 0 || (opts.positive && v <= 0)) {
      return `${label}.${status} must be a ${opts.positive ? 'positive' : 'non-negative'} number`;
    }
  }
  return null;
}

function validateStandardDeduction(value: unknown): string | null {
  const obj = asRecord(value);
  if (!obj) return 'tax.standard_deduction must be an object';
  return (
    validateYear(obj, 'tax.standard_deduction') ??
    validateStatusAmounts(obj.amounts, 'tax.standard_deduction.amounts')
  );
}

function validateFICA(value: unknown): string | null {
  const obj = asRecord(value);
  if (!obj) return 'tax.fica must be an object';
  const yearErr = validateYear(obj, 'tax.fica');
  if (yearErr) return yearErr;

  for (const field of ['ss_rate', 'medicare_rate', 'medicare_surtax_rate'] as const) {
    const v = obj[field];
    if (!isFiniteNumber(v) || v < 0 || v >= 1) {
      return `tax.fica.${field} must be a decimal between 0 and 1`;
    }
  }
  if (!isFiniteNumber(obj.ss_wage_cap) || obj.ss_wage_cap <= 0) {
    return 'tax.fica.ss_wage_cap must be a positive number';
  }
  return validateStatusAmounts(
    obj.medicare_surtax_threshold,
    'tax.fica.medicare_surtax_threshold',
    {
      positive: true,
    },
  );
}

function validateStateRates(value: unknown): string | null {
  const obj = asRecord(value);
  if (!obj) return 'tax.state_rates must be an object';
  const yearErr = validateYear(obj, 'tax.state_rates');
  if (yearErr) return yearErr;

  const rates = asRecord(obj.rates);
  if (!rates) return 'tax.state_rates must include a "rates" object';
  for (const [state, rate] of Object.entries(rates)) {
    if (!isFiniteNumber(rate) || rate < 0 || rate >= 0.25) {
      return `tax.state_rates.rates.${state} must be a decimal between 0 and 0.25`;
    }
  }
  // Require full coverage — a missing state would otherwise be silently taxed at $0
  const missing = US_STATES.filter((s) => rates[s] === undefined);
  if (missing.length > 0) {
    return `tax.state_rates.rates is missing: ${missing.join(', ')} (use 0 for no-income-tax states)`;
  }
  return null;
}

function validateAllocationTargets(value: unknown): string | null {
  if (!Array.isArray(value)) return 'allocation.targets must be an array';
  const seen = new Set<string>();
  for (let i = 0; i < value.length; i++) {
    const t = asRecord(value[i]);
    if (!t) return `allocation.targets[${i}] must be an object`;
    if (
      typeof t.bucket !== 'string' ||
      !(ALLOCATION_BUCKETS as readonly string[]).includes(t.bucket)
    ) {
      return `allocation.targets[${i}].bucket must be one of: ${ALLOCATION_BUCKETS.join(', ')}`;
    }
    if (seen.has(t.bucket)) return `allocation.targets has duplicate bucket: ${t.bucket}`;
    seen.add(t.bucket);
    if (!isFiniteNumber(t.target_pct) || t.target_pct < 0 || t.target_pct > 1) {
      return `allocation.targets[${i}].target_pct must be a decimal between 0 and 1`;
    }
    if (!isFiniteNumber(t.band_pct) || t.band_pct < 0 || t.band_pct > 1) {
      return `allocation.targets[${i}].band_pct must be a decimal between 0 and 1`;
    }
  }
  return null;
}

function validateSymbolOverrides(value: unknown): string | null {
  const obj = asRecord(value);
  if (!obj) return 'allocation.symbol_overrides must be an object';
  for (const [symbol, bucket] of Object.entries(obj)) {
    if (typeof bucket !== 'string' || !(ALLOCATION_BUCKETS as readonly string[]).includes(bucket)) {
      return `allocation.symbol_overrides.${symbol} must be one of: ${ALLOCATION_BUCKETS.join(', ')}`;
    }
  }
  return null;
}
