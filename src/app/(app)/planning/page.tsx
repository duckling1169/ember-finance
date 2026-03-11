'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { ScenarioSelector } from '@/components/planning/scenario-selector';
import { FIMetricsCards } from './_components/fi-metrics-cards';
import { SavingsRatesCard } from './_components/savings-rates-card';
import { ProjectionChart } from './_components/projection-chart';
import { ProjectionTable } from './_components/projection-table';
import { AssumptionsPanel } from './_components/assumptions-panel';
import { useMetrics, useProjections } from '@/lib/swr';
import { fmt } from '@/lib/formatters';

export default function PlanningPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const scenarioId = searchParams.get('scenario') ?? undefined;

  const {
    data: metricsData,
    isLoading: metricsLoading,
    error: metricsError,
  } = useMetrics(scenarioId);
  const { data: projData, isLoading: projLoading } = useProjections(scenarioId);

  function handleScenarioChange(id: string | undefined) {
    const params = new URLSearchParams(searchParams.toString());
    if (id) {
      params.set('scenario', id);
    } else {
      params.delete('scenario');
    }
    router.push(`/planning?${params.toString()}`);
  }

  const loading = metricsLoading || projLoading;

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Accumulation Planning</h1>
        <ScenarioSelector value={scenarioId} onChange={handleScenarioChange} />
      </div>

      {/* Loading state */}
      {loading && (
        <div className="py-12 text-center text-sm text-muted-foreground">
          Loading planning data...
        </div>
      )}

      {/* Error state — likely missing birthday */}
      {metricsError && !metricsLoading && (
        <Card size="sm" className="border-destructive/30">
          <CardContent className="text-sm text-destructive">
            {metricsError.message?.includes('birthday')
              ? 'Add your birthday in Settings to enable FI metric calculations.'
              : `Error loading metrics: ${metricsError.message}`}
          </CardContent>
        </Card>
      )}

      {/* FI Portfolio Value */}
      {metricsData && (
        <Card size="sm" className="p-3">
          <div className="text-[11px] text-muted-foreground">FI Portfolio Value</div>
          <div className="font-mono text-xl font-semibold tabular-nums">
            {fmt(metricsData.fi_portfolio_value)}
          </div>
        </Card>
      )}

      {/* FI Metrics */}
      {metricsData?.metrics && <FIMetricsCards metrics={metricsData.metrics} />}

      {/* Savings Rates */}
      {metricsData?.savings_rates && <SavingsRatesCard rates={metricsData.savings_rates} />}

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
              className="h-[300px]"
            />
          </CardContent>
        </Card>
      )}

      {/* Projection Table */}
      {projData?.projection && <ProjectionTable projection={projData.projection} />}

      {/* Assumptions */}
      {metricsData?.scenario && <AssumptionsPanel scenario={metricsData.scenario} />}
    </div>
  );
}
