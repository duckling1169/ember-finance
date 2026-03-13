'use client';

import type { HouseholdWaterfall } from '@shared/types';
import { fmt } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { InfoTip } from '@/components/ui/info-tip';

interface WaterfallSummaryProps {
  waterfall: HouseholdWaterfall;
}

interface WaterfallStep {
  key: string;
  label: string;
  tip: string;
  getValue: (w: HouseholdWaterfall) => number;
  /** Dimmed text — deduction steps that reduce a total */
  subdued?: boolean;
  highlight?: boolean;
}

const steps: WaterfallStep[] = [
  {
    key: 'gross',
    label: 'Gross Income',
    tip: 'Total income before any deductions or taxes — all income sources combined.',
    getValue: (w) => w.total_gross_annual,
  },
  {
    key: 'deductions',
    label: 'Pre-tax Deductions',
    tip: 'Contributions deducted before taxes, like 401(k), traditional IRA, and HSA deferrals.',
    getValue: (w) => w.total_pre_tax_deductions_monthly * 12,
    subdued: true,
  },
  {
    key: 'taxes',
    label: 'Taxes',
    tip: 'Estimated federal, state, and FICA taxes based on your taxable income after pre-tax deductions.',
    getValue: (w) => w.total_tax_monthly * 12,
    subdued: true,
  },
  {
    key: 'net',
    label: 'Net Income',
    tip: 'Take-home pay — what remains after pre-tax deductions and taxes.',
    getValue: (w) => w.total_net_income_monthly * 12,
  },
  {
    key: 'contributions',
    label: 'Post-tax Savings',
    tip: 'Money saved or invested after taxes, such as Roth IRA, brokerage, or savings account contributions.',
    getValue: (w) => w.total_post_tax_contributions_monthly * 12,
    subdued: true,
  },
  {
    key: 'expenses',
    label: 'Expenses',
    tip: 'Annual spending on living expenses, bills, and discretionary costs.',
    getValue: (w) => w.total_expenses_annual,
    subdued: true,
  },
  {
    key: 'residual',
    label: 'Surplus',
    tip: 'What remains after all savings and expenses. Positive means extra cash; negative means you are overspending.',
    getValue: (w) => w.total_residual_annual,
    highlight: true,
  },
];

export function WaterfallSummary({ waterfall }: WaterfallSummaryProps) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
      {steps.map((step) => {
        const value = step.getValue(waterfall);
        const isDeficit = step.highlight && value < 0;
        return (
          <div
            key={step.key}
            className={cn(
              'rounded-lg bg-card px-3 py-2.5',
              step.highlight && value >= 0 && 'ring-1 ring-gain/30',
              isDeficit && 'ring-1 ring-loss/30',
            )}
          >
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              {isDeficit ? 'Shortfall' : step.label}
              <InfoTip content={step.tip} size={13} />
            </div>
            <div
              className={cn(
                'font-mono text-sm tabular-nums',
                step.subdued && 'text-muted-foreground',
                step.highlight && value >= 0 && 'text-gain',
                isDeficit && 'text-loss',
              )}
            >
              {fmt(Math.abs(value))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
