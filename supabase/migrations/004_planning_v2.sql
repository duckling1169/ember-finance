-- Ember Finance — Phase 2a: Planning data model extensions
-- Income sources, cashflow routing, FI portfolio flag, scenario assumptions

-- ══════════════════════════════════════════════════════════════
-- Income Source (first-class entity per member)
-- ══════════════════════════════════════════════════════════════

create table income_source (
  id              uuid primary key default gen_random_uuid(),
  household_id    uuid not null references household(id),
  member_id       uuid not null references member(id),
  name            text not null,
  type            text not null,
  gross_amount    numeric(14,2) not null,
  frequency       text not null,
  is_active       boolean not null default true,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now(),

  constraint chk_income_source_type
    check (type in ('employment', 'self_employment', 'passive', 'other')),
  constraint chk_income_source_amount_positive
    check (gross_amount > 0),
  constraint chk_income_source_frequency
    check (frequency in ('monthly', 'biweekly', 'annual', 'one_time'))
);

create index idx_income_source_household on income_source(household_id);
create index idx_income_source_member on income_source(member_id);

alter table income_source enable row level security;
create policy "household_isolation" on income_source
  for all using (household_id = get_my_household_id());

-- ══════════════════════════════════════════════════════════════
-- Extend cashflow_item with routing fields
-- ══════════════════════════════════════════════════════════════

alter table cashflow_item
  add column income_source_id uuid references income_source(id),
  add column destination_account_id uuid references account(id);

create index idx_cashflow_item_income_source on cashflow_item(income_source_id)
  where income_source_id is not null;
create index idx_cashflow_item_destination on cashflow_item(destination_account_id)
  where destination_account_id is not null;

-- ══════════════════════════════════════════════════════════════
-- Extend account with FI portfolio flag
-- ══════════════════════════════════════════════════════════════

alter table account
  add column include_in_fi_portfolio boolean;

-- Default: investment + HSA accounts are included
update account set include_in_fi_portfolio = true
  where account_type in ('brokerage', 'retirement', 'hsa');
update account set include_in_fi_portfolio = false
  where account_type not in ('brokerage', 'retirement', 'hsa');

alter table account alter column include_in_fi_portfolio set not null;
alter table account alter column include_in_fi_portfolio set default false;
