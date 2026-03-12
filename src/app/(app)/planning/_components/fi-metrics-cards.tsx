'use client';

import { Card } from '@/components/ui/card';
import { InfoTip } from '@/components/ui/info-tip';
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

const METRIC_DESCRIPTIONS: Record<string, string> = {
  fi_number:
    'The portfolio value needed to sustain your retirement spending indefinitely, based on your withdrawal rate.',
  security_fi:
    'A lower FI target where investment returns alone cover your annual expenses — no drawdown needed.',
  coast_fi:
    'The portfolio value at which, with no further contributions, growth alone reaches your FI number by your target retirement age.',
  boiling_point:
    'The portfolio value where annual investment returns exceed your annual contributions — your money works harder than you do.',
  progress:
    'How far your current FI portfolio has grown toward your FI number, expressed as a percentage.',
  years_to_fire:
    'Estimated years until your portfolio reaches your FI number at current contribution and return rates.',
  retirement_age:
    'Your current age plus years to FI — the projected age at which you could reach financial independence.',
  on_track:
    'Whether your projected retirement age is ahead of, on, or behind your target retirement age.',
};

export function FIMetricsCards({ metrics }: FIMetricsCardsProps) {
  const track = ON_TRACK_CONFIG[metrics.on_track];

  return (
    <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
      <MetricCard
        label="FI Number"
        tip={METRIC_DESCRIPTIONS.fi_number}
        value={fmt(metrics.fire_number)}
      />
      <MetricCard
        label="Security FI"
        tip={METRIC_DESCRIPTIONS.security_fi}
        value={fmt(metrics.security_fi)}
      />
      <MetricCard
        label="Coast FI"
        tip={METRIC_DESCRIPTIONS.coast_fi}
        value={fmt(metrics.coast_fi)}
      />
      <MetricCard
        label="Boiling Point"
        tip={METRIC_DESCRIPTIONS.boiling_point}
        value={fmt(metrics.boiling_point)}
      />

      <MetricCard
        label="Progress to FI"
        tip={METRIC_DESCRIPTIONS.progress}
        value={fmtPct(metrics.progress_pct / 100)}
      >
        <div
          className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuenow={Math.min(metrics.progress_pct, 100)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Progress to FI: ${fmtPct(metrics.progress_pct / 100)}`}
        >
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${Math.min(metrics.progress_pct, 100)}%` }}
          />
        </div>
      </MetricCard>

      <MetricCard
        label="Years to FI"
        tip={METRIC_DESCRIPTIONS.years_to_fire}
        value={fmtYears(metrics.years_to_fire)}
      />

      <MetricCard
        label="Projected Retirement Age"
        tip={METRIC_DESCRIPTIONS.retirement_age}
        value={
          metrics.projected_retirement_age != null
            ? metrics.projected_retirement_age.toFixed(1)
            : '--'
        }
      />

      <MetricCard label="On Track" tip={METRIC_DESCRIPTIONS.on_track}>
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
  tip,
  value,
  children,
}: {
  label: string;
  tip?: string;
  value?: string;
  children?: React.ReactNode;
}) {
  return (
    <Card size="sm" className="p-3">
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        {label}
        {tip && <InfoTip content={tip} size={13} />}
      </div>
      {value && <div className="font-mono text-xl font-semibold tabular-nums">{value}</div>}
      {children}
    </Card>
  );
}
