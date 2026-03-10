'use client';

import { useState, useRef } from 'react';
import {
  devBypass,
  mockHoldings,
  mockPortfolioHistory,
  mockAllocationHistory,
} from '@/lib/mock-data';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import {
  IconChartLine,
  IconArrowUpRight,
  IconArrowDownRight,
  IconArrowsSort,
  IconSortAscending,
  IconSortDescending,
} from '@tabler/icons-react';

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

function ChangeCell({ value }: { value: number }) {
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

export default function InvestmentsPage() {
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [hoveredAlloc, setHoveredAlloc] = useState<number | null>(null);

  if (!devBypass) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Investments</h1>
        <Card>
          <CardContent>
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <IconChartLine size={32} className="text-muted-foreground" stroke={1.5} />
              <p className="text-sm text-muted-foreground">
                Holdings, performance, and allocation views coming soon.
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
      setSortDir('desc');
    }
  }

  // Allocation is always sorted by value descending
  const byValue = [...mockHoldings].sort((a, b) => b.value - a.value);

  const holdings = [...mockHoldings];
  if (sortKey) {
    holdings.sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      const aNum = Number(aVal);
      const bNum = Number(bVal);
      return sortDir === 'asc' ? aNum - bNum : bNum - aNum;
    });
  }

  const totalValue = holdings.reduce((s, h) => s + h.value, 0);
  const totalGain = holdings.reduce((s, h) => s + h.gain, 0);
  const totalCost = holdings.reduce((s, h) => s + h.cost_basis, 0);
  const totalGainPct = totalCost ? (totalGain / totalCost) * 100 : 0;

  // Map each holding to its color index (based on value-sorted order)
  const colorMap = new Map(byValue.map((h, i) => [h.id, i]));

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
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Investments</h1>

      {/* Summary */}
      <Card>
        <CardContent className="pt-5">
          <p className="text-sm text-muted-foreground">Total Value</p>
          <div className="mt-2 flex items-baseline gap-3">
            <span className="text-2xl font-semibold font-mono tabular-nums">{fmt(totalValue)}</span>
            <span className="text-sm">
              <GainCell value={totalGain} /> <span className="text-muted-foreground">(</span>
              <ChangeCell value={totalGainPct} />
              <span className="text-muted-foreground">)</span>
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Allocation */}
      <Card>
        <CardContent className="pt-5">
          <p className="text-sm text-muted-foreground mb-3">Allocation</p>
          <div className="flex gap-0.5 h-5 rounded-full overflow-hidden">
            {byValue.map((h, i) => (
              <div
                key={h.id}
                className="transition-opacity"
                style={{
                  width: `${(h.value / totalValue) * 100}%`,
                  backgroundColor: CHART_COLORS[i % CHART_COLORS.length],
                  opacity: hoveredAlloc === null ? 1 : hoveredAlloc === i ? 1 : 0.35,
                }}
                onMouseEnter={() => setHoveredAlloc(i)}
                onMouseLeave={() => setHoveredAlloc(null)}
              />
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
            {byValue.map((h, i) => (
              <span
                key={h.id}
                className={`inline-flex items-center gap-1.5 transition-opacity ${hoveredAlloc !== null && hoveredAlloc !== i ? 'opacity-40' : ''}`}
                onMouseEnter={() => setHoveredAlloc(i)}
                onMouseLeave={() => setHoveredAlloc(null)}
              >
                <span
                  className="h-2.5 w-2.5 rounded-sm"
                  style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                />
                <span className="font-medium text-foreground">{h.symbol}</span>
                {hoveredAlloc === i ? (
                  <>
                    {fmt(h.value)} &middot; {((h.value / totalValue) * 100).toFixed(1)}%
                  </>
                ) : (
                  <>{((h.value / totalValue) * 100).toFixed(1)}%</>
                )}
              </span>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Charts row */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Performance line chart */}
        <Card>
          <CardContent className="pt-5">
            <p className="text-sm text-muted-foreground mb-3">Performance</p>
            <LineChart data={mockPortfolioHistory} />
          </CardContent>
        </Card>

        {/* Donut chart */}
        <Card>
          <CardContent className="pt-5">
            <p className="text-sm text-muted-foreground mb-3">Breakdown</p>
            <div className="flex items-center gap-6">
              <DonutChart data={byValue} total={totalValue} />
              <div className="flex flex-col gap-1.5 text-xs text-muted-foreground">
                {byValue.map((h, i) => (
                  <span key={h.id} className="inline-flex items-center gap-1.5">
                    <span
                      className="h-2.5 w-2.5 rounded-sm"
                      style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                    />
                    <span className="font-medium text-foreground">{h.symbol}</span>
                    {fmt(h.value)}
                  </span>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Stacked area chart */}
      <Card>
        <CardContent className="pt-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-muted-foreground">Allocation Over Time</p>
            <div className="flex gap-3 text-xs text-muted-foreground">
              {['FXAIX', 'VTI', 'MSFT', 'Other'].map((label, i) => (
                <span key={label} className="inline-flex items-center gap-1.5">
                  <span
                    className="h-2.5 w-2.5 rounded-sm"
                    style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                  />
                  <span className="font-medium text-foreground">{label}</span>
                </span>
              ))}
            </div>
          </div>
          <StackedAreaChart data={mockAllocationHistory} />
        </CardContent>
      </Card>

      {/* Holdings table */}
      <Card>
        <CardHeader>
          <CardTitle>Holdings</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
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
              {holdings.map((h) => (
                <TableRow key={h.id}>
                  <TableCell className="font-medium font-mono">{h.symbol}</TableCell>
                  <TableCell>{h.name}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{h.shares}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {fmt(h.price)}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {fmt(h.value)}
                  </TableCell>
                  <TableCell className="text-right">
                    <GainCell value={h.gain} />
                  </TableCell>
                  <TableCell className="text-right">
                    <ChangeCell value={h.gain_pct} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// ── SVG Chart Components ──
// Half-width charts (in 2-col grid)
const AXIS_FONT = 12;
const SVG_W = 600;
const SVG_H = 200;
const PAD = { top: 12, right: 16, bottom: 28, left: 56 };
const PLOT_W = SVG_W - PAD.left - PAD.right;
const PLOT_H = SVG_H - PAD.top - PAD.bottom;

// Full-width charts — double the viewBox width so font/proportions match half-width charts
const SVG_W_FULL = 1200;
const PAD_FULL = { top: 12, right: 16, bottom: 28, left: 56 };
const PLOT_W_FULL = SVG_W_FULL - PAD_FULL.left - PAD_FULL.right;
const PLOT_H_FULL = SVG_H - PAD_FULL.top - PAD_FULL.bottom;

function fmtAxisK(n: number) {
  return `$${(n / 1000).toFixed(0)}k`;
}

type TickInterval = 'day' | 'week' | 'biweek' | 'month' | 'quarter' | 'year';

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

interface Tick {
  index: number; // index into the data array
  label: string; // formatted label
}

/** Generate "nice" x-axis ticks based on actual date boundaries, like real charting libraries. */
function generateTicks(dates: string[], maxTicks = 8): Tick[] {
  if (dates.length <= 1)
    return dates.map((_, i) => ({ index: i, label: fmtDate(dates[i], 'month') }));

  const first = new Date(dates[0]);
  const last = new Date(dates[dates.length - 1]);
  const spanDays = (last.getTime() - first.getTime()) / (1000 * 60 * 60 * 24);

  // Pick the natural interval based on total span
  let interval: TickInterval;
  if (spanDays <= 14) interval = 'day';
  else if (spanDays <= 45) interval = 'week';
  else if (spanDays <= 90) interval = 'biweek';
  else if (spanDays <= 730) interval = 'month';
  else if (spanDays <= 2190) interval = 'quarter';
  else interval = 'year';

  // If the natural interval produces too many ticks, step up
  const intervals: TickInterval[] = ['day', 'week', 'biweek', 'month', 'quarter', 'year'];
  while (interval !== 'year' && estimateTickCount(first, last, interval) > maxTicks) {
    interval = intervals[intervals.indexOf(interval) + 1];
  }

  // Find data indices that land on (or nearest to) each tick boundary
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
  const spanDays = (last.getTime() - first.getTime()) / (1000 * 60 * 60 * 24);
  switch (interval) {
    case 'day':
      return spanDays;
    case 'week':
      return spanDays / 7;
    case 'biweek':
      return spanDays / 14;
    case 'month':
      return spanDays / 30;
    case 'quarter':
      return spanDays / 91;
    case 'year':
      return spanDays / 365;
  }
}

function generateBoundaries(first: Date, last: Date, interval: TickInterval): Date[] {
  const bounds: Date[] = [];
  const d = new Date(first);

  // Snap to the next clean boundary
  switch (interval) {
    case 'day':
      break; // already on a day
    case 'week':
      d.setDate(d.getDate() - d.getDay()); // snap to Sunday
      break;
    case 'biweek':
      d.setDate(1); // snap to 1st of month
      break;
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

  // Always include a boundary near the last date
  if (bounds.length > 0 && nearestIndex([last.toISOString()], bounds[bounds.length - 1]) !== 0) {
    bounds.push(last);
  }

  return bounds;
}

function nearestIndex(dates: string[], target: Date): number {
  const t = target.getTime();
  let best = 0;
  let bestDist = Infinity;
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
      return `${MONTH_SHORT[d.getMonth()]} ${d.getDate()}`;
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

function LineChart({ data }: { data: { date: string; value: number }[] }) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const values = data.map((d) => d.value);
  const min = Math.min(...values) * 0.995;
  const max = Math.max(...values) * 1.005;
  const range = max - min || 1;

  const points = data.map((d, i) => {
    const x = PAD.left + (i / (data.length - 1)) * PLOT_W;
    const y = PAD.top + (1 - (d.value - min) / range) * PLOT_H;
    return { x, y, ...d };
  });

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${PAD.top + PLOT_H} L ${points[0].x} ${PAD.top + PLOT_H} Z`;

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((pct) => ({
    pct,
    value: min + pct * range,
    y: PAD.top + (1 - pct) * PLOT_H,
  }));

  function handleMouseMove(e: React.MouseEvent) {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const svgX = ((e.clientX - rect.left) / rect.width) * SVG_W;
    let nearest = 0;
    let minDist = Infinity;
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

  return (
    <div
      ref={containerRef}
      className="relative"
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setHoverIdx(null)}
    >
      <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} className="w-full">
        {yTicks.map((tick) => (
          <g key={tick.pct}>
            {tick.pct > 0 && tick.pct < 1 && (
              <line
                x1={PAD.left}
                x2={SVG_W - PAD.right}
                y1={tick.y}
                y2={tick.y}
                stroke="var(--border)"
                strokeWidth={0.5}
              />
            )}
            <text
              x={PAD.left - 8}
              y={tick.y + 4}
              textAnchor="end"
              className="fill-muted-foreground"
              fontSize={AXIS_FONT}
            >
              {fmtAxisK(tick.value)}
            </text>
          </g>
        ))}
        <defs>
          <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.5} />
            <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.05} />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#lineGrad)" />
        <path d={linePath} fill="none" stroke="var(--chart-1)" strokeWidth={2.5} />
        {points.map((p, i) => (
          <circle
            key={p.date}
            cx={p.x}
            cy={p.y}
            r={hoverIdx === i ? 5 : 3}
            fill="var(--chart-1)"
            opacity={hoverIdx === null || hoverIdx === i ? 0.9 : 0.3}
            stroke={hoverIdx === i ? 'var(--background)' : 'none'}
            strokeWidth={2}
          />
        ))}
        {generateTicks(data.map((d) => d.date)).map((tick) => (
          <text
            key={tick.index}
            x={points[tick.index].x}
            y={SVG_H - 6}
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
            y2={PAD.top + PLOT_H}
            stroke="var(--muted-foreground)"
            strokeWidth={1}
            strokeDasharray="4 2"
            opacity={0.5}
          />
        )}
      </svg>
      {hp && (
        <div
          className="absolute pointer-events-none z-10 rounded-md bg-popover border border-border px-3 py-1.5 text-xs shadow-md whitespace-nowrap"
          style={{
            left: `${(hp.x / SVG_W) * 100}%`,
            top: `${(hp.y / SVG_H) * 100}%`,
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
  data,
  total,
}: {
  data: { id: string; symbol: string; value: number }[];
  total: number;
}) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const size = 200;
  const cx = size / 2;
  const cy = size / 2;
  const outerR = size / 2 - 4;
  const innerR = outerR * 0.6;

  let cumulative = 0;
  const segments = data.map((h, i) => {
    const pct = h.value / total;
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
      ...h,
    };
  });

  const hovered = hoverIdx !== null ? segments[hoverIdx] : null;

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="flex-1 max-h-56">
      {segments.map((seg, i) => (
        <path
          key={seg.id}
          d={seg.d}
          fill={seg.color}
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
            y={cy - 12}
            textAnchor="middle"
            className="fill-foreground"
            fontSize={16}
            fontWeight={600}
          >
            {hovered.symbol}
          </text>
          <text x={cx} y={cy + 6} textAnchor="middle" className="fill-foreground" fontSize={12}>
            {fmt(hovered.value)}
          </text>
          <text
            x={cx}
            y={cy + 22}
            textAnchor="middle"
            className="fill-muted-foreground"
            fontSize={11}
          >
            {(hovered.pct * 100).toFixed(1)}%
          </text>
        </>
      ) : (
        <text x={cx} y={cy + 5} textAnchor="middle" className="fill-muted-foreground" fontSize={12}>
          {fmt(total)}
        </text>
      )}
    </svg>
  );
}

function StackedAreaChart({
  data,
}: {
  data: { date: string; FXAIX: number; VTI: number; MSFT: number; other: number }[];
}) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const keys = ['FXAIX', 'VTI', 'MSFT', 'other'] as const;
  const totals = data.map((d) => keys.reduce((s, k) => s + d[k], 0));
  const maxTotal = Math.max(...totals);

  const stacked = data.map((d) => {
    let cum = 0;
    return keys.map((k) => {
      const y0 = cum;
      cum += d[k];
      return { y0, y1: cum };
    });
  });

  function xPos(i: number) {
    return PAD_FULL.left + (i / (data.length - 1)) * PLOT_W_FULL;
  }
  function yPos(val: number) {
    return PAD_FULL.top + (1 - val / maxTotal) * PLOT_H_FULL;
  }

  function handleMouseMove(e: React.MouseEvent) {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const svgX = ((e.clientX - rect.left) / rect.width) * SVG_W_FULL;
    let nearest = 0;
    let minDist = Infinity;
    for (let i = 0; i < data.length; i++) {
      const dist = Math.abs(xPos(i) - svgX);
      if (dist < minDist) {
        minDist = dist;
        nearest = i;
      }
    }
    setHoverIdx(nearest);
  }

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((pct) => ({
    pct,
    value: pct * maxTotal,
    y: PAD_FULL.top + (1 - pct) * PLOT_H_FULL,
  }));

  const hx = hoverIdx !== null ? xPos(hoverIdx) : 0;
  const hd = hoverIdx !== null ? data[hoverIdx] : null;

  // Tooltip position as percentage — anchor near the crosshair line
  const tooltipLeftPct = hoverIdx !== null ? (hx / SVG_W_FULL) * 100 : 0;

  return (
    <div
      ref={containerRef}
      className="relative"
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setHoverIdx(null)}
    >
      <svg viewBox={`0 0 ${SVG_W_FULL} ${SVG_H}`} className="w-full">
        {yTicks.map((tick) => (
          <g key={tick.pct}>
            {tick.pct > 0 && tick.pct < 1 && (
              <line
                x1={PAD_FULL.left}
                x2={SVG_W_FULL - PAD_FULL.right}
                y1={tick.y}
                y2={tick.y}
                stroke="var(--border)"
                strokeWidth={0.5}
              />
            )}
            <text
              x={PAD_FULL.left - 8}
              y={tick.y + 4}
              textAnchor="end"
              className="fill-muted-foreground"
              fontSize={AXIS_FONT}
            >
              {fmtAxisK(tick.value)}
            </text>
          </g>
        ))}
        {keys.map((key, ki) => {
          const topLine = stacked
            .map((s, i) => `${i === 0 ? 'M' : 'L'} ${xPos(i)} ${yPos(s[ki].y1)}`)
            .join(' ');
          const bottomLine = stacked
            .map(
              (s, i) =>
                `L ${xPos(data.length - 1 - i)} ${yPos(stacked[data.length - 1 - i][ki].y0)}`,
            )
            .join(' ');
          return (
            <path
              key={key}
              d={`${topLine} ${bottomLine} Z`}
              fill={CHART_COLORS[ki % CHART_COLORS.length]}
              opacity={0.25}
            />
          );
        })}
        {keys.map((key, ki) => {
          const line = stacked
            .map((s, i) => `${i === 0 ? 'M' : 'L'} ${xPos(i)} ${yPos(s[ki].y1)}`)
            .join(' ');
          return (
            <path
              key={`line-${key}`}
              d={line}
              fill="none"
              stroke={CHART_COLORS[ki % CHART_COLORS.length]}
              strokeWidth={1.5}
              opacity={0.8}
            />
          );
        })}
        {generateTicks(data.map((d) => d.date)).map((tick) => (
          <text
            key={tick.index}
            x={xPos(tick.index)}
            y={SVG_H - 6}
            textAnchor="middle"
            className="fill-muted-foreground"
            fontSize={AXIS_FONT}
          >
            {tick.label}
          </text>
        ))}
        {hoverIdx !== null && (
          <>
            <line
              x1={hx}
              x2={hx}
              y1={PAD_FULL.top}
              y2={PAD_FULL.top + PLOT_H_FULL}
              stroke="var(--muted-foreground)"
              strokeWidth={1}
              strokeDasharray="4 2"
              opacity={0.5}
            />
            {keys.map((key, ki) => (
              <circle
                key={key}
                cx={hx}
                cy={yPos(stacked[hoverIdx][ki].y1)}
                r={4}
                fill={CHART_COLORS[ki % CHART_COLORS.length]}
                stroke="var(--background)"
                strokeWidth={1.5}
              />
            ))}
          </>
        )}
      </svg>
      {hd && (
        <div
          className="absolute pointer-events-none z-10 top-0 rounded-md bg-popover border border-border px-3 py-2 text-xs shadow-md whitespace-nowrap"
          style={{
            left: `${tooltipLeftPct}%`,
            transform:
              tooltipLeftPct > 70
                ? 'translateX(-100%)'
                : tooltipLeftPct < 15
                  ? 'translateX(0)'
                  : 'translateX(-50%)',
          }}
        >
          <p className="font-medium mb-1">{hd.date}</p>
          {keys.map((key, ki) => (
            <p key={key} className="flex items-center gap-1.5">
              <span
                className="inline-block h-2 w-2 rounded-sm"
                style={{ backgroundColor: CHART_COLORS[ki % CHART_COLORS.length] }}
              />
              <span className="text-muted-foreground">{key === 'other' ? 'Other' : key}</span>
              <span className="ml-auto font-mono tabular-nums pl-3">{fmtAxisK(hd[key])}</span>
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
