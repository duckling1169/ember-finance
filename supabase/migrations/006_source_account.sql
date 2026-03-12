-- Ember Finance — Add source_account_id to cashflow_item
-- Enables modeling account-to-account transfers (e.g. checking → Roth IRA)

alter table cashflow_item
  add column source_account_id uuid references account(id);

create index idx_cashflow_item_source_account on cashflow_item(source_account_id)
  where source_account_id is not null;
