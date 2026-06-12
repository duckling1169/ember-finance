'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Alert } from '@/components/ui/alert';
import { EmptyState } from '@/components/ui/states';
import { Skeleton } from '@/components/ui/skeleton';
import { Select } from '@/components/ui/select';
import dynamic from 'next/dynamic';

const SankeyChart = dynamic(
  () => import('@/components/charts/sankey-chart').then((m) => ({ default: m.SankeyChart })),
  { ssr: false },
);
import { MobileFlowList } from '@/components/charts/mobile-flow-list';
import { WaterfallSummary } from './_components/waterfall-summary';
import { IncomeSourcesCard } from './_components/income-sources-card';
import { CashflowItemsCard } from './_components/cashflow-items-card';
import { useScenario } from '@/lib/scenario-context';
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
  const { scenarioId } = useScenario();

  const { data: profile } = useProfile();
  const { data: members } = useMembers();
  const {
    data: summary,
    isLoading: summaryLoading,
    error: summaryError,
  } = useCashflowSummary(scenarioId);
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
      return { nodes: [], links: [], grossAnnual: 0 };
    }

    const filterSet = filterSourceId ? new Set([filterSourceId]) : undefined;
    return buildSankeyData(summary.waterfall, cashflowItems, incomeSources, accounts, filterSet);
  }, [summary, cashflowItems, incomeSources, accounts, filterSourceId]);

  return (
    <div className="space-y-3">
      {/* Header — scenario selection lives in the global top bar */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Money Flows</h1>
        {/* Filter by income source */}
        {incomeSources && incomeSources.length > 1 && (
          <Select
            value={filterSourceId ?? ''}
            onChange={(e) => setFilterSourceId(e.target.value || undefined)}
            aria-label="Filter by income source"
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
      </div>

      {/* Error state — persistent banner */}
      {summaryError && !summaryLoading && (
        <Alert size="sm">
          {summaryError.message?.includes('birthday') ? (
            <>
              Add your birthday in{' '}
              <Link href="/settings" className="underline">
                Settings
              </Link>{' '}
              to compute your money flows.
            </>
          ) : (
            `Error loading flows: ${summaryError.message}`
          )}
        </Alert>
      )}

      {/* Waterfall summary bar */}
      {summaryLoading && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-[56px] rounded-lg" />
          ))}
        </div>
      )}
      {summary?.waterfall && <WaterfallSummary waterfall={summary.waterfall} />}

      {/* Flow diagram: Sankey on >=sm, stacked tap-to-expand list on phones */}
      <Card>
        <CardContent>
          {summaryLoading ? (
            <Skeleton className="h-[400px]" />
          ) : sankeyData.nodes.length === 0 ? (
            <EmptyState
              title="No money flows yet"
              description="Add income sources and cashflow items to see your money flows."
              className="h-[400px] justify-center"
            />
          ) : (
            <>
              <div className="hidden sm:block">
                <SankeyChart data={sankeyData} />
              </div>
              <div className="sm:hidden">
                <MobileFlowList data={sankeyData} />
              </div>
            </>
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
        <div className="grid gap-3">
          <IncomeSourcesCard memberId={crudMemberId} />
          <CashflowItemsCard memberId={crudMemberId} />
        </div>
      )}
    </div>
  );
}
