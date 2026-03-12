'use client';

import { useState, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAccounts, useTransactions, useInvestmentActivity } from '@/lib/swr';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { IconChevronDown, IconCheck } from '@tabler/icons-react';
import { SortIcon, type SortDir } from '@/components/common/sort-icon';
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

type SortKey = 'date' | 'description' | 'amount' | 'symbol' | 'type';

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

function sortRows(rows: ActivityRow[], key: SortKey | null, dir: SortDir): ActivityRow[] {
  if (!key) return rows;
  return [...rows].sort((a, b) => {
    let aVal: string | number;
    let bVal: string | number;

    switch (key) {
      case 'date':
        aVal = a.date;
        bVal = b.date;
        break;
      case 'description':
        aVal = a.description.toLowerCase();
        bVal = b.description.toLowerCase();
        break;
      case 'amount':
        aVal = a.amount;
        bVal = b.amount;
        break;
      case 'symbol':
        aVal = a.symbol || '';
        bVal = b.symbol || '';
        break;
      case 'type':
        aVal = a.activity_type || a.kind;
        bVal = b.activity_type || b.kind;
        break;
    }

    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return dir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    }
    return dir === 'asc' ? Number(aVal) - Number(bVal) : Number(bVal) - Number(aVal);
  });
}

export default function ActivityPage() {
  const searchParams = useSearchParams();
  const preselectedAccountId = searchParams.get('account');

  const { data: accounts, isLoading: acctsLoading } = useAccounts();

  // Filter state
  const [selectedAccountIds, setSelectedAccountIds] = useState<Set<string> | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Sort state
  const [sortKey, setSortKey] = useState<SortKey | null>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

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

  const { data: transactions, isLoading: txnLoading } = useTransactions(
    hasBankingAccounts ? txnParams : undefined,
  );
  const { data: activity, isLoading: actLoading } = useInvestmentActivity(
    hasInvestmentAccounts ? actParams : undefined,
  );

  // Combine and filter
  const rows = useMemo(() => {
    const txns = (transactions || []).filter((t) => effectiveSelectedIds.has(t.account_id));
    const acts = (activity || []).filter((a) => effectiveSelectedIds.has(a.account_id));
    const combined = toRows(txns, acts);
    return sortRows(combined, sortKey, sortDir);
  }, [transactions, activity, effectiveSelectedIds, sortKey, sortDir]);

  const loading = acctsLoading || txnLoading || actLoading;

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'date' ? 'desc' : 'asc');
    }
  }

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

  const columns: { key: SortKey; label: string; align?: 'right'; show?: boolean }[] = [
    { key: 'date', label: 'Date' },
    { key: 'type', label: 'Type' },
    { key: 'description', label: 'Description' },
    { key: 'symbol', label: 'Symbol', show: showInvestmentCols },
    { key: 'amount', label: 'Amount', align: 'right' },
  ];

  const visibleColumns = columns.filter((c) => c.show !== false);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Activity</h1>

        <div className="flex items-center gap-3">
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
          {loading ? (
            <div className="py-10 text-center text-muted-foreground">Loading...</div>
          ) : rows.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground">
              No activity found for the selected accounts and date range.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10 text-muted-foreground">Account</TableHead>
                  {visibleColumns.map((col) => (
                    <TableHead
                      key={col.key}
                      className={`cursor-pointer select-none hover:text-foreground transition-colors ${col.align === 'right' ? 'text-right' : ''}`}
                      onClick={() => toggleSort(col.key)}
                    >
                      <span className="inline-flex items-center gap-1">
                        {col.label}
                        <SortIcon field={col.key} sortKey={sortKey} sortDir={sortDir} />
                      </span>
                    </TableHead>
                  ))}
                  {showInvestmentCols && (
                    <>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Price</TableHead>
                    </>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id} className="hover:bg-primary/5">
                    <TableCell className="text-xs text-muted-foreground truncate max-w-[120px]">
                      {accountName(row.account_id)}
                    </TableCell>
                    <TableCell className="font-mono tabular-nums text-sm">{row.date}</TableCell>
                    <TableCell>
                      <TypeBadge row={row} />
                    </TableCell>
                    <TableCell className="text-sm max-w-[300px] truncate">
                      {row.description}
                    </TableCell>
                    {showInvestmentCols && (
                      <TableCell className="font-mono text-sm">{row.symbol || ''}</TableCell>
                    )}
                    <TableCell className="text-right">
                      <GainCell value={row.amount} />
                    </TableCell>
                    {showInvestmentCols && (
                      <>
                        <TableCell className="text-right font-mono tabular-nums text-sm text-muted-foreground">
                          {row.quantity != null ? row.quantity : ''}
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums text-sm text-muted-foreground">
                          {row.price != null ? fmt(row.price) : ''}
                        </TableCell>
                      </>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
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
