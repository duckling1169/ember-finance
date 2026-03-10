'use client';

import { useEffect, useCallback, useState, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getHousehold, getAccounts } from '@/lib/api';
import {
  devBypass,
  enrichAccounts,
  mockNetWorthHistory,
  mockPortfolioHistory,
  mockHoldings,
  type EnrichedAccount,
} from '@/lib/mock-data';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import {
  IconArrowUpRight,
  IconArrowDownRight,
  IconClock,
  IconCalendarDollar,
  IconChartDonut,
  IconReceipt,
} from '@tabler/icons-react';

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

const CHART_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
  'var(--chart-6)',
  'var(--chart-7)',
  'var(--chart-8)',
  'var(--chart-9)',
  'var(--chart-10)',
  'var(--chart-11)',
  'var(--chart-12)',
  'var(--chart-13)',
  'var(--chart-14)',
];

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}

function fmtAxisK(n: number) {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  return `$${(n / 1000).toFixed(0)}k`;
}

function ChangeIndicator({ value, label }: { value: number; label: string }) {
  const color = value > 0 ? 'text-gain' : value < 0 ? 'text-loss' : 'text-muted-foreground';
  const prefix = value > 0 ? '+' : '';
  const Icon = value > 0 ? IconArrowUpRight : IconArrowDownRight;
  return (
    <span className={`inline-flex items-center gap-1 text-sm font-mono tabular-nums ${color}`}>
      {value !== 0 && <Icon size={14} />}
      {prefix}
      {value.toFixed(1)}% {label}
    </span>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<EnrichedAccount[]>(devBypass ? enrichAccounts() : []);
  const [loading, setLoading] = useState(!devBypass);
  const [range, setRange] = useState<RangeKey>('YTD');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const loadData = useCallback(async () => {
    if (devBypass) return;
    try {
      const h = (await getHousehold()) as { id: string } | null;
      if (!h) {
        router.replace('/onboarding');
        return;
      }
      const accts = await getAccounts(h.id);
      setAccounts(accts as unknown as EnrichedAccount[]);
    } catch {
      // Not set up
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return <div className="py-10 text-muted-foreground">Loading...</div>;
  }

  const netWorth = accounts.reduce((sum, a) => sum + (a.balance ?? 0), 0);
  const nwData = useMemo(
    () => filterByRange(mockNetWorthHistory, range, customStart, customEnd),
    [range, customStart, customEnd],
  );
  const nwStart = nwData[0]?.value ?? netWorth;
  const nwChange = nwStart ? ((netWorth - nwStart) / nwStart) * 100 : 0;

  const investmentAccounts = accounts.filter((a) =>
    ['brokerage', 'retirement', 'hsa'].includes(a.account_type),
  );
  const investmentAccountTotal = investmentAccounts.reduce((s, a) => s + (a.balance ?? 0), 0);
  const invData = useMemo(
    () => filterByRange(mockPortfolioHistory, range, customStart, customEnd),
    [range, customStart, customEnd],
  );
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

  // Holdings by value (for donut)
  const holdingsByValue = [...mockHoldings].sort((a, b) => b.value - a.value);
  const holdingsTotal = holdingsByValue.reduce((s, h) => s + h.value, 0);

  const TAX_BUCKET_LABELS: Record<string, string> = {
    traditional: 'Tax-deferred',
    roth: 'Tax-free',
    taxable: 'Taxable',
    none: 'Other',
  };

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
            {devBypass && <LineChart data={nwData} className="mt-2 flex-1 min-h-[160px]" />}
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
            {devBypass && <LineChart data={invData} className="mt-2 flex-1 min-h-[160px]" />}
          </CardContent>
        </Card>
      </div>

      {/* Row 3: Placeholder cards for future charts */}
      <div className="grid gap-3 md:grid-cols-2">
        <PlaceholderCard
          icon={IconCalendarDollar}
          title="Salary Deferral"
          description="Contribution allocation across accounts"
        />
        <PlaceholderCard
          icon={IconChartDonut}
          title="Tax Buckets by Inflow"
          description="Yearly contributions by tax treatment"
        />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <PlaceholderCard
          icon={IconClock}
          title="Tax Buckets Over Time"
          description="Projected growth by tax treatment and age"
        />
        <PlaceholderCard
          icon={IconReceipt}
          title="Spending by Category"
          description="Transaction breakdown across accounts"
        />
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

// ── Placeholder card for future charts ──

function PlaceholderCard({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof IconClock;
  title: string;
  description: string;
}) {
  return (
    <Card className="p-2 gap-0">
      <CardContent>
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <Icon size={28} className="text-muted-foreground/40" stroke={1.5} />
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="text-xs text-muted-foreground/60">{description}</p>
        </div>
      </CardContent>
    </Card>
  );
}

// ── SVG Chart Components ──

const AXIS_FONT = 11;
const PAD = { top: 4, right: 28, bottom: 4 + AXIS_FONT + 4, left: 4 + 36 };

const MONTH_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

type TickInterval = 'day' | 'week' | 'biweek' | 'month' | 'quarter' | 'year';

interface Tick {
  index: number;
  label: string;
}

function generateTicks(dates: string[], maxTicks = 6): Tick[] {
  if (dates.length <= 1)
    return dates.map((_, i) => ({ index: i, label: fmtDate(dates[i], 'month') }));

  const first = new Date(dates[0]);
  const last = new Date(dates[dates.length - 1]);
  const spanDays = (last.getTime() - first.getTime()) / (1000 * 60 * 60 * 24);

  let interval: TickInterval;
  if (spanDays <= 14) interval = 'day';
  else if (spanDays <= 45) interval = 'week';
  else if (spanDays <= 90) interval = 'biweek';
  else if (spanDays <= 730) interval = 'month';
  else if (spanDays <= 2190) interval = 'quarter';
  else interval = 'year';

  const intervals: TickInterval[] = ['day', 'week', 'biweek', 'month', 'quarter', 'year'];
  while (interval !== 'year' && estimateTickCount(first, last, interval) > maxTicks) {
    interval = intervals[intervals.indexOf(interval) + 1];
  }

  const boundaries = generateBoundaries(first, last, interval);
  const ticks: Tick[] = [];
  const usedIndices = new Set<number>();

  for (const boundary of boundaries) {
    const idx = nearestIndex(dates, boundary);
    if (usedIndices.has(idx)) continue;
    usedIndices.add(idx);
    ticks.push({ index: idx, label: fmtDate(dates[idx], interval) });
  }
  return ticks;
}

function estimateTickCount(first: Date, last: Date, interval: TickInterval): number {
  const span = (last.getTime() - first.getTime()) / (1000 * 60 * 60 * 24);
  const divisors: Record<TickInterval, number> = {
    day: 1,
    week: 7,
    biweek: 14,
    month: 30,
    quarter: 91,
    year: 365,
  };
  return span / divisors[interval];
}

function generateBoundaries(first: Date, last: Date, interval: TickInterval): Date[] {
  const bounds: Date[] = [];
  const d = new Date(first);
  switch (interval) {
    case 'week':
      d.setDate(d.getDate() - d.getDay());
      break;
    case 'biweek':
    case 'month':
      d.setDate(1);
      break;
    case 'quarter':
      d.setMonth(Math.floor(d.getMonth() / 3) * 3, 1);
      break;
    case 'year':
      d.setMonth(0, 1);
      break;
  }
  while (d <= last) {
    if (d >= first) bounds.push(new Date(d));
    switch (interval) {
      case 'day':
        d.setDate(d.getDate() + 1);
        break;
      case 'week':
        d.setDate(d.getDate() + 7);
        break;
      case 'biweek':
        d.setDate(d.getDate() + 14);
        break;
      case 'month':
        d.setMonth(d.getMonth() + 1);
        break;
      case 'quarter':
        d.setMonth(d.getMonth() + 3);
        break;
      case 'year':
        d.setFullYear(d.getFullYear() + 1);
        break;
    }
  }
  if (bounds.length > 0) bounds.push(last);
  return bounds;
}

function nearestIndex(dates: string[], target: Date): number {
  const t = target.getTime();
  let best = 0,
    bestDist = Infinity;
  for (let i = 0; i < dates.length; i++) {
    const dist = Math.abs(new Date(dates[i]).getTime() - t);
    if (dist < bestDist) {
      bestDist = dist;
      best = i;
    }
  }
  return best;
}

function fmtDate(dateStr: string, interval: TickInterval): string {
  const d = new Date(dateStr);
  switch (interval) {
    case 'day':
    case 'week':
    case 'biweek':
      return `${MONTH_SHORT[d.getMonth()]} ${d.getDate()}`;
    case 'month':
      return MONTH_SHORT[d.getMonth()];
    case 'quarter':
      return `Q${Math.floor(d.getMonth() / 3) + 1} '${String(d.getFullYear()).slice(2)}`;
    case 'year':
      return String(d.getFullYear());
  }
}

function LineChart({
  data,
  className,
}: {
  data: { date: string; value: number }[];
  className?: string;
  height?: number;
}) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ w: 600, h: 200 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      if (width > 0 && height > 0) setDims({ w: Math.round(width), h: Math.round(height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const svgW = dims.w;
  const svgH = dims.h;
  const plotW = svgW - PAD.left - PAD.right;
  const plotH = svgH - PAD.top - PAD.bottom;

  const values = data.map((d) => d.value);
  const min = Math.min(...values) * 0.995;
  const max = Math.max(...values) * 1.005;
  const range = max - min || 1;

  const points = data.map((d, i) => ({
    x: PAD.left + (i / Math.max(data.length - 1, 1)) * plotW,
    y: PAD.top + (1 - (d.value - min) / range) * plotH,
    ...d,
  }));

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${PAD.top + plotH} L ${points[0].x} ${PAD.top + plotH} Z`;

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((pct) => ({
    pct,
    value: min + pct * range,
    y: PAD.top + (1 - pct) * plotH,
  }));

  function handleMouseMove(e: React.MouseEvent) {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const svgX = ((e.clientX - rect.left) / rect.width) * svgW;
    let nearest = 0,
      minDist = Infinity;
    for (let i = 0; i < points.length; i++) {
      const dist = Math.abs(points[i].x - svgX);
      if (dist < minDist) {
        minDist = dist;
        nearest = i;
      }
    }
    setHoverIdx(nearest);
  }

  const hp = hoverIdx !== null ? points[hoverIdx] : null;

  // Unique gradient id per instance to avoid conflicts
  const gradId = useRef(`lineGrad-${Math.random().toString(36).slice(2, 8)}`).current;

  return (
    <div
      ref={containerRef}
      className={cn('relative w-full', className)}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setHoverIdx(null)}
    >
      <svg width={svgW} height={svgH} className="block">
        {yTicks.map((tick) => (
          <g key={tick.pct}>
            {tick.pct > 0 && tick.pct < 1 && (
              <line
                x1={PAD.left}
                x2={svgW - PAD.right}
                y1={tick.y}
                y2={tick.y}
                stroke="var(--border)"
                strokeWidth={0.5}
              />
            )}
            {tick.pct > 0 && (
              <text
                x={PAD.left - 8}
                y={tick.y + 4}
                textAnchor="end"
                className="fill-muted-foreground"
                fontSize={AXIS_FONT}
              >
                {fmtAxisK(tick.value)}
              </text>
            )}
          </g>
        ))}
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.5} />
            <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.05} />
          </linearGradient>
        </defs>
        <path d={areaPath} fill={`url(#${gradId})`} />
        <path d={linePath} fill="none" stroke="var(--chart-1)" strokeWidth={2} />
        {generateTicks(data.map((d) => d.date)).map((tick) => (
          <text
            key={tick.index}
            x={points[tick.index].x}
            y={svgH - 6}
            textAnchor="middle"
            className="fill-muted-foreground"
            fontSize={AXIS_FONT}
          >
            {tick.label}
          </text>
        ))}
        {hp && (
          <line
            x1={hp.x}
            x2={hp.x}
            y1={PAD.top}
            y2={PAD.top + plotH}
            stroke="var(--muted-foreground)"
            strokeWidth={1}
            strokeDasharray="4 2"
            opacity={0.5}
          />
        )}
        {hp && (
          <circle
            cx={hp.x}
            cy={hp.y}
            r={4}
            fill="var(--chart-1)"
            stroke="var(--background)"
            strokeWidth={2}
          />
        )}
      </svg>
      {hp && (
        <div
          className="absolute pointer-events-none z-10 rounded-md bg-popover border border-border px-3 py-1.5 text-xs shadow-md whitespace-nowrap"
          style={{
            left: `${(hp.x / svgW) * 100}%`,
            top: `${(hp.y / svgH) * 100}%`,
            transform: 'translate(-50%, -140%)',
          }}
        >
          <span className="text-muted-foreground">{hp.date}</span>
          <span className="ml-2 font-mono tabular-nums font-medium">{fmt(hp.value)}</span>
        </div>
      )}
    </div>
  );
}

function DonutChart({
  segments,
  total,
}: {
  segments: { id: string; label: string; value: number }[];
  total: number;
}) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const size = 160;
  const cx = size / 2;
  const cy = size / 2;
  const outerR = size / 2 - 4;
  const innerR = outerR * 0.6;

  let cumulative = 0;
  const arcs = segments.map((seg, i) => {
    const pct = seg.value / total;
    const startAngle = cumulative * 2 * Math.PI - Math.PI / 2;
    cumulative += pct;
    const endAngle = cumulative * 2 * Math.PI - Math.PI / 2;
    const largeArc = pct > 0.5 ? 1 : 0;
    const x1 = cx + outerR * Math.cos(startAngle);
    const y1 = cy + outerR * Math.sin(startAngle);
    const x2 = cx + outerR * Math.cos(endAngle);
    const y2 = cy + outerR * Math.sin(endAngle);
    const ix1 = cx + innerR * Math.cos(endAngle);
    const iy1 = cy + innerR * Math.sin(endAngle);
    const ix2 = cx + innerR * Math.cos(startAngle);
    const iy2 = cy + innerR * Math.sin(startAngle);
    return {
      d: `M ${x1} ${y1} A ${outerR} ${outerR} 0 ${largeArc} 1 ${x2} ${y2} L ${ix1} ${iy1} A ${innerR} ${innerR} 0 ${largeArc} 0 ${ix2} ${iy2} Z`,
      color: CHART_COLORS[i % CHART_COLORS.length],
      pct,
      ...seg,
    };
  });

  const hovered = hoverIdx !== null ? arcs[hoverIdx] : null;

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="w-28 h-28 shrink-0">
      {arcs.map((arc, i) => (
        <path
          key={arc.id}
          d={arc.d}
          fill={arc.color}
          opacity={hoverIdx === null ? 1 : hoverIdx === i ? 1 : 0.3}
          className="transition-opacity cursor-pointer"
          onMouseEnter={() => setHoverIdx(i)}
          onMouseLeave={() => setHoverIdx(null)}
        />
      ))}
      {hovered ? (
        <>
          <text
            x={cx}
            y={cy - 6}
            textAnchor="middle"
            className="fill-foreground"
            fontSize={11}
            fontWeight={600}
          >
            {hovered.label.length > 10 ? hovered.label.slice(0, 10) + '…' : hovered.label}
          </text>
          <text
            x={cx}
            y={cy + 10}
            textAnchor="middle"
            className="fill-muted-foreground"
            fontSize={10}
          >
            {(hovered.pct * 100).toFixed(1)}%
          </text>
        </>
      ) : (
        <text x={cx} y={cy + 4} textAnchor="middle" className="fill-muted-foreground" fontSize={10}>
          {fmt(total)}
        </text>
      )}
    </svg>
  );
}
