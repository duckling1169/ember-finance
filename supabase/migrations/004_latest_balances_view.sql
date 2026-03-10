-- ── View: latest_account_balances ──
-- Latest balance snapshot per account, using distinct on for efficiency.
-- Avoids fetching all snapshots just to find the most recent per account.

create or replace view latest_account_balances as
select distinct on (account_id)
  household_id,
  account_id,
  date,
  balance,
  available,
  source
from balance_snapshot
order by account_id, date desc;
