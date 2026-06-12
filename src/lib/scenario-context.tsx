'use client';

import { createContext, useCallback, useContext, useEffect, useState, Suspense } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useScenarios } from '@/lib/swr';

/**
 * Global active-scenario state (design principle 4): one selection, visible in
 * the top chrome on every page, persisted across navigation. Scenario-aware
 * pages (/flows, /planning, /assumptions) mirror it into ?scenario= for
 * shareable URLs.
 */

const SCENARIO_KEY = 'ember-scenario';

/** Routes whose numbers change with the active scenario. */
export const SCENARIO_AFFECTED_ROUTES = ['/flows', '/planning', '/assumptions'];

interface ScenarioState {
  /** undefined = base scenario */
  scenarioId: string | undefined;
  setScenarioId: (id: string | undefined) => void;
  /** Name of the active non-base scenario, null when on baseline. */
  activeScenarioName: string | null;
}

const ScenarioContext = createContext<ScenarioState>({
  scenarioId: undefined,
  setScenarioId: () => {},
  activeScenarioName: null,
});

export function useScenario() {
  return useContext(ScenarioContext);
}

function ScenarioUrlSync({
  scenarioId,
  setFromUrl,
}: {
  scenarioId: string | undefined;
  setFromUrl: (id: string | undefined) => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlScenario = searchParams.get('scenario') ?? undefined;
  const affected = SCENARIO_AFFECTED_ROUTES.some((r) => pathname.startsWith(r));

  // A scenario in the URL (e.g. a shared link) wins over stored state.
  useEffect(() => {
    if (affected && urlScenario && urlScenario !== scenarioId) {
      setFromUrl(urlScenario);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync only on URL change
  }, [urlScenario, affected]);

  // Keep ?scenario= present on affected routes so links stay shareable.
  useEffect(() => {
    if (!affected) return;
    if ((urlScenario ?? undefined) === scenarioId) return;
    const params = new URLSearchParams(searchParams.toString());
    if (scenarioId) params.set('scenario', scenarioId);
    else params.delete('scenario');
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- write URL when selection changes
  }, [scenarioId, pathname, affected]);

  return null;
}

export function ScenarioProvider({ children }: { children: React.ReactNode }) {
  const [scenarioId, setScenarioIdState] = useState<string | undefined>(undefined);
  const { data: scenarios } = useScenarios();

  useEffect(() => {
    const stored = localStorage.getItem(SCENARIO_KEY);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration-safe localStorage init
    if (stored) setScenarioIdState(stored);
  }, []);

  const setScenarioId = useCallback((id: string | undefined) => {
    setScenarioIdState(id);
    if (id) localStorage.setItem(SCENARIO_KEY, id);
    else localStorage.removeItem(SCENARIO_KEY);
  }, []);

  // A stored id whose scenario no longer exists is treated as baseline
  // (derived at render; only the external localStorage copy is cleaned up).
  const isStale = !!scenarioId && !!scenarios && !scenarios.some((s) => s.id === scenarioId);
  const effectiveScenarioId = isStale ? undefined : scenarioId;

  useEffect(() => {
    if (isStale) localStorage.removeItem(SCENARIO_KEY);
  }, [isStale]);

  const active = effectiveScenarioId
    ? scenarios?.find((s) => s.id === effectiveScenarioId)
    : undefined;
  const activeScenarioName = active && !active.is_base ? active.name : null;

  return (
    <ScenarioContext.Provider
      value={{ scenarioId: effectiveScenarioId, setScenarioId, activeScenarioName }}
    >
      <Suspense fallback={null}>
        <ScenarioUrlSync scenarioId={effectiveScenarioId} setFromUrl={setScenarioId} />
      </Suspense>
      {children}
    </ScenarioContext.Provider>
  );
}
