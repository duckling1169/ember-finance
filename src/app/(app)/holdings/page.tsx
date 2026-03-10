'use client';

import { useState, useMemo } from 'react';
import {
  devBypass,
  mockHoldings,
  mockTaxLots,
  mockAccounts,
  type MockTaxLot,
} from '@/lib/mock-data';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import {
  IconChartLine,
  IconArrowUpRight,
  IconArrowDownRight,
  IconArrowsSort,
  IconSortAscending,
  IconSortDescending,
  IconChevronRight,
  IconChevronDown,
  IconCheck,
} from '@tabler/icons-react';

const INVESTMENT_TYPES = new Set(['brokerage', 'retirement', 'hsa']);

const investmentAccounts = mockAccounts.filter(
  (a) => INVESTMENT_TYPES.has(a.account_type) && a.is_active,
);

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}

function GainCell({ value }: { value: number }) {
  const color = value > 0 ? 'text-gain' : value < 0 ? 'text-loss' : 'text-muted-foreground';
  const prefix = value > 0 ? '+' : '';
  return (
    <span className={`font-mono tabular-nums ${color}`}>
      {prefix}
      {fmt(value)}
    </span>
  );
}

function PctCell({ value }: { value: number }) {
  if (value === 0)
    return <span className="font-mono tabular-nums text-muted-foreground">&mdash;</span>;
  const color = value > 0 ? 'text-gain' : 'text-loss';
  const prefix = value > 0 ? '+' : '';
  const Icon = value > 0 ? IconArrowUpRight : IconArrowDownRight;
  return (
    <span className={`inline-flex items-center gap-1 font-mono tabular-nums ${color}`}>
      <Icon size={14} />
      {prefix}
      {value.toFixed(1)}%
    </span>
  );
}

// Aggregated holding row (may combine multiple accounts)
interface AggregatedHolding {
  symbol: string;
  name: string;
  shares: number;
  price: number;
  value: number;
  cost_basis: number;
  gain: number;
  gain_pct: number;
  account_ids: string[];
  lots: MockTaxLot[];
}

type SortKey = 'symbol' | 'name' | 'shares' | 'price' | 'value' | 'gain' | 'gain_pct';
type SortDir = 'asc' | 'desc';

function SortIcon({
  field,
  sortKey,
  sortDir,
}: {
  field: SortKey;
  sortKey: SortKey | null;
  sortDir: SortDir;
}) {
  if (sortKey !== field) return <IconArrowsSort size={14} className="text-muted-foreground/50" />;
  return sortDir === 'asc' ? <IconSortAscending size={14} /> : <IconSortDescending size={14} />;
}

export default function HoldingsPage() {
  const [selectedAccountIds, setSelectedAccountIds] = useState<Set<string>>(
    () => new Set(investmentAccounts.map((a) => a.id)),
  );
  const [sortKey, setSortKey] = useState<SortKey | null>('value');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [expandedSymbol, setExpandedSymbol] = useState<string | null>(null);
  const [sheetSymbol, setSheetSymbol] = useState<string | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);

  // Aggregate holdings by symbol across selected accounts
  const holdings = useMemo(() => {
    const filtered = mockHoldings.filter((h) => selectedAccountIds.has(h.account_id));
    const bySymbol = new Map<string, AggregatedHolding>();

    for (const h of filtered) {
      const existing = bySymbol.get(h.symbol);
      const lots = mockTaxLots.filter(
        (l) => l.symbol === h.symbol && selectedAccountIds.has(l.account_id),
      );
      if (existing) {
        existing.shares += h.shares;
        existing.value += h.value;
        existing.cost_basis += h.cost_basis;
        existing.gain += h.gain;
        if (!existing.account_ids.includes(h.account_id)) {
          existing.account_ids.push(h.account_id);
        }
        existing.lots = lots;
      } else {
        bySymbol.set(h.symbol, {
          symbol: h.symbol,
          name: h.name,
          shares: h.shares,
          price: h.price,
          value: h.value,
          cost_basis: h.cost_basis,
          gain: h.gain,
          gain_pct: 0,
          account_ids: [h.account_id],
          lots,
        });
      }
    }

    // Recompute gain_pct from totals
    for (const h of bySymbol.values()) {
      h.gain_pct = h.cost_basis ? (h.gain / h.cost_basis) * 100 : 0;
    }

    const arr = Array.from(bySymbol.values());
    if (sortKey) {
      arr.sort((a, b) => {
        const aVal = a[sortKey];
        const bVal = b[sortKey];
        if (typeof aVal === 'string' && typeof bVal === 'string') {
          return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
        }
        return sortDir === 'asc' ? Number(aVal) - Number(bVal) : Number(bVal) - Number(aVal);
      });
    }
    return arr;
  }, [selectedAccountIds, sortKey, sortDir]);

  const totalValue = holdings.reduce((s, h) => s + h.value, 0);
  const totalCost = holdings.reduce((s, h) => s + h.cost_basis, 0);
  const totalGain = holdings.reduce((s, h) => s + h.gain, 0);
  const totalGainPct = totalCost ? (totalGain / totalCost) * 100 : 0;

  const sheetHolding = sheetSymbol ? holdings.find((h) => h.symbol === sheetSymbol) : null;

  if (!devBypass) {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold">Holdings</h1>
        <Card>
          <CardContent>
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <IconChartLine size={32} className="text-muted-foreground" stroke={1.5} />
              <p className="text-sm text-muted-foreground">
                Per-account holdings, tax lots, and cost basis detail coming soon.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'symbol' || key === 'name' ? 'asc' : 'desc');
    }
  }

  function toggleAccount(id: string) {
    setSelectedAccountIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        if (next.size > 1) next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleAll() {
    if (selectedAccountIds.size === investmentAccounts.length) return;
    setSelectedAccountIds(new Set(investmentAccounts.map((a) => a.id)));
  }

  function accountName(id: string) {
    return mockAccounts.find((a) => a.id === id)?.name || id;
  }

  function accountTaxBucket(id: string) {
    const a = mockAccounts.find((a) => a.id === id);
    return (a?.meta?.tax_bucket as string) || 'taxable';
  }

  const columns: { key: SortKey; label: string; align?: 'right' }[] = [
    { key: 'symbol', label: 'Symbol' },
    { key: 'name', label: 'Name' },
    { key: 'shares', label: 'Shares', align: 'right' },
    { key: 'price', label: 'Price', align: 'right' },
    { key: 'value', label: 'Value', align: 'right' },
    { key: 'gain', label: 'Gain/Loss', align: 'right' },
    { key: 'gain_pct', label: '%', align: 'right' },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Holdings</h1>

        {/* Account filter */}
        <div className="relative">
          <button
            onClick={() => setFilterOpen((p) => !p)}
            className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          >
            {selectedAccountIds.size === investmentAccounts.length
              ? 'All accounts'
              : `${selectedAccountIds.size} account${selectedAccountIds.size !== 1 ? 's' : ''}`}
            <IconChevronDown size={14} />
          </button>

          {filterOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setFilterOpen(false)} />
              <div className="absolute right-0 top-full mt-1 z-50 w-64 rounded-md border border-border bg-popover shadow-md py-1">
                <button
                  onClick={toggleAll}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted/50 transition-colors"
                >
                  <span
                    className={`h-4 w-4 rounded border flex items-center justify-center ${selectedAccountIds.size === investmentAccounts.length ? 'bg-primary border-primary' : 'border-border'}`}
                  >
                    {selectedAccountIds.size === investmentAccounts.length && (
                      <IconCheck size={12} className="text-primary-foreground" />
                    )}
                  </span>
                  <span className="font-medium">All accounts</span>
                </button>
                <div className="h-px bg-border mx-2 my-1" />
                {investmentAccounts.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => toggleAccount(a.id)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted/50 transition-colors"
                  >
                    <span
                      className={`h-4 w-4 rounded border flex items-center justify-center ${selectedAccountIds.has(a.id) ? 'bg-primary border-primary' : 'border-border'}`}
                    >
                      {selectedAccountIds.has(a.id) && (
                        <IconCheck size={12} className="text-primary-foreground" />
                      )}
                    </span>
                    <span className="flex-1 text-left">
                      <span className="font-medium">{a.name}</span>
                      <span className="text-muted-foreground ml-1.5 text-xs">{a.institution}</span>
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Summary */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-5">
            <p className="text-sm text-muted-foreground">Total Value</p>
            <p className="mt-1 text-xl font-semibold font-mono tabular-nums">{fmt(totalValue)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-sm text-muted-foreground">Cost Basis</p>
            <p className="mt-1 text-xl font-semibold font-mono tabular-nums">{fmt(totalCost)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-sm text-muted-foreground">Unrealized Gain/Loss</p>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-xl font-semibold">
                <GainCell value={totalGain} />
              </span>
              <PctCell value={totalGainPct} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Allocation bar */}
      {holdings.length > 0 && (
        <Card>
          <CardContent className="pt-5">
            <p className="text-sm text-muted-foreground mb-3">Allocation</p>
            <div className="flex gap-0.5 h-4 rounded-full overflow-hidden">
              {holdings.map((h, i) => (
                <div
                  key={h.symbol}
                  style={{
                    width: `${(h.value / totalValue) * 100}%`,
                    backgroundColor: `var(--chart-${(i % 14) + 1})`,
                  }}
                />
              ))}
            </div>
            <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {holdings.map((h, i) => (
                <span key={h.symbol} className="inline-flex items-center gap-1.5">
                  <span
                    className="h-2 w-2 rounded-sm"
                    style={{ backgroundColor: `var(--chart-${(i % 14) + 1})` }}
                  />
                  <span className="font-medium text-foreground">{h.symbol}</span>
                  {((h.value / totalValue) * 100).toFixed(1)}%
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Holdings table */}
      <Card>
        <CardContent className="pt-5">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8" />
                {columns.map((col) => (
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
              </TableRow>
            </TableHeader>
            <TableBody>
              {holdings.map((h) => {
                const isExpanded = expandedSymbol === h.symbol;
                return (
                  <HoldingRow
                    key={h.symbol}
                    holding={h}
                    isExpanded={isExpanded}
                    onToggleExpand={() => setExpandedSymbol(isExpanded ? null : h.symbol)}
                    onOpenSheet={() => setSheetSymbol(h.symbol)}
                    accountName={accountName}
                  />
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Detail sidebar */}
      <Sheet open={!!sheetHolding} onOpenChange={(open) => !open && setSheetSymbol(null)}>
        <SheetContent side="right" className="sm:max-w-md overflow-y-auto">
          {sheetHolding && (
            <LotDetailPanel
              holding={sheetHolding}
              accountName={accountName}
              accountTaxBucket={accountTaxBucket}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

// ── Holding Row with inline lot expansion ──

function HoldingRow({
  holding,
  isExpanded,
  onToggleExpand,
  onOpenSheet,
  accountName,
}: {
  holding: AggregatedHolding;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onOpenSheet: () => void;
  accountName: (id: string) => string;
}) {
  const h = holding;
  const Chevron = isExpanded ? IconChevronDown : IconChevronRight;

  return (
    <>
      <TableRow className="cursor-pointer hover:bg-muted/50" onClick={onToggleExpand}>
        <TableCell className="w-8 pr-0">
          <Chevron size={14} className="text-muted-foreground" />
        </TableCell>
        <TableCell className="font-medium font-mono">{h.symbol}</TableCell>
        <TableCell className="text-muted-foreground">{h.name}</TableCell>
        <TableCell className="text-right font-mono tabular-nums">{h.shares}</TableCell>
        <TableCell className="text-right font-mono tabular-nums">{fmt(h.price)}</TableCell>
        <TableCell className="text-right font-mono tabular-nums">{fmt(h.value)}</TableCell>
        <TableCell className="text-right">
          <GainCell value={h.gain} />
        </TableCell>
        <TableCell className="text-right">
          <PctCell value={h.gain_pct} />
        </TableCell>
      </TableRow>

      {isExpanded && (
        <>
          {/* Inline lot summary */}
          {h.lots.map((lot) => (
            <TableRow key={lot.id} className="bg-muted/30">
              <TableCell />
              <TableCell className="text-xs text-muted-foreground pl-6">
                {accountName(lot.account_id)}
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {lot.acquired_date}
                <span
                  className={`ml-1.5 px-1 py-0.5 rounded text-[10px] font-medium ${lot.holding_period === 'long_term' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}
                >
                  {lot.holding_period === 'long_term' ? 'LT' : 'ST'}
                </span>
              </TableCell>
              <TableCell className="text-right text-xs font-mono tabular-nums text-muted-foreground">
                {lot.quantity}
              </TableCell>
              <TableCell className="text-right text-xs font-mono tabular-nums text-muted-foreground">
                {fmt(lot.cost_basis_per_share)}
              </TableCell>
              <TableCell className="text-right text-xs font-mono tabular-nums text-muted-foreground">
                {fmt(lot.live_market_value)}
              </TableCell>
              <TableCell className="text-right text-xs">
                <GainCell value={lot.unrealized_gain_loss} />
              </TableCell>
              <TableCell />
            </TableRow>
          ))}
          {/* Link to open sidebar */}
          <TableRow className="bg-muted/30">
            <TableCell />
            <TableCell colSpan={7}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenSheet();
                }}
                className="text-xs text-primary hover:underline"
              >
                View full detail &rarr;
              </button>
            </TableCell>
          </TableRow>
        </>
      )}
    </>
  );
}

// ── Sidebar detail panel ──

function LotDetailPanel({
  holding,
  accountName,
  accountTaxBucket,
}: {
  holding: AggregatedHolding;
  accountName: (id: string) => string;
  accountTaxBucket: (id: string) => string;
}) {
  const h = holding;
  const longTermLots = h.lots.filter((l) => l.holding_period === 'long_term');
  const shortTermLots = h.lots.filter((l) => l.holding_period === 'short_term');
  const ltGain = longTermLots.reduce((s, l) => s + l.unrealized_gain_loss, 0);
  const stGain = shortTermLots.reduce((s, l) => s + l.unrealized_gain_loss, 0);

  // Group lots by account
  const byAccount = new Map<string, MockTaxLot[]>();
  for (const lot of h.lots) {
    if (!byAccount.has(lot.account_id)) byAccount.set(lot.account_id, []);
    byAccount.get(lot.account_id)!.push(lot);
  }

  const TAX_BUCKET_LABELS: Record<string, string> = {
    traditional: 'Traditional (pre-tax)',
    roth: 'Roth (tax-free)',
    taxable: 'Taxable',
    none: 'N/A',
  };

  return (
    <div className="space-y-3">
      <SheetHeader className="px-0 pt-2">
        <SheetTitle>{h.symbol}</SheetTitle>
        <SheetDescription>{h.name}</SheetDescription>
      </SheetHeader>

      {/* Position summary */}
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-muted-foreground">Shares</p>
          <p className="font-mono tabular-nums font-medium">{h.shares}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Price</p>
          <p className="font-mono tabular-nums font-medium">{fmt(h.price)}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Market Value</p>
          <p className="font-mono tabular-nums font-medium">{fmt(h.value)}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Cost Basis</p>
          <p className="font-mono tabular-nums font-medium">{fmt(h.cost_basis)}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Unrealized Gain/Loss</p>
          <GainCell value={h.gain} />
        </div>
        <div>
          <p className="text-muted-foreground">Return</p>
          <PctCell value={h.gain_pct} />
        </div>
      </div>

      {/* Tax summary */}
      <div>
        <p className="text-sm font-medium mb-3">Tax Summary</p>
        <div className="rounded-md border border-border divide-y divide-border text-sm">
          <div className="flex items-center justify-between px-3 py-2">
            <span className="text-muted-foreground">
              Long-term ({longTermLots.length} lot{longTermLots.length !== 1 ? 's' : ''})
            </span>
            <GainCell value={ltGain} />
          </div>
          <div className="flex items-center justify-between px-3 py-2">
            <span className="text-muted-foreground">
              Short-term ({shortTermLots.length} lot{shortTermLots.length !== 1 ? 's' : ''})
            </span>
            <GainCell value={stGain} />
          </div>
          <div className="flex items-center justify-between px-3 py-2 font-medium">
            <span>Total</span>
            <GainCell value={h.gain} />
          </div>
        </div>
      </div>

      {/* Per-account breakdown */}
      <div>
        <p className="text-sm font-medium mb-3">Accounts</p>
        <div className="space-y-4">
          {Array.from(byAccount.entries()).map(([accountId, lots]) => {
            const acctValue = lots.reduce((s, l) => s + l.live_market_value, 0);
            const acctCost = lots.reduce((s, l) => s + l.cost_basis_total, 0);
            const acctGain = lots.reduce((s, l) => s + l.unrealized_gain_loss, 0);
            const bucket = accountTaxBucket(accountId);

            return (
              <div key={accountId} className="rounded-md border border-border">
                <div className="px-3 py-2 border-b border-border bg-muted/30">
                  <p className="text-sm font-medium">{accountName(accountId)}</p>
                  <p className="text-xs text-muted-foreground">
                    {TAX_BUCKET_LABELS[bucket] || bucket}
                  </p>
                </div>
                <div className="divide-y divide-border">
                  {lots.map((lot) => (
                    <div key={lot.id} className="px-3 py-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">
                          {lot.acquired_date}
                          <span
                            className={`ml-1.5 px-1 py-0.5 rounded text-[10px] font-medium ${lot.holding_period === 'long_term' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}
                          >
                            {lot.holding_period === 'long_term' ? 'Long' : 'Short'}
                          </span>
                        </span>
                        <span className="font-mono tabular-nums">{lot.quantity} shares</span>
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-muted-foreground">
                          Basis:{' '}
                          <span className="font-mono tabular-nums">
                            {fmt(lot.cost_basis_per_share)}
                          </span>
                          /sh
                        </span>
                        <GainCell value={lot.unrealized_gain_loss} />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="px-3 py-2 border-t border-border bg-muted/30 flex items-center justify-between text-xs font-medium">
                  <span>
                    {fmt(acctValue)} / {fmt(acctCost)} basis
                  </span>
                  <GainCell value={acctGain} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Lot source info */}
      <div>
        <p className="text-sm font-medium mb-2">Lot Sources</p>
        <div className="text-xs text-muted-foreground space-y-1">
          {h.lots.map((lot) => (
            <div key={lot.id} className="flex items-center justify-between">
              <span>
                {lot.acquired_date} &middot; {lot.quantity} sh
              </span>
              <span className="px-1.5 py-0.5 rounded bg-muted text-[10px] font-medium">
                {lot.source.replace('_', ' ')}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
