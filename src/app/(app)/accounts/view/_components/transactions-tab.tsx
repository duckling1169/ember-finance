'use client';

import { useState } from 'react';
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
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { IconEye, IconEyeOff, IconChevronLeft, IconChevronRight } from '@tabler/icons-react';
import { fmt } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import type { Transaction, InvestmentActivity } from '@shared/types';

const PAGE_SIZE = 50;

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
  const toast = useToast();

  const { data: visible, isLoading } = useTransactions({
    accountId,
    limit: PAGE_SIZE,
    offset,
  });
  const { data: hidden } = useHiddenTransactions(showHidden ? accountId : undefined);

  const rows: (Transaction & { _hidden?: boolean })[] = [
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

  async function toggleHidden(txn: Transaction & { _hidden?: boolean }) {
    try {
      if (txn._hidden) {
        await unhideTransaction(txn.id);
        toast('success', 'Transaction restored');
      } else {
        await hideTransaction(txn.id);
        toast('success', 'Transaction hidden');
      }
      await mutateActivity();
    } catch (err) {
      toast('error', err instanceof Error ? err.message : 'Failed to update transaction');
    }
  }

  if (isLoading) return <TableSkeleton />;

  const hasMore = (visible?.length ?? 0) === PAGE_SIZE;

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
        {rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {search ? 'No transactions match your search.' : 'No transactions yet.'}
          </p>
        ) : (
          <div className="-mx-6 overflow-x-auto sm:mx-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="hidden sm:table-cell">Category</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((t) => (
                  <TableRow key={t.id} className={cn(t._hidden && 'opacity-50')}>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {t.date}
                    </TableCell>
                    <TableCell className="max-w-[280px] truncate font-medium">
                      {t.description}
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground sm:table-cell">
                      {t.category || '—'}
                    </TableCell>
                    <TableCell
                      className={cn(
                        'text-right font-mono tabular-nums',
                        t.amount > 0 ? 'text-gain' : undefined,
                      )}
                    >
                      {fmt(t.amount)}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => toggleHidden(t)}
                        aria-label={t._hidden ? 'Restore transaction' : 'Hide transaction'}
                        title={
                          t._hidden ? 'Restore (was hidden as duplicate)' : 'Hide as duplicate'
                        }
                      >
                        {t._hidden ? (
                          <IconEye size={14} stroke={1.5} />
                        ) : (
                          <IconEyeOff size={14} stroke={1.5} />
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
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
  const toast = useToast();

  const { data: visible, isLoading } = useInvestmentActivity({
    accountId,
    limit: PAGE_SIZE,
    offset,
  });
  const { data: hidden } = useHiddenActivity(showHidden ? accountId : undefined);

  const rows: (InvestmentActivity & { _hidden?: boolean })[] = [
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

  async function toggleHidden(act: InvestmentActivity & { _hidden?: boolean }) {
    try {
      if (act._hidden) {
        await unhideActivity(act.id);
        toast('success', 'Activity restored');
      } else {
        await hideActivity(act.id);
        toast('success', 'Activity hidden');
      }
      await mutateActivity();
    } catch (err) {
      toast('error', err instanceof Error ? err.message : 'Failed to update activity');
    }
  }

  if (isLoading) return <TableSkeleton />;

  const hasMore = (visible?.length ?? 0) === PAGE_SIZE;

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
        {rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {search ? 'No activity matches your search.' : 'No investment activity yet.'}
          </p>
        ) : (
          <div className="-mx-6 overflow-x-auto sm:mx-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Symbol</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((a) => (
                  <TableRow key={a.id} className={cn(a._hidden && 'opacity-50')}>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {a.date}
                    </TableCell>
                    <TableCell className="capitalize">
                      {a.activity_type.replace(/_/g, ' ')}
                    </TableCell>
                    <TableCell className="font-medium">{a.symbol || '—'}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      {a.quantity != null ? a.quantity : '—'}
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      {a.price != null ? fmt(a.price) : '—'}
                    </TableCell>
                    <TableCell
                      className={cn(
                        'text-right font-mono tabular-nums',
                        a.amount > 0 ? 'text-gain' : undefined,
                      )}
                    >
                      {fmt(a.amount)}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => toggleHidden(a)}
                        aria-label={a._hidden ? 'Restore activity' : 'Hide activity'}
                        title={
                          a._hidden ? 'Restore (was hidden as duplicate)' : 'Hide as duplicate'
                        }
                      >
                        {a._hidden ? (
                          <IconEye size={14} stroke={1.5} />
                        ) : (
                          <IconEyeOff size={14} stroke={1.5} />
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        <Pager offset={offset} hasMore={hasMore} onChange={setOffset} />
      </CardContent>
    </Card>
  );
}

// ── Shared bits ──

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
        size="icon-xs"
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
        size="icon-xs"
        disabled={!hasMore}
        onClick={() => onChange(offset + PAGE_SIZE)}
        aria-label="Next page"
      >
        <IconChevronRight size={14} stroke={1.5} />
      </Button>
    </div>
  );
}

function TableSkeleton() {
  return (
    <Card>
      <CardContent className="space-y-2 py-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
      </CardContent>
    </Card>
  );
}
