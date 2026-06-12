-- ══════════════════════════════════════════════════════════════
-- 003: Assumptions system
--
-- Every assumption that drives projections — planning knobs
-- (returns, inflation, withdrawal rate) and rule-shaped tax
-- parameters (brackets, FICA, ACA, IRMAA, NIIT, AMT, …) — becomes
-- an individually date-stamped record.
--
-- Three resolution layers (highest wins):
--   1. assumption_record with scenario_id  (scenario override)
--   2. assumption_record, scenario_id null (household baseline)
--   3. assumption_default                  (Ember-shipped, dated)
-- Within a layer: latest effective_date <= as-of date wins;
-- ties broken by created_at.
--
-- assumption_record is append-only: an "edit" inserts a new row,
-- so the table is its own audit trail.
-- ══════════════════════════════════════════════════════════════

-- ── Tables ──

-- Global reference defaults (like security_price: public data, no
-- household scoping). Read-only to users; seeded by migrations.
create table assumption_default (
  id              uuid primary key default gen_random_uuid(),
  key             text not null,
  value           jsonb not null,
  effective_date  date not null,
  source          text not null default 'ember',
  created_at      timestamptz not null default now(),

  constraint uq_assumption_default unique (key, effective_date)
);

alter table assumption_default enable row level security;
create policy "read_only_reference" on assumption_default
  for select to authenticated using (true);

-- Household/scenario assumption records (append-only)
create table assumption_record (
  id              uuid primary key default gen_random_uuid(),
  household_id    uuid not null references household(id) on delete cascade,
  scenario_id     uuid references planning_scenario(id) on delete cascade,
  key             text not null,
  value           jsonb not null,
  effective_date  date not null,
  note            text,
  created_by      uuid references member(id) on delete set null,
  created_at      timestamptz not null default now()
);

create index idx_assumption_record_lookup
  on assumption_record(household_id, key, effective_date);
create index idx_assumption_record_scenario
  on assumption_record(scenario_id) where scenario_id is not null;

alter table assumption_record enable row level security;
create policy "household_isolation" on assumption_record
  for all using (household_id = get_my_household_id());

-- ── Migrate existing scenario assumptions JSONB into records ──

insert into assumption_record (household_id, scenario_id, key, value, effective_date, note)
select
  ps.household_id,
  ps.id,
  kv.key,
  kv.value,
  coalesce(ps.updated_at::date, current_date),
  'migrated from planning_scenario.assumptions'
from planning_scenario ps,
     lateral jsonb_each(ps.assumptions) kv
where ps.assumptions is not null
  and ps.assumptions != '{}'::jsonb
  and kv.value != 'null'::jsonb;

alter table planning_scenario drop column assumptions;

-- ══════════════════════════════════════════════════════════════
-- Seed defaults
--
-- Dated reference values shipped by Ember. No promise of tracking
-- live law — households override via assumption_record (the
-- assumptions panel), and changing a tax year is a new seed row
-- here, not a code change.
-- ══════════════════════════════════════════════════════════════

-- ── Planning knobs (match previous engine DEFAULT_ASSUMPTIONS) ──

insert into assumption_default (key, value, effective_date, source) values
  ('gross_return_rate',                '0.09',   '2025-01-01', 'ember default'),
  ('inflation_rate',                   '0.03',   '2025-01-01', 'ember default'),
  ('real_return_rate',                 '0.06',   '2025-01-01', 'ember default'),
  ('withdrawal_rate',                  '0.04',   '2025-01-01', 'ember default'),
  ('retirement_annual_spend_override', 'null',   '2025-01-01', 'ember default'),
  ('contribution_growth_mode',         '"none"', '2025-01-01', 'ember default'),
  ('contribution_growth_rate',         'null',   '2025-01-01', 'ember default');

-- ── Federal income tax (tax year 2025, IRS Rev. Proc. 2024-40) ──

insert into assumption_default (key, value, effective_date, source) values
('tax.federal_brackets', '{
  "year": 2025,
  "brackets": {
    "single": [
      {"min": 0, "max": 11925, "rate": 0.10},
      {"min": 11925, "max": 48475, "rate": 0.12},
      {"min": 48475, "max": 103350, "rate": 0.22},
      {"min": 103350, "max": 197300, "rate": 0.24},
      {"min": 197300, "max": 250525, "rate": 0.32},
      {"min": 250525, "max": 626350, "rate": 0.35},
      {"min": 626350, "max": null, "rate": 0.37}
    ],
    "married_jointly": [
      {"min": 0, "max": 23850, "rate": 0.10},
      {"min": 23850, "max": 96950, "rate": 0.12},
      {"min": 96950, "max": 206700, "rate": 0.22},
      {"min": 206700, "max": 394600, "rate": 0.24},
      {"min": 394600, "max": 501050, "rate": 0.32},
      {"min": 501050, "max": 751600, "rate": 0.35},
      {"min": 751600, "max": null, "rate": 0.37}
    ],
    "married_separately": [
      {"min": 0, "max": 11925, "rate": 0.10},
      {"min": 11925, "max": 48475, "rate": 0.12},
      {"min": 48475, "max": 103350, "rate": 0.22},
      {"min": 103350, "max": 197300, "rate": 0.24},
      {"min": 197300, "max": 250525, "rate": 0.32},
      {"min": 250525, "max": 375800, "rate": 0.35},
      {"min": 375800, "max": null, "rate": 0.37}
    ],
    "head_of_household": [
      {"min": 0, "max": 17000, "rate": 0.10},
      {"min": 17000, "max": 64850, "rate": 0.12},
      {"min": 64850, "max": 103350, "rate": 0.22},
      {"min": 103350, "max": 197300, "rate": 0.24},
      {"min": 197300, "max": 250500, "rate": 0.32},
      {"min": 250500, "max": 626350, "rate": 0.35},
      {"min": 626350, "max": null, "rate": 0.37}
    ]
  }
}', '2025-01-01', 'IRS Rev. Proc. 2024-40'),

('tax.standard_deduction', '{
  "year": 2025,
  "amounts": {
    "single": 15000,
    "married_jointly": 30000,
    "married_separately": 15000,
    "head_of_household": 22500
  }
}', '2025-01-01', 'IRS Rev. Proc. 2024-40'),

('tax.fica', '{
  "year": 2025,
  "ss_rate": 0.062,
  "ss_wage_cap": 176100,
  "medicare_rate": 0.0145,
  "medicare_surtax_rate": 0.009,
  "medicare_surtax_threshold": {
    "single": 200000,
    "married_jointly": 250000,
    "married_separately": 125000,
    "head_of_household": 200000
  }
}', '2025-01-01', 'SSA 2025 COLA fact sheet; IRC 3101(b)(2)'),

('tax.state_rates', '{
  "year": 2025,
  "note": "Simplified flat effective rates approximating a median-income filer. States with no wage income tax = 0.",
  "rates": {
    "AL": 0.04, "AK": 0, "AZ": 0.025, "AR": 0.044, "CA": 0.065,
    "CO": 0.044, "CT": 0.055, "DE": 0.05, "FL": 0, "GA": 0.049,
    "HI": 0.06, "ID": 0.058, "IL": 0.0495, "IN": 0.0305, "IA": 0.044,
    "KS": 0.046, "KY": 0.04, "LA": 0.035, "ME": 0.055, "MD": 0.05,
    "MA": 0.05, "MI": 0.0425, "MN": 0.0585, "MS": 0.047, "MO": 0.048,
    "MT": 0.059, "NE": 0.0544, "NV": 0, "NH": 0, "NJ": 0.055,
    "NM": 0.04, "NY": 0.06, "NC": 0.045, "ND": 0.02, "OH": 0.035,
    "OK": 0.0375, "OR": 0.075, "PA": 0.0307, "RI": 0.0475, "SC": 0.05,
    "SD": 0, "TN": 0, "TX": 0, "UT": 0.0465, "VT": 0.055,
    "VA": 0.05, "WA": 0, "WV": 0.05, "WI": 0.053, "WY": 0, "DC": 0.06
  }
}', '2025-01-01', 'ember simplified state model'),

-- ── Retirement contribution limits (tax year 2025) ──

('tax.retirement_limits', '{
  "year": 2025,
  "limit_401k_elective": 23500,
  "catch_up_401k_50": 7500,
  "catch_up_401k_60_to_63": 11250,
  "limit_415c_total": 70000,
  "limit_ira": 7000,
  "catch_up_ira_50": 1000,
  "limit_hsa_individual": 4300,
  "limit_hsa_family": 8550,
  "catch_up_hsa_55": 1000
}', '2025-01-01', 'IRS Notice 2024-80; Rev. Proc. 2024-25'),

-- ── RMD start ages (SECURE 2.0) ──

('tax.rmd_ages', '{
  "year": 2025,
  "rules": [
    {"birth_year_max": 1950, "start_age": 72},
    {"birth_year_min": 1951, "birth_year_max": 1959, "start_age": 73},
    {"birth_year_min": 1960, "start_age": 75}
  ]
}', '2025-01-01', 'SECURE 2.0 Act sec. 107'),

-- ── ACA premium subsidy parameters ──
-- 2025: enhanced (IRA-extended) applicable percentages, no 400% FPL cliff.

('tax.aca', '{
  "year": 2025,
  "cliff_above_400_fpl": false,
  "applicable_percentages": [
    {"fpl_min": 0,    "fpl_max": 150,  "pct_start": 0,      "pct_end": 0},
    {"fpl_min": 150,  "fpl_max": 200,  "pct_start": 0,      "pct_end": 0.02},
    {"fpl_min": 200,  "fpl_max": 250,  "pct_start": 0.02,   "pct_end": 0.04},
    {"fpl_min": 250,  "fpl_max": 300,  "pct_start": 0.04,   "pct_end": 0.06},
    {"fpl_min": 300,  "fpl_max": 400,  "pct_start": 0.06,   "pct_end": 0.085},
    {"fpl_min": 400,  "fpl_max": null, "pct_start": 0.085,  "pct_end": 0.085}
  ],
  "fpl_48_states": {"base": 15060, "per_additional_person": 5380}
}', '2025-01-01', 'IRA sec. 12001 (through 2025); 2024 HHS FPL guidelines'),

-- 2026: statutory (pre-ARPA) percentages return, 400% FPL cliff returns.
-- Percentages are the 2026 indexed values per IRS Rev. Proc. 2025-25.

('tax.aca', '{
  "year": 2026,
  "cliff_above_400_fpl": true,
  "applicable_percentages": [
    {"fpl_min": 0,    "fpl_max": 133,  "pct_start": 0.0210, "pct_end": 0.0210},
    {"fpl_min": 133,  "fpl_max": 150,  "pct_start": 0.0315, "pct_end": 0.0420},
    {"fpl_min": 150,  "fpl_max": 200,  "pct_start": 0.0420, "pct_end": 0.0662},
    {"fpl_min": 200,  "fpl_max": 250,  "pct_start": 0.0662, "pct_end": 0.0846},
    {"fpl_min": 250,  "fpl_max": 300,  "pct_start": 0.0846, "pct_end": 0.0996},
    {"fpl_min": 300,  "fpl_max": 400,  "pct_start": 0.0996, "pct_end": 0.0996}
  ],
  "fpl_48_states": {"base": 15650, "per_additional_person": 5500}
}', '2026-01-01', 'IRS Rev. Proc. 2025-25; 2025 HHS FPL guidelines'),

-- ── Medicare IRMAA tiers (2025 premiums, based on 2023 MAGI) ──

('tax.irmaa', '{
  "year": 2025,
  "part_b_standard_monthly": 185.00,
  "tiers": [
    {"magi_single_max": 106000, "magi_joint_max": 212000, "part_b_total_monthly": 185.00, "part_d_surcharge_monthly": 0},
    {"magi_single_max": 133000, "magi_joint_max": 266000, "part_b_total_monthly": 259.00, "part_d_surcharge_monthly": 13.70},
    {"magi_single_max": 167000, "magi_joint_max": 334000, "part_b_total_monthly": 370.00, "part_d_surcharge_monthly": 35.30},
    {"magi_single_max": 200000, "magi_joint_max": 400000, "part_b_total_monthly": 480.90, "part_d_surcharge_monthly": 57.00},
    {"magi_single_max": 500000, "magi_joint_max": 750000, "part_b_total_monthly": 591.90, "part_d_surcharge_monthly": 78.60},
    {"magi_single_max": null,   "magi_joint_max": null,   "part_b_total_monthly": 628.90, "part_d_surcharge_monthly": 85.80}
  ]
}', '2025-01-01', 'CMS 2025 Medicare premium announcement'),

-- ── Net Investment Income Tax (statutory, not indexed) ──

('tax.niit', '{
  "year": 2025,
  "rate": 0.038,
  "magi_threshold": {
    "single": 200000,
    "married_jointly": 250000,
    "married_separately": 125000,
    "head_of_household": 200000
  }
}', '2025-01-01', 'IRC 1411'),

-- ── Alternative Minimum Tax (tax year 2025) ──

('tax.amt', '{
  "year": 2025,
  "exemption": {
    "single": 88100,
    "married_jointly": 137000,
    "married_separately": 68500,
    "head_of_household": 88100
  },
  "phaseout_start": {
    "single": 626350,
    "married_jointly": 1252700,
    "married_separately": 626350,
    "head_of_household": 626350
  },
  "rate_low": 0.26,
  "rate_high": 0.28,
  "rate_high_threshold": 239100
}', '2025-01-01', 'IRS Rev. Proc. 2024-40'),

-- ── Roth conversion plan inputs (user-owned; defaults are inert) ──

('tax.roth_conversion', '{
  "annual_conversion_amount": 0,
  "target_bracket_ceiling": null
}', '2025-01-01', 'ember default (user-edited plan input)'),

-- ── Portfolio allocation (user-owned; defaults are inert) ──

-- targets: [{"bucket": "stock", "target_pct": 0.7, "band_pct": 0.05}, ...]
('allocation.targets', '[]', '2025-01-01', 'ember default (user-edited plan input)'),

-- symbol_overrides: {"VXUS": "intl", "BND": "bond", ...}
('allocation.symbol_overrides', '{}', '2025-01-01', 'ember default (user-edited plan input)');
