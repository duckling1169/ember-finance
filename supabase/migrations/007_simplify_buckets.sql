-- Ember Finance — Simplify cashflow buckets & drop tax_treatment
-- Old buckets: salary, employer_match, pre_tax_deduction, retirement_deferral,
--              post_tax_contribution, expense, other
-- New buckets: saving, employer_match, expense
-- Tax nature is now derived from the linked account's tax_bucket.

-- ══════════════════════════════════════════════════════════════
-- Drop old constraint first so we can migrate data
-- ══════════════════════════════════════════════════════════════

alter table cashflow_item drop constraint chk_cashflow_bucket;

-- ══════════════════════════════════════════════════════════════
-- Migrate existing bucket values to new vocabulary
-- ══════════════════════════════════════════════════════════════

update cashflow_item set bucket = 'saving'
  where bucket in ('pre_tax_deduction', 'retirement_deferral', 'post_tax_contribution', 'salary', 'other');

-- ══════════════════════════════════════════════════════════════
-- Add new constraint
-- ══════════════════════════════════════════════════════════════

alter table cashflow_item add constraint chk_cashflow_bucket
  check (bucket in ('saving', 'employer_match', 'expense'));

-- ══════════════════════════════════════════════════════════════
-- Drop tax_treatment column (no longer used)
-- ══════════════════════════════════════════════════════════════

alter table cashflow_item drop column tax_treatment;
