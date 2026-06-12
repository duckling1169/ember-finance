'use client';

import { useState, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAccounts, useTransactions, useInvestmentActivity } from '@/lib/swr';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import { IconChevronDown, IconCheck } from '@tabler/icons-react';
import { GainCell } from '@/components/common/financial-cells';
import { fmt } from '@/lib/formatters';
import type { Transaction, InvestmentActivity, ActivityType } from '@shared/types';
import { INVESTMENT_ACCOUNT_TYPES, BANKING_ACCOUNT_TYPES } from '@shared/types';

const INVESTMENT_TYPES = new Set(INVESTMENT_ACCOUNT_TYPES);
const BANKING_TYPES = new Set(BANKING_ACCOUNT_TYPES);

// Unified row shape for the combined table
interface ActivityRow {
  id: string;
  date: string;
  account_id: string;
  kind: 'transaction' | 'investment';
  description: string;
  amount: number;
  category: string | null;
  activity_type: ActivityType | null;
  symbol: string | null;
  quantity: number | null;
  price: number | null;
  commission: number | null;
}

const ACTIVITY_TYPE_LABELS: Record<string, string> = {
  buy: 'Buy',
  sell: 'Sell',
  dividend: 'Dividend',
  reinvestment: 'Reinvestment',
  split: 'Split',
  transfer_in: 'Transfer In',
  transfer_out: 'Transfer Out',
  fee: 'Fee',
  interest: 'Interest',
  return_of_capital: 'Return of Capital',
};

function toRows(
  transactions: Transaction[],
  investmentActivity: InvestmentActivity[],
): ActivityRow[] {
  const txnRows: ActivityRow[] = transactions.map((t) => ({
    id: t.id,
    date: t.date,
    account_id: t.account_id,
    kind: 'transaction',
    description: t.description,
    amount: t.amount,
    category: t.category,
    activity_type: null,
    symbol: null,
    quantity: null,
    price: null,
    commission: null,
  }));

  const actRows: ActivityRow[] = investmentActivity.map((a) => ({
    id: a.id,
    date: a.date,
    account_id: a.account_id,
    kind: 'investment',
    description: a.description || ACTIVITY_TYPE_LABELS[a.activity_type] || a.activity_type,
    amount: a.amount,
    category: null,
    activity_type: a.activity_type,
    symbol: a.symbol,
    quantity: a.quantity,
    price: a.price,
    commission: a.commission,
  }));

  return [...txnRows, ...actRows];
}

export default function ActivityPage() {
  const searchParams = useSearchParams();
  const preselectedAccountId = searchParams.get('account');

  const { data: accounts, isLoading: acctsLoading, error: acctsError } = useAccounts();

  // Filter state
  const [selectedAccountIds, setSelectedAccountIds] = useState<Set<string> | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Build account list
  const accountList = useMemo(() => {
    if (!accounts) return [];
    return accounts.filter((a) => a.is_active !== false);
  }, [accounts]);

  // Effective selected accounts (default: all, or preselected from URL)
  const effectiveSelectedIds = useMemo(() => {
    if (selectedAccountIds) return selectedAccountIds;
    if (preselectedAccountId) return new Set([preselectedAccountId]);
    return new Set(accountList.map((a) => a.id));
  }, [selectedAccountIds, preselectedAccountId, accountList]);

  // Determine which types of accounts are selected
  const hasBankingAccounts = accountList.some(
    (a) => effectiveSelectedIds.has(a.id) && BANKING_TYPES.has(a.account_type),
  );
  const hasInvestmentAccounts = accountList.some(
    (a) => effectiveSelectedIds.has(a.id) && INVESTMENT_TYPES.has(a.account_type),
  );

  // Build filter params for the hooks
  const bankingAccountIds = accountList
    .filter((a) => effectiveSelectedIds.has(a.id) && BANKING_TYPES.has(a.account_type))
    .map((a) => a.id);
  const investmentAccountIds = accountList
    .filter((a) => effectiveSelectedIds.has(a.id) && INVESTMENT_TYPES.has(a.account_type))
    .map((a) => a.id);

  // Fetch transactions (one call per banking account since API filters by single accountId)
  // For simplicity, fetch all and filter client-side if multiple accounts
  const txnParams = useMemo(
    () => ({
      ...(bankingAccountIds.length === 1 ? { accountId: bankingAccountIds[0] } : {}),
      ...(dateFrom ? { from: dateFrom } : {}),
      ...(dateTo ? { to: dateTo } : {}),
    }),
    [bankingAccountIds, dateFrom, dateTo],
  );

  const actParams = useMemo(
    () => ({
      ...(investmentAccountIds.length === 1 ? { accountId: investmentAccountIds[0] } : {}),
      ...(dateFrom ? { from: dateFrom } : {}),
      ...(dateTo ? { to: dateTo } : {}),
    }),
    [investmentAccountIds, dateFrom, dateTo],
  );

  const {
    data: transactions,
    isLoading: txnLoading,
    error: txnError,
  } = useTransactions(hasBankingAccounts ? txnParams : undefined);
  const {
    data: activity,
    isLoading: actLoading,
    error: actError,
  } = useInvestmentActivity(hasInvestmentAccounts ? actParams : undefined);

  // Combine and filter (DataTable handles sorting)
  const rows = useMemo(() => {
    const txns = (transactions || []).filter((t) => effectiveSelectedIds.has(t.account_id));
    const acts = (activity || []).filter((a) => effectiveSelectedIds.has(a.account_id));
    return toRows(txns, acts);
  }, [transactions, activity, effectiveSelectedIds]);

  const loading = acctsLoading || txnLoading || actLoading;
  const error: unknown = acctsError || txnError || actError;

  function toggleAccount(id: string) {
    setSelectedAccountIds((prev) => {
      const current = prev ?? new Set(accountList.map((a) => a.id));
      const next = new Set(current);
      if (next.has(id)) {
        if (next.size > 1) next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleAll() {
    setSelectedAccountIds(new Set(accountList.map((a) => a.id)));
  }

  function accountName(id: string) {
    return accountList.find((a) => a.id === id)?.name || id;
  }

  // Show investment columns only when investment accounts are selected
  const showInvestmentCols = hasInvestmentAccounts;

  const columns: DataTableColumn<ActivityRow>[] = [
    {
      key: 'date',
      header: 'Date',
      sortValue: (row) => row.date,
      cell: (row) => row.date,
      cellClassName: 'font-mono tabular-nums text-sm',
    },
    {
      key: 'account',
      header: 'Account',
      cell: (row) => accountName(row.account_id),
      cellClassName: 'max-w-[120px] truncate text-xs text-muted-foreground',
    },
    {
      key: 'type',
      header: 'Type',
      sortValue: (row) => row.activity_type || row.kind,
      cell: (row) => <TypeBadge row={row} />,
    },
    {
      key: 'description',
      header: 'Description',
      sortValue: (row) => row.description.toLowerCase(),
      cell: (row) => row.description,
      cellClassName: 'max-w-[300px] truncate text-sm',
    },
    ...(showInvestmentCols
      ? [
          {
            key: 'symbol',
            header: 'Symbol',
            sortValue: (row: ActivityRow) => row.symbol || '',
            cell: (row: ActivityRow) => row.symbol || '',
            cellClassName: 'font-mono text-sm',
          } satisfies DataTableColumn<ActivityRow>,
        ]
      : []),
    {
      key: 'amount',
      header: 'Amount',
      numeric: true,
      sortValue: (row) => row.amount,
      cell: (row) => <GainCell value={row.amount} />,
    },
    ...(showInvestmentCols
      ? [
          {
            key: 'quantity',
            header: 'Qty',
            numeric: true,
            cell: (row: ActivityRow) => (row.quantity != null ? row.quantity : ''),
            cellClassName: 'text-sm text-muted-foreground',
          } satisfies DataTableColumn<ActivityRow>,
          {
            key: 'price',
            header: 'Price',
            numeric: true,
            cell: (row: ActivityRow) => (row.price != null ? fmt(row.price) : ''),
            cellClassName: 'text-sm text-muted-foreground',
          } satisfies DataTableColumn<ActivityRow>,
        ]
      : []),
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Activity</h1>

        <div className="flex flex-wrap items-center gap-3">
          {/* Date range */}
          <div className="flex items-center gap-2 text-sm">
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="h-8 w-auto"
              placeholder="From"
            />
            <span className="text-muted-foreground">—</span>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="h-8 w-auto"
            />
          </div>

          {/* Account filter */}
          <div className="relative">
            <button
              onClick={() => setFilterOpen((p) => !p)}
              className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            >
              {effectiveSelectedIds.size === accountList.length
                ? 'All accounts'
                : `${effectiveSelectedIds.size} account${effectiveSelectedIds.size !== 1 ? 's' : ''}`}
              <IconChevronDown size={14} />
            </button>

            {filterOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setFilterOpen(false)} />
                <div className="absolute right-0 top-full mt-1 z-50 w-64 rounded-md border border-border bg-popover shadow-md py-1 max-h-80 overflow-y-auto">
                  <button
                    onClick={toggleAll}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted/50 transition-colors"
                  >
                    <span
                      className={`h-4 w-4 rounded border flex items-center justify-center ${effectiveSelectedIds.size === accountList.length ? 'bg-primary border-primary' : 'border-border'}`}
                    >
                      {effectiveSelectedIds.size === accountList.length && (
                        <IconCheck size={12} className="text-primary-foreground" />
                      )}
                    </span>
                    <span className="font-medium">All accounts</span>
                  </button>
                  <div className="h-px bg-border mx-2 my-1" />
                  {accountList.map((a) => (
                    <button
                      key={a.id}
                      onClick={() => toggleAccount(a.id)}
                      className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted/50 transition-colors"
                    >
                      <span
                        className={`h-4 w-4 rounded border flex items-center justify-center ${effectiveSelectedIds.has(a.id) ? 'bg-primary border-primary' : 'border-border'}`}
                      >
                        {effectiveSelectedIds.has(a.id) && (
                          <IconCheck size={12} className="text-primary-foreground" />
                        )}
                      </span>
                      <span className="flex-1 text-left">
                        <span className="font-medium">{a.name}</span>
                        {a.institution && (
                          <span className="text-muted-foreground ml-1.5 text-xs">
                            {a.institution}
                          </span>
                        )}
                      </span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Activity table */}
      <Card size="sm">
        <CardContent>
          <DataTable
            columns={columns}
            rows={rows}
            rowKey={(row) => row.id}
            density="wide"
            mobile="scroll"
            defaultSort={{ key: 'date', dir: 'desc' }}
            loading={loading}
            loadingRows={6}
            error={
              error
                ? {
                    message: error instanceof Error ? error.message : 'Failed to load activity.',
                  }
                : null
            }
            empty={{
              title: 'No activity',
              description: 'No activity found for the selected accounts and date range.',
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function TypeBadge({ row }: { row: ActivityRow }) {
  if (row.kind === 'investment' && row.activity_type) {
    const label = ACTIVITY_TYPE_LABELS[row.activity_type] || row.activity_type;
    const color = getActivityColor(row.activity_type);
    return (
      <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium ${color}`}>
        {label}
      </span>
    );
  }

  if (row.category) {
    return (
      <span className="inline-block px-1.5 py-0.5 rounded text-xs font-medium bg-muted text-muted-foreground">
        {row.category}
      </span>
    );
  }

  return (
    <span className="inline-block px-1.5 py-0.5 rounded text-xs font-medium bg-muted text-muted-foreground">
      {row.amount >= 0 ? 'Credit' : 'Debit'}
    </span>
  );
}

function getActivityColor(type: ActivityType): string {
  switch (type) {
    case 'buy':
      return 'bg-chart-5/15 text-chart-5';
    case 'sell':
      return 'bg-primary/15 text-primary';
    case 'dividend':
    case 'interest':
      return 'bg-gain/15 text-gain';
    case 'reinvestment':
      return 'bg-primary/15 text-primary';
    case 'fee':
      return 'bg-loss/15 text-loss';
    case 'transfer_in':
    case 'transfer_out':
      return 'bg-muted text-muted-foreground';
    default:
      return 'bg-muted text-muted-foreground';
  }
}
