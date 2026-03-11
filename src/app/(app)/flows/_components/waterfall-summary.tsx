'use client';

import type { HouseholdWaterfall } from '@shared/types';
import { fmt } from '@/lib/formatters';
import { cn } from '@/lib/utils';

interface WaterfallSummaryProps {
  waterfall: HouseholdWaterfall;
}

interface WaterfallStep {
  key: string;
  label: string;
  getValue: (w: HouseholdWaterfall) => number;
  negative?: boolean;
  highlight?: boolean;
}

const steps: WaterfallStep[] = [
  { key: 'gross', label: 'Gross Income', getValue: (w) => w.total_gross_annual },
  {
    key: 'deductions',
    label: 'Pre-tax Deductions',
    getValue: (w) => w.total_pre_tax_deductions_monthly * 12,
    negative: true,
  },
  { key: 'taxes', label: 'Taxes', getValue: (w) => w.total_tax_monthly * 12, negative: true },
  { key: 'net', label: 'Net Income', getValue: (w) => w.total_net_income_monthly * 12 },
  {
    key: 'contributions',
    label: 'Contributions',
    getValue: (w) => w.total_post_tax_contributions_monthly * 12,
    negative: true,
  },
  { key: 'expenses', label: 'Expenses', getValue: (w) => w.total_expenses_annual, negative: true },
  { key: 'residual', label: 'Residual', getValue: (w) => w.total_residual_annual, highlight: true },
];

export function WaterfallSummary({ waterfall }: WaterfallSummaryProps) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
      {steps.map((step) => {
        const value = step.getValue(waterfall);
        return (
          <div
            key={step.key}
            className={cn(
              'rounded-lg bg-card px-3 py-2.5',
              step.highlight && value >= 0 && 'ring-1 ring-gain/30',
              step.highlight && value < 0 && 'ring-1 ring-loss/30',
            )}
          >
            <div className="text-xs text-muted-foreground">{step.label}</div>
            <div
              className={cn(
                'font-mono text-sm tabular-nums',
                step.negative && 'text-muted-foreground',
                step.highlight && value >= 0 && 'text-gain',
                step.highlight && value < 0 && 'text-loss',
              )}
            >
              {step.negative && value > 0 ? `−${fmt(value)}` : fmt(value)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
