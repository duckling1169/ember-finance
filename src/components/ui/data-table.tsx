'use client';

import * as React from 'react';
import { useState } from 'react';
import { IconChevronRight, IconChevronDown, type Icon } from '@tabler/icons-react';

import { cn } from '@/lib/utils';
import {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { SortIcon, type SortDir } from '@/components/common/sort-icon';

/**
 * The unified table (design principles 1, 7, 8 + mobile density):
 * - three density modes: compact | dense (expandable) | wide
 * - numeric columns: right-aligned, font-mono tabular-nums — enforced here
 * - standard expand affordance (chevron) for details-on-demand
 * - mobile behavior configured once: column priority, horizontal scroll with a
 *   frozen first column, or card transform
 * - built-in column-shaped loading skeleton, EmptyState, ErrorState
 */

export type DataTableDensity = 'compact' | 'dense' | 'wide';
export type DataTableMobile = 'priority' | 'scroll' | 'cards';

export interface DataTableColumn<T> {
  key: string;
  header: React.ReactNode;
  /** Right-align + Roboto Mono tabular figures. Use for every quantitative column. */
  numeric?: boolean;
  align?: 'left' | 'right';
  /** Mobile column priority: 1 always visible, 2 hidden < 640px, 3 hidden < 768px. */
  priority?: 1 | 2 | 3;
  /** Providing this makes the column sortable. */
  sortValue?: (row: T) => string | number;
  cell: (row: T, index: number) => React.ReactNode;
  headerClassName?: string;
  cellClassName?: string;
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  density?: DataTableDensity;
  mobile?: DataTableMobile;
  /** Details-on-demand: rendered full-width beneath the row when expanded. */
  renderExpanded?: (row: T) => React.ReactNode;
  defaultSort?: { key: string; dir: SortDir };
  loading?: boolean;
  loadingRows?: number;
  error?: { message?: string; retry?: () => void } | null;
  empty?: { icon?: Icon; title: string; description?: React.ReactNode; action?: React.ReactNode };
  /** Card transform for `mobile="cards"`; falls back to a label/value list. */
  renderCard?: (row: T) => React.ReactNode;
  onRowClick?: (row: T) => void;
  footer?: React.ReactNode;
  className?: string;
}

const DENSITY_CELL: Record<DataTableDensity, string> = {
  compact: 'py-1.5 text-xs',
  dense: 'py-2',
  wide: 'py-3',
};

const PRIORITY_CLASS: Record<number, string> = {
  1: '',
  2: 'hidden sm:table-cell',
  3: 'hidden md:table-cell',
};

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  density = 'dense',
  mobile = 'priority',
  renderExpanded,
  defaultSort,
  loading = false,
  loadingRows = 5,
  error = null,
  empty,
  renderCard,
  onRowClick,
  footer,
  className,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(defaultSort?.key ?? null);
  const [sortDir, setSortDir] = useState<SortDir>(defaultSort?.dir ?? 'desc');
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  const sortedRows = React.useMemo(() => {
    if (!sortKey) return rows;
    const col = columns.find((c) => c.key === sortKey);
    if (!col?.sortValue) return rows;
    const sv = col.sortValue;
    return [...rows].sort((a, b) => {
      const av = sv(a);
      const bv = sv(b);
      if (typeof av === 'string' && typeof bv === 'string') {
        return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      // NaN-safe: missing/mixed values sort as 0 instead of poisoning the order
      const an = Number(av) || 0;
      const bn = Number(bv) || 0;
      return sortDir === 'asc' ? an - bn : bn - an;
    });
  }, [rows, columns, sortKey, sortDir]);

  if (error) {
    return <ErrorState message={error.message || 'Failed to load data.'} retry={error.retry} />;
  }

  const expandable = !!renderExpanded;
  const isScroll = mobile === 'scroll';
  const isCards = mobile === 'cards';

  function colClasses(col: DataTableColumn<T>, isFirst: boolean) {
    return cn(
      (col.numeric || col.align === 'right') && 'text-right',
      mobile === 'priority' && col.priority ? PRIORITY_CLASS[col.priority] : '',
      isScroll && isFirst && 'sticky left-0 z-10 bg-card sm:static sm:bg-transparent',
    );
  }

  function toggleSort(col: DataTableColumn<T>) {
    if (!col.sortValue) return;
    if (sortKey === col.key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(col.key);
      setSortDir(col.numeric ? 'desc' : 'asc');
    }
  }

  // Plain function (not a nested component) so the table subtree keeps its
  // identity across renders.
  function renderShell(body: React.ReactNode) {
    return (
      <div className={cn(isScroll && '-mx-4 overflow-x-auto sm:mx-0', className)}>
        <Table>
          <TableHeader>
            <TableRow className="even:bg-transparent hover:bg-transparent">
              {expandable && <TableHead className="w-8" />}
              {columns.map((col, ci) => (
                <TableHead
                  key={col.key}
                  aria-sort={
                    sortKey === col.key
                      ? sortDir === 'asc'
                        ? 'ascending'
                        : 'descending'
                      : undefined
                  }
                  className={cn(colClasses(col, ci === 0), col.headerClassName)}
                >
                  {col.sortValue ? (
                    <button
                      type="button"
                      onClick={() => toggleSort(col)}
                      className="inline-flex cursor-pointer items-center gap-1 select-none transition-colors outline-none hover:text-foreground focus-visible:text-foreground focus-visible:underline"
                    >
                      {col.header}
                      <SortIcon field={col.key} sortKey={sortKey} sortDir={sortDir} />
                    </button>
                  ) : (
                    <span className="inline-flex items-center gap-1">{col.header}</span>
                  )}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>{body}</TableBody>
          {footer && <TableFooter>{footer}</TableFooter>}
        </Table>
      </div>
    );
  }

  if (loading) {
    return (
      <div aria-busy="true" aria-label="Loading">
        {renderShell(
          Array.from({ length: loadingRows }).map((_, i) => (
            <TableRow key={i}>
              {expandable && <TableCell className="w-8" />}
              {columns.map((col, ci) => (
                <TableCell
                  key={col.key}
                  className={cn(DENSITY_CELL[density], colClasses(col, ci === 0))}
                >
                  <Skeleton
                    className={cn('h-4 max-w-full', col.numeric ? 'ml-auto w-16' : 'w-24')}
                  />
                </TableCell>
              ))}
            </TableRow>
          )),
        )}
      </div>
    );
  }

  if (rows.length === 0 && empty) {
    return (
      <EmptyState
        icon={empty.icon}
        title={empty.title}
        description={empty.description}
        action={empty.action}
      />
    );
  }

  const bodyRows = sortedRows.map((row, ri) => {
    const key = rowKey(row);
    const isExpanded = expandedKey === key;
    const clickable = expandable || !!onRowClick;
    const handleActivate = () => {
      if (expandable) setExpandedKey(isExpanded ? null : key);
      onRowClick?.(row);
    };
    return (
      <React.Fragment key={key}>
        <TableRow
          className={cn(
            clickable && 'cursor-pointer focus-visible:bg-muted/50 focus-visible:outline-none',
          )}
          onClick={clickable ? handleActivate : undefined}
          tabIndex={clickable ? 0 : undefined}
          onKeyDown={
            clickable
              ? (e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleActivate();
                  }
                }
              : undefined
          }
        >
          {expandable && (
            <TableCell className={cn('w-8 pr-0', DENSITY_CELL[density])}>
              <button
                type="button"
                aria-expanded={isExpanded}
                aria-label={isExpanded ? 'Collapse details' : 'Expand details'}
                className="flex items-center text-muted-foreground hover:text-foreground"
                onClick={(e) => {
                  e.stopPropagation();
                  setExpandedKey(isExpanded ? null : key);
                }}
              >
                {isExpanded ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
              </button>
            </TableCell>
          )}
          {columns.map((col, ci) => (
            <TableCell
              key={col.key}
              className={cn(
                DENSITY_CELL[density],
                col.numeric && 'font-mono tabular-nums',
                colClasses(col, ci === 0),
                col.cellClassName,
              )}
            >
              {col.cell(row, ri)}
            </TableCell>
          ))}
        </TableRow>
        {isExpanded && renderExpanded && (
          <TableRow className="bg-muted/30 even:bg-muted/30 hover:bg-muted/30">
            <TableCell
              colSpan={columns.length + 1}
              className={cn(DENSITY_CELL[density], 'whitespace-normal')}
            >
              {renderExpanded(row)}
            </TableCell>
          </TableRow>
        )}
      </React.Fragment>
    );
  });

  if (isCards) {
    return (
      <>
        <div className="space-y-2 sm:hidden">
          {sortedRows.map((row, ri) => (
            <div key={rowKey(row)} className="rounded-md border border-border bg-card p-3">
              {renderCard ? (
                renderCard(row)
              ) : (
                <dl className="space-y-1">
                  {columns.map((col) => (
                    <div key={col.key} className="flex items-baseline justify-between gap-3">
                      <dt className="text-xs text-muted-foreground">{col.header}</dt>
                      <dd className={cn('text-sm', col.numeric && 'font-mono tabular-nums')}>
                        {col.cell(row, ri)}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
          ))}
        </div>
        <div className="hidden sm:block">{renderShell(bodyRows)}</div>
      </>
    );
  }

  return renderShell(bodyRows);
}
