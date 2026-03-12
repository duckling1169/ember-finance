'use client';

import { useState, useMemo } from 'react';
import {
  devBypass,
  mockHoldings,
  mockTaxLots,
  mockAccounts,
  type MockTaxLot,
} from '@/lib/mock-data';
import type { HouseholdHoldingsResponse } from '@shared/types';
import { useHouseholdHoldings, useAccounts } from '@/lib/swr';
import { Card, CardContent } from '@/components/ui/card';
import { Alert } from '@/components/ui/alert';
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
import { IconChevronRight, IconChevronDown, IconCheck } from '@tabler/icons-react';
import { INVESTMENT_ACCOUNT_TYPES } from '@shared/types';
import { fmt } from '@/lib/formatters';
import { TAX_TREATMENT_LABELS } from '@/lib/constants';
import { GainCell, PctCell } from '@/components/common/financial-cells';
import { SortIcon, type SortDir } from '@/components/common/sort-icon';

const INVESTMENT_TYPES: Set<string> = new Set(INVESTMENT_ACCOUNT_TYPES);

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
  lots: LotView[];
}

interface LotView {
  id: string;
  account_id: string;
  symbol: string;
  acquired_date: string;
  quantity: number;
  cost_basis_per_share: number;
  cost_basis_total: number;
  live_market_value: number;
  unrealized_gain_loss: number;
  holding_period: 'short_term' | 'long_term';
  source: string;
}

interface AccountInfo {
  id: string;
  name: string;
  institution: string | null;
  account_type: string;
  tax_treatment: string;
  is_active: boolean;
}

type SortKey = 'symbol' | 'name' | 'shares' | 'price' | 'value' | 'gain' | 'gain_pct';

function computeHoldingPeriod(acquiredDate: string): 'short_term' | 'long_term' {
  const acquired = new Date(acquiredDate);
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  return acquired <= oneYearAgo ? 'long_term' : 'short_term';
}

export default function HoldingsPage() {
  const { data: apiAccounts, isLoading: acctsLoading, error: acctsError } = useAccounts();
  const {
    data: apiHoldings,
    isLoading: holdingsLoading,
    error: holdingsError,
  } = useHouseholdHoldings();

  // Build account list from either mock or API data
  const accountList: AccountInfo[] = useMemo(() => {
    if (devBypass) {
      return mockAccounts
        .filter((a) => INVESTMENT_TYPES.has(a.account_type) && a.is_active)
        .map((a) => ({
          id: a.id,
          name: a.name,
          institution: a.institution,
          account_type: a.account_type,
          tax_treatment: a.tax_treatment || 'none',
          is_active: a.is_active,
        }));
    }
    if (!apiAccounts) return [];
    return apiAccounts
      .filter((a) => INVESTMENT_TYPES.has(a.account_type) && a.is_active !== false)
      .map((a) => ({
        id: a.id,
        name: a.name,
        institution: a.institution,
        account_type: a.account_type,
        tax_treatment: a.tax_treatment || (a.meta?.tax_treatment as string) || 'taxable',
        is_active: true,
      }));
  }, [apiAccounts]);

  const [selectedAccountIds, setSelectedAccountIds] = useState<Set<string> | null>(null);
  // Initialize selectedAccountIds from accountList once available
  const effectiveSelectedIds = selectedAccountIds ?? new Set(accountList.map((a) => a.id));

  const [sortKey, setSortKey] = useState<SortKey | null>('value');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [expandedSymbol, setExpandedSymbol] = useState<string | null>(null);
  const [sheetSymbol, setSheetSymbol] = useState<string | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);

  // Build aggregated holdings from either mock or API data
  const holdings = useMemo(() => {
    if (devBypass) {
      return buildMockHoldings(effectiveSelectedIds, sortKey, sortDir);
    }
    if (!apiHoldings) return [];
    return buildApiHoldings(apiHoldings, effectiveSelectedIds, sortKey, sortDir);
  }, [apiHoldings, effectiveSelectedIds, sortKey, sortDir]);

  const loading = !devBypass && (acctsLoading || holdingsLoading);

  const totalValue = holdings.reduce((s, h) => s + h.value, 0);
  const totalCost = holdings.reduce((s, h) => s + h.cost_basis, 0);
  const totalGain = holdings.reduce((s, h) => s + h.gain, 0);
  const totalGainPct = totalCost ? (totalGain / totalCost) * 100 : 0;

  const sheetHolding = sheetSymbol ? holdings.find((h) => h.symbol === sheetSymbol) : null;

  const fetchError = !devBypass && (acctsError || holdingsError);

  if (loading) {
    return <div className="py-10 text-center text-muted-foreground">Loading...</div>;
  }

  if (fetchError) {
    const msg = (acctsError || holdingsError)?.message || 'Please try again later.';
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold">Holdings</h1>
        <Alert variant="error">Failed to load holdings data. {msg}</Alert>
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
    if (effectiveSelectedIds.size === accountList.length) return;
    setSelectedAccountIds(new Set(accountList.map((a) => a.id)));
  }

  function accountName(id: string) {
    return accountList.find((a) => a.id === id)?.name || id;
  }

  function accountTaxTreatment(id: string) {
    return accountList.find((a) => a.id === id)?.tax_treatment || 'taxable';
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
            {effectiveSelectedIds.size === accountList.length
              ? 'All accounts'
              : `${effectiveSelectedIds.size} account${effectiveSelectedIds.size !== 1 ? 's' : ''}`}
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
      <div className="grid gap-3 sm:grid-cols-3">
        <Card size="sm">
          <CardContent>
            <p className="text-sm text-muted-foreground">Total Value</p>
            <p className="mt-1 text-xl font-semibold font-mono tabular-nums">{fmt(totalValue)}</p>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent>
            <p className="text-sm text-muted-foreground">Cost Basis</p>
            <p className="mt-1 text-xl font-semibold font-mono tabular-nums">{fmt(totalCost)}</p>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent>
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
        <Card size="sm">
          <CardContent>
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
                  <span className="ml-auto font-mono tabular-nums">
                    {((h.value / totalValue) * 100).toFixed(0)}%
                  </span>
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Holdings table */}
      <Card size="sm">
        <CardContent>
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
              accountTaxTreatment={accountTaxTreatment}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

// -- Data builders --

function buildMockHoldings(
  selectedAccountIds: Set<string>,
  sortKey: SortKey | null,
  sortDir: SortDir,
): AggregatedHolding[] {
  const filtered = mockHoldings.filter((h) => selectedAccountIds.has(h.account_id));
  const bySymbol = new Map<string, AggregatedHolding>();

  for (const h of filtered) {
    const existing = bySymbol.get(h.symbol);
    const lots: LotView[] = mockTaxLots
      .filter((l) => l.symbol === h.symbol && selectedAccountIds.has(l.account_id))
      .map((l) => ({
        id: l.id,
        account_id: l.account_id,
        symbol: l.symbol,
        acquired_date: l.acquired_date,
        quantity: l.quantity,
        cost_basis_per_share: l.cost_basis_per_share,
        cost_basis_total: l.cost_basis_total,
        live_market_value: l.live_market_value,
        unrealized_gain_loss: l.unrealized_gain_loss,
        holding_period: l.holding_period,
        source: l.source,
      }));
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

  for (const h of bySymbol.values()) {
    h.gain_pct = h.cost_basis ? (h.gain / h.cost_basis) * 100 : 0;
  }

  return sortHoldings(Array.from(bySymbol.values()), sortKey, sortDir);
}

function buildApiHoldings(
  data: HouseholdHoldingsResponse,
  selectedAccountIds: Set<string>,
  sortKey: SortKey | null,
  sortDir: SortDir,
): AggregatedHolding[] {
  const { summary, positions, lots: rawLots } = data;

  // Build a price lookup from summary
  const priceBySymbol = new Map<string, number>();
  for (const s of summary) {
    priceBySymbol.set(s.symbol, s.live_price ?? 0);
  }

  // Build lots with computed fields
  const allLots: LotView[] = rawLots
    .filter((l) => !l.is_closed)
    .map((l) => {
      const livePrice = priceBySymbol.get(l.symbol) ?? 0;
      const liveMarketValue = l.quantity * livePrice;
      return {
        id: l.id,
        account_id: l.account_id,
        symbol: l.symbol,
        acquired_date: l.acquired_date,
        quantity: l.quantity,
        cost_basis_per_share: l.cost_basis_per_share,
        cost_basis_total: l.cost_basis_total,
        live_market_value: liveMarketValue,
        unrealized_gain_loss: liveMarketValue - l.cost_basis_total,
        holding_period: computeHoldingPeriod(l.acquired_date),
        source: l.source || 'unknown',
      };
    });

  // Build position account mapping
  const accountsBySymbol = new Map<string, string[]>();
  for (const p of positions) {
    if (!selectedAccountIds.has(p.account_id)) continue;
    if (!accountsBySymbol.has(p.symbol)) accountsBySymbol.set(p.symbol, []);
    const arr = accountsBySymbol.get(p.symbol)!;
    if (!arr.includes(p.account_id)) arr.push(p.account_id);
  }

  const holdings: AggregatedHolding[] = [];
  for (const s of summary) {
    const accountIds = accountsBySymbol.get(s.symbol) || [];
    if (accountIds.length === 0) continue;

    // Filter positions by selected accounts to compute filtered totals
    const filteredPositions = positions.filter(
      (p) => p.symbol === s.symbol && selectedAccountIds.has(p.account_id),
    );

    const shares = filteredPositions.reduce((sum, p) => sum + (p.quantity ?? 0), 0);
    const value = filteredPositions.reduce(
      (sum, p) => sum + (p.live_market_value ?? p.snapshot_market_value ?? 0),
      0,
    );
    const costBasis = filteredPositions.reduce((sum, p) => sum + (p.cost_basis ?? 0), 0);
    const gain = value - costBasis;
    const price = s.live_price ?? 0;

    const lots = allLots.filter(
      (l) => l.symbol === s.symbol && selectedAccountIds.has(l.account_id),
    );

    holdings.push({
      symbol: s.symbol,
      name: s.name || s.symbol,
      shares,
      price,
      value,
      cost_basis: costBasis,
      gain,
      gain_pct: costBasis ? (gain / costBasis) * 100 : 0,
      account_ids: accountIds,
      lots,
    });
  }

  return sortHoldings(holdings, sortKey, sortDir);
}

function sortHoldings(
  arr: AggregatedHolding[],
  sortKey: SortKey | null,
  sortDir: SortDir,
): AggregatedHolding[] {
  if (!sortKey) return arr;
  return arr.sort((a, b) => {
    const aVal = a[sortKey];
    const bVal = b[sortKey];
    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    }
    return sortDir === 'asc' ? Number(aVal) - Number(bVal) : Number(bVal) - Number(aVal);
  });
}

// -- Holding Row with inline lot expansion --

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
      <TableRow className="cursor-pointer hover:bg-primary/5" onClick={onToggleExpand}>
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
                  className={`ml-1.5 px-1 py-0.5 rounded text-xs font-medium ${lot.holding_period === 'long_term' ? 'bg-primary/10 text-primary' : 'bg-warning/15 text-warning'}`}
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

// -- Sidebar detail panel --

function LotDetailPanel({
  holding,
  accountName,
  accountTaxTreatment,
}: {
  holding: AggregatedHolding;
  accountName: (id: string) => string;
  accountTaxTreatment: (id: string) => string;
}) {
  const h = holding;
  const longTermLots = h.lots.filter((l) => l.holding_period === 'long_term');
  const shortTermLots = h.lots.filter((l) => l.holding_period === 'short_term');
  const ltGain = longTermLots.reduce((s, l) => s + l.unrealized_gain_loss, 0);
  const stGain = shortTermLots.reduce((s, l) => s + l.unrealized_gain_loss, 0);

  // Group lots by account
  const byAccount = new Map<string, LotView[]>();
  for (const lot of h.lots) {
    if (!byAccount.has(lot.account_id)) byAccount.set(lot.account_id, []);
    byAccount.get(lot.account_id)!.push(lot);
  }

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
            const bucket = accountTaxTreatment(accountId);

            return (
              <div key={accountId} className="rounded-md border border-border">
                <div className="px-3 py-2 border-b border-border bg-muted/30">
                  <p className="text-sm font-medium">{accountName(accountId)}</p>
                  <p className="text-xs text-muted-foreground">
                    {TAX_TREATMENT_LABELS[bucket] || bucket}
                  </p>
                </div>
                <div className="divide-y divide-border">
                  {lots.map((lot) => (
                    <div key={lot.id} className="px-3 py-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">
                          {lot.acquired_date}
                          <span
                            className={`ml-1.5 px-1 py-0.5 rounded text-xs font-medium ${lot.holding_period === 'long_term' ? 'bg-primary/10 text-primary' : 'bg-warning/15 text-warning'}`}
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
              <span className="px-1.5 py-0.5 rounded bg-muted text-xs font-medium">
                {lot.source.replace('_', ' ')}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
