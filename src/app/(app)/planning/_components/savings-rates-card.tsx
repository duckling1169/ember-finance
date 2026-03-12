'use client';

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { fmtPct } from '@/lib/formatters';
import type { SavingsRates } from '@shared/types';

interface SavingsRatesCardProps {
  rates: SavingsRates;
}

export function SavingsRatesCard({ rates }: SavingsRatesCardProps) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>Savings Rates</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex gap-6">
          <RateDisplay label="Investment Rate" value={rates.investment_rate} />
          <RateDisplay label="Savings Rate" value={rates.savings_rate} />
          <RateDisplay label="Total" value={rates.total_savings_rate} highlight />
        </div>
      </CardContent>
    </Card>
  );
}

function RateDisplay({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div
        className={`font-mono text-lg tabular-nums ${highlight ? 'font-semibold text-primary' : ''}`}
      >
        {fmtPct(value)}
      </div>
    </div>
  );
}
