'use client';

import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert } from '@/components/ui/alert';
import { InfoTip } from '@/components/ui/info-tip';
import { FIMetricsCards, MetricCard } from './_components/fi-metrics-cards';
import { SavingsRatesCard } from './_components/savings-rates-card';
import { ProjectionChart } from './_components/projection-chart';
import { ProjectionTable } from './_components/projection-table';
import { useScenario } from '@/lib/scenario-context';
import { useMetrics, useProjections } from '@/lib/swr';
import { fmt, fmtPct, fmtYears } from '@/lib/formatters';

export default function PlanningPage() {
  const { scenarioId } = useScenario();

  const {
    data: metricsData,
    isLoading: metricsLoading,
    error: metricsError,
  } = useMetrics(scenarioId);
  const { data: projData, isLoading: projLoading } = useProjections(scenarioId);

  const loading = metricsLoading || projLoading;

  const bracketsDetail = metricsData?.assumptions_detail?.find(
    (a) => a.key === 'tax.federal_brackets',
  );
  const bracketsValue = bracketsDetail?.value as { year?: number } | undefined;
  const taxYear = typeof bracketsValue?.year === 'number' ? bracketsValue.year : null;

  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-semibold">Accumulation Planning</h1>

      {/* Persistent banner — errors never go in a toast */}
      {metricsError && !metricsLoading && (
        <Alert>
          {metricsError.message?.includes('birthday') ? (
            <>
              Add your birthday in{' '}
              <Link href="/settings" className="underline">
                Settings
              </Link>{' '}
              to enable FI metric calculations.
            </>
          ) : (
            `Error loading metrics: ${metricsError.message}`
          )}
        </Alert>
      )}

      {/* Loading skeletons */}
      {loading && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-[72px]" />
            ))}
          </div>
          <Skeleton className="h-[300px] w-full" />
        </div>
      )}

      {/* 3 key metric cards */}
      {metricsData?.metrics && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <MetricCard
            label="FI Number"
            tip="The portfolio value needed to sustain your retirement spending indefinitely, based on your withdrawal rate."
            value={fmt(metricsData.metrics.fire_number)}
          />
          <MetricCard
            label="Years to FI"
            tip="Estimated years until your portfolio reaches your FI number at current contribution and return rates."
            value={fmtYears(metricsData.metrics.years_to_fire)}
          />
          <MetricCard
            label="Savings Rate"
            tip="Total savings rate including both cash savings and investment contributions as a percentage of gross income."
            value={fmtPct(metricsData.savings_rates.total_savings_rate)}
          />
        </div>
      )}

      {/* Projection Chart */}
      {projData?.projection && (
        <Card size="sm">
          <CardHeader>
            <CardTitle>Portfolio Projection</CardTitle>
          </CardHeader>
          <CardContent>
            <ProjectionChart
              projection={projData.projection}
              fireNumber={metricsData?.metrics.fire_number}
              className="h-[220px] sm:h-[300px]"
            />
          </CardContent>
        </Card>
      )}

      {/* Projection Table */}
      {projData?.projection && <ProjectionTable projection={projData.projection} />}

      {/* FI Portfolio Value + Savings Rates */}
      {metricsData && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Card size="sm" className="p-3">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              FI Portfolio Value
              <InfoTip
                content="The current total value of accounts included in your FI portfolio — the assets you are growing toward financial independence."
                size={13}
              />
            </div>
            <div className="font-mono text-xl font-semibold tabular-nums">
              {fmt(metricsData.fi_portfolio_value)}
            </div>
          </Card>
          {metricsData.savings_rates && <SavingsRatesCard rates={metricsData.savings_rates} />}
        </div>
      )}

      {/* FI Metrics */}
      {metricsData?.metrics && <FIMetricsCards metrics={metricsData.metrics} />}

      {/* Provenance stamp */}
      {taxYear != null && (
        <p className="text-xs text-muted-foreground">
          Computed with {taxYear} tax tables. Every input is visible and editable in{' '}
          <Link href="/assumptions" className="text-primary hover:underline">
            Assumptions
          </Link>
          .
        </p>
      )}
    </div>
  );
}
