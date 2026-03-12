'use client';

import { useMemo, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import dynamic from 'next/dynamic';

const SankeyChart = dynamic(
  () => import('@/components/charts/sankey-chart').then((m) => ({ default: m.SankeyChart })),
  { ssr: false },
);
import { ScenarioSelector } from '@/components/planning/scenario-selector';
import { WaterfallSummary } from './_components/waterfall-summary';
import { IncomeSourcesCard } from './_components/income-sources-card';
import { CashflowItemsCard } from './_components/cashflow-items-card';
import {
  useCashflowSummary,
  useCashflowItems,
  useIncomeSources,
  useAccounts,
  useMembers,
  useProfile,
} from '@/lib/swr';
import { buildSankeyData } from '@/lib/sankey-transform';

export default function FlowsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const scenarioId = searchParams.get('scenario') ?? undefined;

  const { data: profile } = useProfile();
  const { data: members } = useMembers();
  const { data: summary, isLoading: summaryLoading } = useCashflowSummary(scenarioId);
  const { data: cashflowItems } = useCashflowItems();
  const { data: incomeSources } = useIncomeSources();
  const { data: accounts } = useAccounts();

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

    const filterSet = filterSourceId ? new Set([filterSourceId]) : undefined;
    return buildSankeyData(summary.waterfall, cashflowItems, incomeSources, accounts, filterSet);
  }, [summary, cashflowItems, incomeSources, accounts, filterSourceId]);

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
        <h1 className="text-2xl font-semibold">Money Flows</h1>
        <div className="flex items-center gap-2">
          {/* Filter by income source */}
          {incomeSources && incomeSources.length > 1 && (
            <Select
              value={filterSourceId ?? ''}
              onChange={(e) => setFilterSourceId(e.target.value || undefined)}
              className="h-8 w-auto"
            >
              <option value="">All income</option>
              {incomeSources.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
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
            <SankeyChart data={sankeyData} />
          )}
        </CardContent>
      </Card>

      {/* CRUD sections — member selector for multi-member households */}
      <div className="flex items-center gap-2">
        {members && members.length > 1 && (
          <>
            <span className="text-xs text-muted-foreground">Editing for:</span>
            <Select
              value={selectedMemberId ?? profile?.id ?? ''}
              onChange={(e) => setSelectedMemberId(e.target.value || undefined)}
              className="h-7 w-auto px-2 text-xs"
            >
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.display_name}
                </option>
              ))}
            </Select>
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
