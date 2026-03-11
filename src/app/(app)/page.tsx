'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  useHousehold,
  useAccounts,
  useHouseholdHoldings,
  useNetWorthHistory,
  useInvestmentHistory,
} from '@/lib/swr';
import {
  devBypass,
  enrichAccounts,
  mockNetWorthHistory,
  mockPortfolioHistory,
  mockHoldings,
} from '@/lib/mock-data';
import type { EnrichedAccount } from '@shared/types';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { AreaChart, DonutChart, CHART_COLORS } from '@/components/charts';
import { fmt } from '@/lib/formatters';
import { TAX_BUCKET_LABELS } from '@/lib/constants';
import { ChangeIndicator } from '@/components/common/financial-cells';

type RangeKey = '30D' | '90D' | 'YTD' | '1Y' | 'Custom';

const RANGE_OPTIONS: { key: RangeKey; label: string }[] = [
  { key: '30D', label: '30D' },
  { key: '90D', label: '90D' },
  { key: 'YTD', label: 'YTD' },
  { key: '1Y', label: '1Y' },
  { key: 'Custom', label: 'Custom' },
];

function filterByRange(
  data: { date: string; value: number }[],
  range: RangeKey,
  customStart?: string,
  customEnd?: string,
): { date: string; value: number }[] {
  if (data.length === 0) return data;
  const today = new Date(data[data.length - 1].date);
  let cutoff: Date;
  switch (range) {
    case '30D':
      cutoff = new Date(today);
      cutoff.setDate(cutoff.getDate() - 30);
      break;
    case '90D':
      cutoff = new Date(today);
      cutoff.setDate(cutoff.getDate() - 90);
      break;
    case 'YTD':
      cutoff = new Date(today.getFullYear(), 0, 1);
      break;
    case '1Y':
      cutoff = new Date(today);
      cutoff.setFullYear(cutoff.getFullYear() - 1);
      break;
    case 'Custom': {
      const s = customStart ? new Date(customStart) : new Date(data[0].date);
      const e = customEnd ? new Date(customEnd) : today;
      return data.filter((d) => {
        const dt = new Date(d.date);
        return dt >= s && dt <= e;
      });
    }
  }
  return data.filter((d) => new Date(d.date) >= cutoff);
}

function rangeToFromTo(
  range: RangeKey,
  customStart?: string,
  customEnd?: string,
): { from?: string; to?: string } {
  const today = new Date();
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  switch (range) {
    case '30D': {
      const d = new Date(today);
      d.setDate(d.getDate() - 30);
      return { from: fmt(d) };
    }
    case '90D': {
      const d = new Date(today);
      d.setDate(d.getDate() - 90);
      return { from: fmt(d) };
    }
    case 'YTD':
      return { from: `${today.getFullYear()}-01-01` };
    case '1Y': {
      const d = new Date(today);
      d.setFullYear(d.getFullYear() - 1);
      return { from: fmt(d) };
    }
    case 'Custom':
      return { from: customStart || undefined, to: customEnd || undefined };
  }
}

export default function DashboardPage() {
  const router = useRouter();
  const { data: household, isLoading: hhLoading, error: hhError } = useHousehold();
  const { data: apiAccounts, isLoading: acctsLoading, error: acctsError } = useAccounts();
  const { data: apiHoldings } = useHouseholdHoldings();

  const accounts: EnrichedAccount[] = devBypass ? enrichAccounts() : (apiAccounts ?? []);
  const loading = !devBypass && (hhLoading || acctsLoading);

  const [range, setRange] = useState<RangeKey>('YTD');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const { from, to } = useMemo(
    () => rangeToFromTo(range, customStart, customEnd),
    [range, customStart, customEnd],
  );
  const { data: apiNwHistory } = useNetWorthHistory(from, to);
  const { data: apiInvHistory } = useInvestmentHistory(from, to);

  // Redirect to onboarding if no household
  const needsOnboarding = !devBypass && !hhLoading && !household;
  useEffect(() => {
    if (needsOnboarding) router.replace('/onboarding');
  }, [needsOnboarding, router]);

  const nwData = useMemo(
    () =>
      devBypass
        ? filterByRange(mockNetWorthHistory, range, customStart, customEnd)
        : (apiNwHistory ?? []),
    [range, customStart, customEnd, apiNwHistory],
  );
  const invData = useMemo(
    () =>
      devBypass
        ? filterByRange(mockPortfolioHistory, range, customStart, customEnd)
        : (apiInvHistory ?? []),
    [range, customStart, customEnd, apiInvHistory],
  );
  // Holdings by value (for donut)
  const holdingsByValue = useMemo(() => {
    if (devBypass) return [...mockHoldings].sort((a, b) => b.value - a.value);
    if (!apiHoldings) return [];
    return apiHoldings.summary
      .map((s) => ({
        id: s.symbol,
        symbol: s.symbol,
        name: s.name || s.symbol,
        value: s.total_market_value ?? 0,
      }))
      .filter((h) => h.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [apiHoldings]);

  const fetchError = !devBypass && (hhError || acctsError);

  if (loading || needsOnboarding) {
    return <div className="py-10 text-muted-foreground">Loading...</div>;
  }

  if (fetchError) {
    const msg = (hhError || acctsError)?.message || 'Please try again later.';
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <div className="rounded-md bg-destructive/10 p-4 text-sm text-destructive">
          Failed to load dashboard data. {msg}
        </div>
      </div>
    );
  }

  const netWorth = accounts.reduce((sum, a) => sum + (a.balance ?? 0), 0);
  const nwStart = nwData[0]?.value ?? netWorth;
  const nwChange = nwStart ? ((netWorth - nwStart) / nwStart) * 100 : 0;

  const investmentAccounts = accounts.filter((a) =>
    ['brokerage', 'retirement', 'hsa'].includes(a.account_type),
  );
  const investmentAccountTotal = investmentAccounts.reduce((s, a) => s + (a.balance ?? 0), 0);
  const investmentValue = invData[invData.length - 1]?.value ?? investmentAccountTotal;
  const invStart = invData[0]?.value ?? investmentValue;
  const invChange = invStart ? ((investmentValue - invStart) / invStart) * 100 : 0;

  // Accounts by value (for donut)
  const accountsByValue = [...accounts]
    .filter((a) => a.balance > 0)
    .sort((a, b) => b.balance - a.balance);
  const totalPositive = accountsByValue.reduce((s, a) => s + a.balance, 0);

  // Tax buckets by value
  const bucketTotals = new Map<string, number>();
  for (const a of accounts) {
    if (a.balance <= 0) continue;
    const bucket = a.tax_bucket || 'taxable';
    bucketTotals.set(bucket, (bucketTotals.get(bucket) || 0) + a.balance);
  }
  const taxBuckets = [...bucketTotals.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => ({ name, value }));
  const taxBucketTotal = taxBuckets.reduce((s, b) => s + b.value, 0);

  const holdingsTotal = holdingsByValue.reduce((s, h) => s + h.value, 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <RangeFilter
          value={range}
          onChange={setRange}
          customStart={customStart}
          customEnd={customEnd}
          onCustomStartChange={setCustomStart}
          onCustomEndChange={setCustomEnd}
        />
      </div>

      {/* Row 1: Net worth chart (2/3) + stacked donuts (1/3) */}
      <div className="grid gap-3 lg:grid-cols-3">
        {/* Net worth over time */}
        <Card className="lg:col-span-2 flex flex-col p-2 gap-0">
          <CardContent className="flex flex-col flex-1">
            <div>
              <p className="text-sm text-muted-foreground mb-0.5">Net Worth</p>
              <p className="text-2xl font-semibold font-mono tabular-nums">{fmt(netWorth)}</p>
              <ChangeIndicator value={nwChange} label={range === 'Custom' ? 'period' : range} />
            </div>
            {nwData.length > 0 && <AreaChart data={nwData} className="mt-2 flex-1 min-h-[160px]" />}
          </CardContent>
        </Card>

        {/* Stacked donuts */}
        <div className="flex flex-col gap-3">
          {/* Accounts by value */}
          <Card className="flex-1 flex p-2 gap-0">
            <CardContent className="flex flex-col justify-center flex-1">
              <p className="text-sm text-muted-foreground mb-2">Accounts by Value</p>
              {accountsByValue.length > 0 ? (
                <div className="flex items-center gap-3">
                  <DonutChart
                    segments={accountsByValue.map((a) => ({
                      id: a.id,
                      label: a.name,
                      value: a.balance,
                    }))}
                    total={totalPositive}
                  />
                  <div className="flex flex-col gap-1 text-xs text-muted-foreground min-w-0">
                    {accountsByValue.slice(0, 6).map((a, i) => (
                      <span key={a.id} className="inline-flex items-center gap-1.5 truncate">
                        <span
                          className="h-2 w-2 rounded-sm shrink-0"
                          style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                        />
                        <span className="truncate">{a.name}</span>
                        <span className="ml-auto font-mono tabular-nums shrink-0">
                          {((a.balance / totalPositive) * 100).toFixed(0)}%
                        </span>
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground py-8 text-center">No accounts</p>
              )}
            </CardContent>
          </Card>

          {/* Tax buckets by value */}
          <Card className="flex-1 flex p-2 gap-0">
            <CardContent className="flex flex-col justify-center flex-1">
              <p className="text-sm text-muted-foreground mb-2">Tax Buckets</p>
              {taxBuckets.length > 0 ? (
                <div className="flex items-center gap-3">
                  <DonutChart
                    segments={taxBuckets.map((b) => ({
                      id: b.name,
                      label: TAX_BUCKET_LABELS[b.name] || b.name,
                      value: b.value,
                    }))}
                    total={taxBucketTotal}
                  />
                  <div className="flex flex-col gap-1.5 text-xs text-muted-foreground">
                    {taxBuckets.map((b, i) => (
                      <span key={b.name} className="inline-flex items-center gap-1.5">
                        <span
                          className="h-2 w-2 rounded-sm shrink-0"
                          style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                        />
                        <span>{TAX_BUCKET_LABELS[b.name] || b.name}</span>
                        <span className="ml-auto font-mono tabular-nums">{fmt(b.value)}</span>
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground py-8 text-center">No data</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Row 2: Stacked donuts (1/3) + Investments chart (2/3) */}
      <div className="grid gap-3 lg:grid-cols-3">
        {/* Stacked donuts */}
        <div className="flex flex-col gap-3">
          {/* Holdings by value */}
          <Card className="flex-1 flex p-2 gap-0 overflow-hidden">
            <CardContent className="flex flex-col items-center justify-center flex-1 relative overflow-hidden">
              <p className="text-sm text-muted-foreground mb-2 self-start shrink-0">
                Holdings by Value
              </p>
              {holdingsByValue.length > 0 ? (
                <>
                  <div className="flex items-center gap-3 min-h-0">
                    <DonutChart
                      segments={holdingsByValue.map((h) => ({
                        id: h.id,
                        label: h.symbol,
                        value: h.value,
                      }))}
                      total={holdingsTotal}
                    />
                    <div className="flex flex-col gap-1 text-xs text-muted-foreground min-w-0 overflow-hidden">
                      {holdingsByValue.map((h, i) => (
                        <span key={h.id} className="inline-flex items-center gap-1.5">
                          <span
                            className="h-2 w-2 rounded-sm shrink-0"
                            style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                          />
                          <span className="font-medium text-foreground">{h.symbol}</span>
                          <span className="ml-auto font-mono tabular-nums">
                            {((h.value / holdingsTotal) * 100).toFixed(1)}%
                          </span>
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-card to-transparent pointer-events-none" />
                </>
              ) : (
                <p className="text-sm text-muted-foreground py-8 text-center">No data</p>
              )}
            </CardContent>
          </Card>

          {/* Investments by account */}
          <Card className="flex-1 flex p-2 gap-0">
            <CardContent className="flex flex-col items-center justify-center flex-1">
              <p className="text-sm text-muted-foreground mb-2 self-start">
                Investments by Account
              </p>
              {investmentAccounts.length > 0 ? (
                <div className="flex items-center gap-3">
                  <DonutChart
                    segments={investmentAccounts.map((a) => ({
                      id: a.id,
                      label: a.name,
                      value: a.balance,
                    }))}
                    total={investmentAccountTotal}
                  />
                  <div className="flex flex-col gap-1 text-xs text-muted-foreground min-w-0">
                    {investmentAccounts
                      .sort((a, b) => b.balance - a.balance)
                      .map((a, i) => (
                        <span key={a.id} className="inline-flex items-center gap-1.5 truncate">
                          <span
                            className="h-2 w-2 rounded-sm shrink-0"
                            style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                          />
                          <span className="truncate">{a.name}</span>
                          <span className="ml-auto font-mono tabular-nums shrink-0">
                            {((a.balance / investmentAccountTotal) * 100).toFixed(0)}%
                          </span>
                        </span>
                      ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground py-8 text-center">No data</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Investments over time */}
        <Card className="lg:col-span-2 flex flex-col p-2 gap-0">
          <CardContent className="flex flex-col flex-1">
            <div>
              <p className="text-sm text-muted-foreground mb-0.5">Investments</p>
              <div className="flex items-baseline gap-3">
                <p className="text-xl font-semibold font-mono tabular-nums">
                  {fmt(investmentValue)}
                </p>
                <ChangeIndicator value={invChange} label={range === 'Custom' ? 'period' : range} />
              </div>
            </div>
            {invData.length > 0 && (
              <AreaChart data={invData} className="mt-2 flex-1 min-h-[160px]" />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick links */}
      <div className="flex gap-3 text-sm">
        <Link
          href="/accounts"
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          Manage accounts &rarr;
        </Link>
        <Link
          href="/holdings"
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          View holdings &rarr;
        </Link>
      </div>
    </div>
  );
}

// ── Range filter for line charts ──

function RangeFilter({
  value,
  onChange,
  customStart,
  customEnd,
  onCustomStartChange,
  onCustomEndChange,
}: {
  value: RangeKey;
  onChange: (v: RangeKey) => void;
  customStart: string;
  customEnd: string;
  onCustomStartChange: (v: string) => void;
  onCustomEndChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex gap-0.5 rounded-md bg-muted p-0.5">
        {RANGE_OPTIONS.map((opt) => (
          <button
            key={opt.key}
            onClick={() => onChange(opt.key)}
            className={cn(
              'px-2 py-0.5 text-xs font-medium rounded transition-colors',
              value === opt.key
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
      {value === 'Custom' && (
        <div className="flex items-center gap-1.5 text-xs">
          <input
            type="date"
            value={customStart}
            onChange={(e) => onCustomStartChange(e.target.value)}
            className="rounded border border-border bg-background px-1.5 py-0.5 text-xs text-foreground"
          />
          <span className="text-muted-foreground">–</span>
          <input
            type="date"
            value={customEnd}
            onChange={(e) => onCustomEndChange(e.target.value)}
            className="rounded border border-border bg-background px-1.5 py-0.5 text-xs text-foreground"
          />
        </div>
      )}
    </div>
  );
}
