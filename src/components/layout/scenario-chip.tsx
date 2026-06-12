'use client';

import { useEffect, useState } from 'react';
import { IconChevronDown, IconCheck, IconPlus, IconVersions } from '@tabler/icons-react';
import { cn } from '@/lib/utils';
import { useScenario } from '@/lib/scenario-context';
import { useScenarios, mutateScenarios } from '@/lib/swr';
import { createScenario } from '@/lib/api';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

/**
 * Persistent global scenario indicator (design principle 4). Quiet outline chip
 * on baseline; filled violet (--scenario) when a non-base scenario is active so
 * scenario output can never be mistaken for baseline. The menu states which
 * data is scenario-specific vs shared.
 */
export function ScenarioChip({ className }: { className?: string }) {
  const { scenarioId, setScenarioId, activeScenarioName } = useScenario();
  const { data: scenarios } = useScenarios();
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const nonBase = scenarios?.filter((s) => !s.is_base) ?? [];

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setSaving(true);
    setCreateError(null);
    try {
      const created = await createScenario({ name: newName.trim() });
      await mutateScenarios();
      setScenarioId(created.id);
      setAdding(false);
      setNewName('');
      setOpen(false);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create scenario');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={cn('relative', className)}>
      <button
        onClick={() => setOpen((p) => !p)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(
          'inline-flex h-7 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors',
          activeScenarioName
            ? 'border-scenario bg-scenario/15 text-scenario'
            : 'border-border text-muted-foreground hover:text-foreground',
        )}
      >
        <IconVersions size={14} />
        {activeScenarioName ? `Scenario: ${activeScenarioName}` : 'Base scenario'}
        <IconChevronDown size={12} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            role="menu"
            className="absolute right-0 top-full z-50 mt-1 w-72 rounded-md border border-border bg-popover py-1 shadow-md"
          >
            <ScenarioOption
              label="Base scenario"
              selected={!scenarioId}
              onSelect={() => {
                setScenarioId(undefined);
                setOpen(false);
              }}
            />
            {nonBase.map((s) => (
              <ScenarioOption
                key={s.id}
                label={s.name}
                selected={scenarioId === s.id}
                scenario
                onSelect={() => {
                  setScenarioId(s.id);
                  setOpen(false);
                }}
              />
            ))}
            <div className="mx-2 my-1 h-px bg-border" />
            {adding ? (
              <form onSubmit={handleCreate} className="space-y-1.5 px-3 py-1.5">
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  aria-label="New scenario name"
                  placeholder="e.g. Retire at 50"
                  className="h-7 text-xs"
                  autoFocus
                />
                {createError && (
                  <Alert size="sm" onDismiss={() => setCreateError(null)}>
                    {createError}
                  </Alert>
                )}
                <div className="flex justify-end gap-1.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setAdding(false);
                      setNewName('');
                      setCreateError(null);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" variant="secondary" size="sm" disabled={saving}>
                    {saving ? 'Creating…' : 'Create scenario'}
                  </Button>
                </div>
              </form>
            ) : (
              <button
                role="menuitem"
                onClick={() => setAdding(true)}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
              >
                <IconPlus size={14} />
                New scenario
              </button>
            )}
            <div className="mx-2 my-1 h-px bg-border" />
            <p className="px-3 py-1.5 text-xs text-muted-foreground">
              Scenarios change{' '}
              <span className="text-foreground">Flows, Planning, and Assumption overrides</span>.
              Accounts, holdings, activity, and budget are shared across all scenarios.
            </p>
          </div>
        </>
      )}
    </div>
  );
}

function ScenarioOption({
  label,
  selected,
  scenario = false,
  onSelect,
}: {
  label: string;
  selected: boolean;
  scenario?: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      role="menuitemradio"
      aria-checked={selected}
      onClick={onSelect}
      className="flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors hover:bg-muted/50"
    >
      <span className="flex h-4 w-4 items-center justify-center">
        {selected && (
          <IconCheck size={14} className={scenario ? 'text-scenario' : 'text-primary'} />
        )}
      </span>
      <span className={cn('flex-1 text-left', scenario && 'text-scenario')}>{label}</span>
    </button>
  );
}
