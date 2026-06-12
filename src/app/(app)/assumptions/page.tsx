'use client';

import Link from 'next/link';
import { AssumptionsPanel, getAssumptionsTaxYear } from '@/components/planning/assumptions-panel';
import { useScenario } from '@/lib/scenario-context';
import { useAssumptions, useScenarios } from '@/lib/swr';

/**
 * Assumptions as a first-class destination (design principle 3): every input
 * behind every projection — dated, source-badged, append-only — consolidated
 * in one place, separate from Settings/Profile.
 */
export default function AssumptionsPage() {
  const { scenarioId } = useScenario();
  const { data } = useAssumptions(scenarioId);
  const { data: scenarios } = useScenarios();

  const scenario = scenarioId ? scenarios?.find((s) => s.id === scenarioId) : undefined;
  const isScenarioScoped = !!scenario && !scenario.is_base;
  const taxYear = getAssumptionsTaxYear(data?.assumptions);

  return (
    <div className="space-y-3">
      <div>
        <h1 className="text-2xl font-semibold">Assumptions</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {isScenarioScoped ? (
            <>
              Editing <span className="font-medium text-scenario">{scenario.name}</span> scenario
              overrides — the household baseline is unchanged.
            </>
          ) : (
            'Household baseline — edits apply to every scenario without its own override.'
          )}
          {taxYear != null && <> Tax tables effective {taxYear}.</>}
        </p>
      </div>

      <p className="text-xs text-muted-foreground">
        Every projection and tax figure derives from these dated records. Edits append a new record
        with its own effective date — history is never overwritten. Ember ships dated defaults but
        does not track live law; you own the upkeep. Profile facts (birthday, household, filing
        status) live in{' '}
        <Link href="/settings" className="text-primary hover:underline">
          Settings
        </Link>
        .
      </p>

      <AssumptionsPanel scenarioId={scenarioId} />
    </div>
  );
}
