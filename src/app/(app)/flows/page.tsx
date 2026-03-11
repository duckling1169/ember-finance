'use client';

import { useMemo, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { SankeyChart } from '@/components/charts';
import { ScenarioSelector } from '@/components/planning/scenario-selector';
import { WaterfallSummary } from './_components/waterfall-summary';
import { IncomeSourcesCard } from './_components/income-sources-card';
import { CashflowItemsCard } from './_components/cashflow-items-card';
import {
  useCashflowSummary,
  useCashflowItems,
  useIncomeSources,
  useMembers,
  useProfile,
} from '@/lib/swr';
import { buildSankeyData } from '@/lib/sankey-transform';
import { cn } from '@/lib/utils';

export default function FlowsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const scenarioId = searchParams.get('scenario') ?? undefined;

  const { data: profile } = useProfile();
  const { data: members } = useMembers();
  const { data: summary, isLoading: summaryLoading } = useCashflowSummary(scenarioId);
  const { data: cashflowItems } = useCashflowItems();
  const { data: incomeSources } = useIncomeSources();

  // Household view by default, filterable by member for CRUD
  const [selectedMemberId, setSelectedMemberId] = useState<string | undefined>(undefined);
  // For CRUD, fall back to current user
  const crudMemberId = selectedMemberId ?? profile?.id;

  // Filter Sankey by income source
  const [filterSourceId, setFilterSourceId] = useState<string | undefined>(undefined);

  const sankeyData = useMemo(() => {
    if (!summary?.waterfall || !cashflowItems || !incomeSources) {
      return { nodes: [], links: [] };
    }

    // If filtering by a specific income source, build a filtered view
    if (filterSourceId) {
      const filteredSources = incomeSources.filter((s) => s.id === filterSourceId);
      const linkedItemIds = new Set(
        cashflowItems.filter((ci) => ci.income_source_id === filterSourceId).map((ci) => ci.id),
      );
      // Include items linked to this source + unlinked expenses (proportional)
      const filteredItems = cashflowItems.filter(
        (ci) => linkedItemIds.has(ci.id) || (!ci.income_source_id && ci.bucket === 'expense'),
      );
      return buildSankeyData(summary.waterfall, filteredItems, filteredSources);
    }

    return buildSankeyData(summary.waterfall, cashflowItems, incomeSources);
  }, [summary, cashflowItems, incomeSources, filterSourceId]);

  function handleScenarioChange(id: string | undefined) {
    const params = new URLSearchParams(searchParams.toString());
    if (id) {
      params.set('scenario', id);
    } else {
      params.delete('scenario');
    }
    router.push(`/flows?${params.toString()}`);
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Money Flows</h1>
        <div className="flex items-center gap-2">
          {/* Filter by income source */}
          {incomeSources && incomeSources.length > 1 && (
            <select
              value={filterSourceId ?? ''}
              onChange={(e) => setFilterSourceId(e.target.value || undefined)}
              className={cn(
                'rounded-md border border-border bg-card px-3 py-1.5 text-sm',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
              )}
            >
              <option value="">All income</option>
              {incomeSources.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          )}
          <ScenarioSelector value={scenarioId} onChange={handleScenarioChange} />
        </div>
      </div>

      {/* Waterfall summary bar */}
      {summary?.waterfall && <WaterfallSummary waterfall={summary.waterfall} />}

      {/* Sankey chart */}
      <Card>
        <CardContent>
          {summaryLoading ? (
            <div className="flex h-[400px] items-center justify-center text-sm text-muted-foreground">
              Loading flows...
            </div>
          ) : sankeyData.nodes.length === 0 ? (
            <div className="flex h-[400px] items-center justify-center text-sm text-muted-foreground">
              Add income sources and cashflow items to see your money flows.
            </div>
          ) : (
            <SankeyChart data={sankeyData} className="h-[400px]" />
          )}
        </CardContent>
      </Card>

      {/* CRUD sections — member selector for multi-member households */}
      <div className="flex items-center gap-2">
        {members && members.length > 1 && (
          <>
            <span className="text-xs text-muted-foreground">Editing for:</span>
            <select
              value={selectedMemberId ?? profile?.id ?? ''}
              onChange={(e) => setSelectedMemberId(e.target.value || undefined)}
              className={cn(
                'rounded-md border border-border bg-card px-2 py-1 text-xs',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
              )}
            >
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.display_name}
                </option>
              ))}
            </select>
          </>
        )}
      </div>

      {crudMemberId && (
        <div className="grid gap-3 lg:grid-cols-2">
          <IncomeSourcesCard memberId={crudMemberId} />
          <CashflowItemsCard memberId={crudMemberId} />
        </div>
      )}
    </div>
  );
}
