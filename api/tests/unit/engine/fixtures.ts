import type { TaxParams } from '../../../src/engine/types.js';

/**
 * 2025 tax tables fixture — mirrors the seeded `assumption_default`
 * values in supabase/migrations/003_assumptions.sql. Unit tests stay
 * pure by constructing TaxParams directly instead of resolving from
 * the database.
 */
export const TAX_PARAMS_2025: TaxParams = {
  year: 2025,
  federal_brackets: {
    single: [
      { min: 0, max: 11_925, rate: 0.1 },
      { min: 11_925, max: 48_475, rate: 0.12 },
      { min: 48_475, max: 103_350, rate: 0.22 },
      { min: 103_350, max: 197_300, rate: 0.24 },
      { min: 197_300, max: 250_525, rate: 0.32 },
      { min: 250_525, max: 626_350, rate: 0.35 },
      { min: 626_350, max: null, rate: 0.37 },
    ],
    married_jointly: [
      { min: 0, max: 23_850, rate: 0.1 },
      { min: 23_850, max: 96_950, rate: 0.12 },
      { min: 96_950, max: 206_700, rate: 0.22 },
      { min: 206_700, max: 394_600, rate: 0.24 },
      { min: 394_600, max: 501_050, rate: 0.32 },
      { min: 501_050, max: 751_600, rate: 0.35 },
      { min: 751_600, max: null, rate: 0.37 },
    ],
    married_separately: [
      { min: 0, max: 11_925, rate: 0.1 },
      { min: 11_925, max: 48_475, rate: 0.12 },
      { min: 48_475, max: 103_350, rate: 0.22 },
      { min: 103_350, max: 197_300, rate: 0.24 },
      { min: 197_300, max: 250_525, rate: 0.32 },
      { min: 250_525, max: 375_800, rate: 0.35 },
      { min: 375_800, max: null, rate: 0.37 },
    ],
    head_of_household: [
      { min: 0, max: 17_000, rate: 0.1 },
      { min: 17_000, max: 64_850, rate: 0.12 },
      { min: 64_850, max: 103_350, rate: 0.22 },
      { min: 103_350, max: 197_300, rate: 0.24 },
      { min: 197_300, max: 250_500, rate: 0.32 },
      { min: 250_500, max: 626_350, rate: 0.35 },
      { min: 626_350, max: null, rate: 0.37 },
    ],
  },
  standard_deduction: {
    single: 15_000,
    married_jointly: 30_000,
    married_separately: 15_000,
    head_of_household: 22_500,
  },
  fica: {
    ss_rate: 0.062,
    ss_wage_cap: 176_100,
    medicare_rate: 0.0145,
    medicare_surtax_rate: 0.009,
    medicare_surtax_threshold: {
      single: 200_000,
      married_jointly: 250_000,
      married_separately: 125_000,
      head_of_household: 200_000,
    },
  },
  state_rates: {
    CA: 0.065,
    NY: 0.06,
    TX: 0,
    FL: 0,
    WA: 0,
    PA: 0.0307,
  },
};
