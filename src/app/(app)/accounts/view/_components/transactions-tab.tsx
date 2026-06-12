'use client';

import { useState, type ReactNode } from 'react';
import {
  useTransactions,
  useInvestmentActivity,
  useHiddenTransactions,
  useHiddenActivity,
  mutateActivity,
} from '@/lib/swr';
import { hideTransaction, unhideTransaction, hideActivity, unhideActivity } from '@/lib/api';
import { useToast } from '@/components/ui/toast';
import { Card, CardHeader, CardTitle, CardAction, CardContent } from '@/components/ui/card';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert } from '@/components/ui/alert';
import { GainCell } from '@/components/common/financial-cells';
import { IconEye, IconEyeOff, IconChevronLeft, IconChevronRight } from '@tabler/icons-react';
import { fmt } from '@/lib/formatters';
import type { Transaction, InvestmentActivity } from '@shared/types';

const PAGE_SIZE = 50;

type HiddenableTransaction = Transaction & { _hidden?: boolean };
type HiddenableActivity = InvestmentActivity & { _hidden?: boolean };

interface TransactionsTabProps {
  accountId: string;
  isInvestmentAccount: boolean;
}

export function TransactionsTab({ accountId, isInvestmentAccount }: TransactionsTabProps) {
  return isInvestmentAccount ? (
    <ActivityTable accountId={accountId} />
  ) : (
    <TransactionTable accountId={accountId} />
  );
}

// ── Cash transactions ──

function TransactionTable({ accountId }: { accountId: string }) {
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState('');
  const [showHidden, setShowHidden] = useState(false);
  const [actionError, setActionError] = useState('');
  const toast = useToast();

  const { data: visible, isLoading } = useTransactions({
    accountId,
    limit: PAGE_SIZE,
    offset,
  });
  const { data: hidden } = useHiddenTransactions(showHidden ? accountId : undefined);

  const rows: HiddenableTransaction[] = [
    ...(visible ?? []),
    ...(showHidden ? (hidden ?? []).map((t) => ({ ...t, _hidden: true })) : []),
  ]
    .filter(
      (t) =>
        !search ||
        t.description.toLowerCase().includes(search.toLowerCase()) ||
        (t.category ?? '').toLowerCase().includes(search.toLowerCase()),
    )
    .sort((a, b) => b.date.localeCompare(a.date));

  async function toggleHidden(txn: HiddenableTransaction) {
    try {
      if (txn._hidden) {
        await unhideTransaction(txn.id);
        toast('success', 'Transaction restored');
      } else {
        await hideTransaction(txn.id);
        toast('success', 'Transaction hidden');
      }
      setActionError('');
      await mutateActivity();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to update transaction');
    }
  }

  const hasMore = (visible?.length ?? 0) === PAGE_SIZE;

  const columns: DataTableColumn<HiddenableTransaction>[] = [
    {
      key: 'date',
      header: 'Date',
      cell: (t) => <Dim hidden={t._hidden}>{t.date}</Dim>,
      cellClassName: 'whitespace-nowrap font-mono tabular-nums text-muted-foreground',
    },
    {
      key: 'description',
      header: 'Description',
      cell: (t) => <Dim hidden={t._hidden}>{t.description}</Dim>,
      cellClassName: 'max-w-[280px] truncate font-medium',
    },
    {
      key: 'category',
      header: 'Category',
      priority: 2,
      cell: (t) => <Dim hidden={t._hidden}>{t.category || '—'}</Dim>,
      cellClassName: 'text-muted-foreground',
    },
    {
      key: 'amount',
      header: 'Amount',
      numeric: true,
      cell: (t) => (
        <Dim hidden={t._hidden}>
          <GainCell value={t.amount} />
        </Dim>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      headerClassName: 'w-10',
      cell: (t) => (
        <Dim hidden={t._hidden}>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => toggleHidden(t)}
            aria-label={t._hidden ? 'Restore transaction' : 'Hide transaction'}
            title={t._hidden ? 'Restore (was hidden as duplicate)' : 'Hide as duplicate'}
          >
            {t._hidden ? <IconEye size={14} stroke={1.5} /> : <IconEyeOff size={14} stroke={1.5} />}
          </Button>
        </Dim>
      ),
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Transactions</CardTitle>
        <CardAction>
          <div className="flex items-center gap-3">
            <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
              <Checkbox checked={showHidden} onChange={(e) => setShowHidden(e.target.checked)} />
              Show hidden
            </label>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              className="h-7 w-28 text-xs sm:w-40"
            />
          </div>
        </CardAction>
      </CardHeader>
      <CardContent>
        {actionError && (
          <Alert variant="error" className="mb-3" onDismiss={() => setActionError('')}>
            {actionError}
          </Alert>
        )}
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(t) => t.id}
          density="wide"
          mobile="priority"
          loading={isLoading}
          empty={{
            title: search ? 'No transactions match your search.' : 'No transactions yet.',
          }}
        />
        <Pager offset={offset} hasMore={hasMore} onChange={setOffset} />
      </CardContent>
    </Card>
  );
}

// ── Investment activity ──

function ActivityTable({ accountId }: { accountId: string }) {
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState('');
  const [showHidden, setShowHidden] = useState(false);
  const [actionError, setActionError] = useState('');
  const toast = useToast();

  const { data: visible, isLoading } = useInvestmentActivity({
    accountId,
    limit: PAGE_SIZE,
    offset,
  });
  const { data: hidden } = useHiddenActivity(showHidden ? accountId : undefined);

  const rows: HiddenableActivity[] = [
    ...(visible ?? []),
    ...(showHidden ? (hidden ?? []).map((a) => ({ ...a, _hidden: true })) : []),
  ]
    .filter(
      (a) =>
        !search ||
        (a.symbol ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (a.description ?? '').toLowerCase().includes(search.toLowerCase()) ||
        a.activity_type.toLowerCase().includes(search.toLowerCase()),
    )
    .sort((a, b) => b.date.localeCompare(a.date));

  async function toggleHidden(act: HiddenableActivity) {
    try {
      if (act._hidden) {
        await unhideActivity(act.id);
        toast('success', 'Activity restored');
      } else {
        await hideActivity(act.id);
        toast('success', 'Activity hidden');
      }
      setActionError('');
      await mutateActivity();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to update activity');
    }
  }

  const hasMore = (visible?.length ?? 0) === PAGE_SIZE;

  const columns: DataTableColumn<HiddenableActivity>[] = [
    {
      key: 'date',
      header: 'Date',
      cell: (a) => <Dim hidden={a._hidden}>{a.date}</Dim>,
      cellClassName: 'whitespace-nowrap font-mono tabular-nums text-muted-foreground',
    },
    {
      key: 'type',
      header: 'Type',
      cell: (a) => <Dim hidden={a._hidden}>{a.activity_type.replace(/_/g, ' ')}</Dim>,
      cellClassName: 'capitalize',
    },
    {
      key: 'symbol',
      header: 'Symbol',
      cell: (a) => <Dim hidden={a._hidden}>{a.symbol || '—'}</Dim>,
      cellClassName: 'font-medium',
    },
    {
      key: 'quantity',
      header: 'Qty',
      numeric: true,
      cell: (a) => <Dim hidden={a._hidden}>{a.quantity != null ? a.quantity : '—'}</Dim>,
    },
    {
      key: 'price',
      header: 'Price',
      numeric: true,
      cell: (a) => <Dim hidden={a._hidden}>{a.price != null ? fmt(a.price) : '—'}</Dim>,
    },
    {
      key: 'amount',
      header: 'Amount',
      numeric: true,
      cell: (a) => (
        <Dim hidden={a._hidden}>
          <GainCell value={a.amount} />
        </Dim>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      headerClassName: 'w-10',
      cell: (a) => (
        <Dim hidden={a._hidden}>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => toggleHidden(a)}
            aria-label={a._hidden ? 'Restore activity' : 'Hide activity'}
            title={a._hidden ? 'Restore (was hidden as duplicate)' : 'Hide as duplicate'}
          >
            {a._hidden ? <IconEye size={14} stroke={1.5} /> : <IconEyeOff size={14} stroke={1.5} />}
          </Button>
        </Dim>
      ),
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Investment Activity</CardTitle>
        <CardAction>
          <div className="flex items-center gap-3">
            <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
              <Checkbox checked={showHidden} onChange={(e) => setShowHidden(e.target.checked)} />
              Show hidden
            </label>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              className="h-7 w-28 text-xs sm:w-40"
            />
          </div>
        </CardAction>
      </CardHeader>
      <CardContent>
        {actionError && (
          <Alert variant="error" className="mb-3" onDismiss={() => setActionError('')}>
            {actionError}
          </Alert>
        )}
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(a) => a.id}
          density="wide"
          mobile="priority"
          loading={isLoading}
          empty={{
            title: search ? 'No activity matches your search.' : 'No investment activity yet.',
          }}
        />
        <Pager offset={offset} hasMore={hasMore} onChange={setOffset} />
      </CardContent>
    </Card>
  );
}

// ── Shared bits ──

/** Hidden rows keep their reduced-opacity treatment cell-by-cell (DataTable has no row-class hook). */
function Dim({ hidden, children }: { hidden?: boolean; children: ReactNode }) {
  return <span className={hidden ? 'opacity-50' : undefined}>{children}</span>;
}

function Pager({
  offset,
  hasMore,
  onChange,
}: {
  offset: number;
  hasMore: boolean;
  onChange: (offset: number) => void;
}) {
  if (offset === 0 && !hasMore) return null;
  return (
    <div className="mt-3 flex items-center justify-end gap-2 text-xs text-muted-foreground">
      <Button
        variant="ghost"
        size="icon-sm"
        disabled={offset === 0}
        onClick={() => onChange(Math.max(0, offset - PAGE_SIZE))}
        aria-label="Previous page"
      >
        <IconChevronLeft size={14} stroke={1.5} />
      </Button>
      <span>
        {offset + 1}&ndash;{offset + PAGE_SIZE}
      </span>
      <Button
        variant="ghost"
        size="icon-sm"
        disabled={!hasMore}
        onClick={() => onChange(offset + PAGE_SIZE)}
        aria-label="Next page"
      >
        <IconChevronRight size={14} stroke={1.5} />
      </Button>
    </div>
  );
}
