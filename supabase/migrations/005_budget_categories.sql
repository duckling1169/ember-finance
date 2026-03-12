-- Ember Finance — Phase 4: Budget categories
-- Add category/essential fields to cashflow_item, create expense_category lookup table

-- ══════════════════════════════════════════════════════════════
-- Extend cashflow_item with category and essential flag
-- ══════════════════════════════════════════════════════════════

alter table cashflow_item
  add column category text,
  add column is_essential boolean not null default true;

-- ══════════════════════════════════════════════════════════════
-- Expense Category (household-level lookup table)
-- ══════════════════════════════════════════════════════════════

create table expense_category (
  id              uuid primary key default gen_random_uuid(),
  household_id    uuid not null references household(id),
  name            text not null,
  is_essential    boolean not null default true,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now(),

  constraint uq_expense_category_name unique (household_id, name)
);

create index idx_expense_category_household on expense_category(household_id);

-- ══════════════════════════════════════════════════════════════
-- RLS: household isolation
-- ══════════════════════════════════════════════════════════════

alter table expense_category enable row level security;
create policy "household_isolation" on expense_category
  for all using (household_id = get_my_household_id());
