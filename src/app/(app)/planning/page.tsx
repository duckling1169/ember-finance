'use client';

import { useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { InfoTip } from '@/components/ui/info-tip';
import { ScenarioSelector } from '@/components/planning/scenario-selector';
import { FIMetricsCards, MetricCard } from './_components/fi-metrics-cards';
import { SavingsRatesCard } from './_components/savings-rates-card';
import { ProjectionChart } from './_components/projection-chart';
import { ProjectionTable } from './_components/projection-table';
import { AssumptionsPanel } from './_components/assumptions-panel';
import { useMetrics, useProjections } from '@/lib/swr';
import { fmt, fmtPct, fmtYears } from '@/lib/formatters';

type Tab = 'projections' | 'settings';

const tabs: { key: Tab; label: string }[] = [
  { key: 'projections', label: 'Projections' },
  { key: 'settings', label: 'Settings' },
];

export default function PlanningPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const scenarioId = searchParams.get('scenario') ?? undefined;
  const [activeTab, setActiveTab] = useState<Tab>('projections');

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
        <h1 className="text-2xl font-semibold">Accumulation Planning</h1>
        <ScenarioSelector value={scenarioId} onChange={handleScenarioChange} />
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-border">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab.key
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

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

      {/* Projections tab */}
      {activeTab === 'projections' && (
        <>
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
        </>
      )}

      {/* Settings tab */}
      {activeTab === 'settings' && (
        <>
          {/* Loading skeletons */}
          {loading && (
            <div className="space-y-3">
              <Skeleton className="h-[200px] w-full" />
              <Skeleton className="h-[72px] w-full" />
              <Skeleton className="h-[80px] w-full" />
              <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-[72px]" />
                ))}
              </div>
            </div>
          )}

          {/* Assumptions */}
          {metricsData?.scenario && (
            <AssumptionsPanel scenario={metricsData.scenario} defaultOpen />
          )}

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
        </>
      )}
    </div>
  );
}
