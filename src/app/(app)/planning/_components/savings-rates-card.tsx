'use client';

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { InfoTip } from '@/components/ui/info-tip';
import { fmtPct } from '@/lib/formatters';
import type { SavingsRates } from '@shared/types';

interface SavingsRatesCardProps {
  rates: SavingsRates;
}

const RATE_DESCRIPTIONS = {
  investment:
    'Percentage of gross income directed to investment accounts (brokerage, retirement, HSA).',
  savings:
    'Percentage of gross income directed to savings accounts (emergency fund, cash reserves).',
  total: 'Combined investment and savings rate — the total share of gross income you keep.',
};

export function SavingsRatesCard({ rates }: SavingsRatesCardProps) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>Savings Rates</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-6">
          <RateDisplay
            label="Investment Rate"
            tip={RATE_DESCRIPTIONS.investment}
            value={rates.investment_rate}
          />
          <RateDisplay
            label="Savings Rate"
            tip={RATE_DESCRIPTIONS.savings}
            value={rates.savings_rate}
          />
          <RateDisplay
            label="Total"
            tip={RATE_DESCRIPTIONS.total}
            value={rates.total_savings_rate}
            highlight
          />
        </div>
      </CardContent>
    </Card>
  );
}

function RateDisplay({
  label,
  tip,
  value,
  highlight,
}: {
  label: string;
  tip?: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div>
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        {label}
        {tip && <InfoTip content={tip} size={13} />}
      </div>
      <div
        className={`font-mono text-lg tabular-nums ${highlight ? 'font-semibold text-primary' : ''}`}
      >
        {fmtPct(value)}
      </div>
    </div>
  );
}
