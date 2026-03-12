'use client';

import { Card } from '@/components/ui/card';
import { fmt, fmtPct, fmtYears } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import type { FIMetrics } from '@shared/types';

interface FIMetricsCardsProps {
  metrics: FIMetrics;
}

const ON_TRACK_CONFIG = {
  ahead: { label: 'Ahead', className: 'bg-gain/15 text-gain' },
  on_track: { label: 'On Track', className: 'bg-gain/15 text-gain' },
  behind: { label: 'Behind', className: 'bg-warning/15 text-warning' },
  unreachable: { label: 'Unreachable', className: 'bg-loss/15 text-loss' },
};

export function FIMetricsCards({ metrics }: FIMetricsCardsProps) {
  const track = ON_TRACK_CONFIG[metrics.on_track];

  return (
    <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
      <MetricCard label="FIRE Number" value={fmt(metrics.fire_number)} />
      <MetricCard label="SecurityFI" value={fmt(metrics.security_fi)} />
      <MetricCard label="CoastFI" value={fmt(metrics.coast_fi)} />
      <MetricCard label="Boiling Point" value={fmt(metrics.boiling_point)} />

      <MetricCard label="Progress to FIRE" value={fmtPct(metrics.progress_pct / 100)}>
        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${Math.min(metrics.progress_pct, 100)}%` }}
          />
        </div>
      </MetricCard>

      <MetricCard label="Years to FIRE" value={fmtYears(metrics.years_to_fire)} />

      <MetricCard
        label="Projected Retirement Age"
        value={
          metrics.projected_retirement_age != null
            ? metrics.projected_retirement_age.toFixed(1)
            : '--'
        }
      />

      <MetricCard label="On Track">
        <span
          className={cn(
            'mt-0.5 inline-block rounded px-2 py-0.5 text-xs font-medium',
            track.className,
          )}
        >
          {track.label}
        </span>
      </MetricCard>
    </div>
  );
}

function MetricCard({
  label,
  value,
  children,
}: {
  label: string;
  value?: string;
  children?: React.ReactNode;
}) {
  return (
    <Card size="sm" className="p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      {value && <div className="font-mono text-xl font-semibold tabular-nums">{value}</div>}
      {children}
    </Card>
  );
}
