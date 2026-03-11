-- Ember Finance — Phase 1: Planning data model
-- New member columns, cashflow items, planning scenarios

-- ══════════════════════════════════════════════════════════════
-- Extend member with planning fields
-- ══════════════════════════════════════════════════════════════

alter table member
  add column state_of_residence text,
  add column tax_mode text not null default 'auto',
  add column effective_tax_rate_override numeric(5,2);

alter table member
  add constraint chk_member_state_of_residence
    check (state_of_residence is null or length(state_of_residence) = 2),
  add constraint chk_member_tax_mode
    check (tax_mode in ('auto', 'manual')),
  add constraint chk_member_tax_rate_override
    check (effective_tax_rate_override is null or (effective_tax_rate_override >= 0 and effective_tax_rate_override <= 100));

-- ══════════════════════════════════════════════════════════════
-- Cashflow Item (member or household level)
-- ══════════════════════════════════════════════════════════════

create table cashflow_item (
  id                      uuid primary key default gen_random_uuid(),
  household_id            uuid not null references household(id),
  member_id               uuid references member(id),
  name                    text not null,
  direction               text not null,
  bucket                  text not null,
  tax_treatment           text not null default 'taxable',
  amount                  numeric(14,2) not null,
  frequency               text not null,
  is_recurring            boolean not null default true,
  include_in_projection   boolean not null default true,
  start_date              date not null,
  end_date                date,
  created_at              timestamptz default now(),
  updated_at              timestamptz default now(),

  constraint chk_cashflow_direction
    check (direction in ('inflow', 'outflow')),
  constraint chk_cashflow_bucket
    check (bucket in (
      'salary', 'employer_match', 'pre_tax_deduction', 'retirement_deferral',
      'post_tax_contribution', 'expense', 'other'
    )),
  constraint chk_cashflow_amount_positive
    check (amount > 0),
  constraint chk_cashflow_frequency
    check (frequency in ('monthly', 'biweekly', 'annual', 'one_time')),
  constraint chk_cashflow_date_range
    check (end_date is null or end_date >= start_date)
);

create index idx_cashflow_item_household on cashflow_item(household_id);
create index idx_cashflow_item_member on cashflow_item(member_id) where member_id is not null;

-- ══════════════════════════════════════════════════════════════
-- Planning Scenario (household level)
-- ══════════════════════════════════════════════════════════════

create table planning_scenario (
  id              uuid primary key default gen_random_uuid(),
  household_id    uuid not null references household(id),
  name            text not null,
  is_base         boolean not null default false,
  assumptions     jsonb not null default '{}',
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

create index idx_planning_scenario_household on planning_scenario(household_id);

-- ══════════════════════════════════════════════════════════════
-- RLS: household isolation (same pattern as existing tables)
-- ══════════════════════════════════════════════════════════════

alter table cashflow_item enable row level security;
create policy "household_isolation" on cashflow_item
  for all using (household_id = get_my_household_id());

alter table planning_scenario enable row level security;
create policy "household_isolation" on planning_scenario
  for all using (household_id = get_my_household_id());
