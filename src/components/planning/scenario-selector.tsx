'use client';

import { useState } from 'react';
import { useScenarios, mutateScenarios } from '@/lib/swr';
import { createScenario } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { IconPlus, IconCheck, IconX } from '@tabler/icons-react';
import { cn } from '@/lib/utils';

interface ScenarioSelectorProps {
  value: string | undefined;
  onChange: (scenarioId: string | undefined) => void;
  className?: string;
}

export function ScenarioSelector({ value, onChange, className }: ScenarioSelectorProps) {
  const { data: scenarios } = useScenarios();
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setSaving(true);
    try {
      const created = await createScenario({ name: newName.trim() });
      await mutateScenarios();
      onChange(created.id);
      setAdding(false);
      setNewName('');
    } catch {
      // silently fail — scenario selector is secondary UI
    } finally {
      setSaving(false);
    }
  }

  if (adding) {
    return (
      <form onSubmit={handleCreate} className="flex items-center gap-1">
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Scenario name"
          className="h-7 w-[140px] text-xs"
          autoFocus
        />
        <Button type="submit" size="icon-xs" disabled={saving}>
          <IconCheck size={14} stroke={1.5} />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={() => {
            setAdding(false);
            setNewName('');
          }}
        >
          <IconX size={14} stroke={1.5} />
        </Button>
      </form>
    );
  }

  return (
    <div className="flex items-center gap-1">
      {scenarios && scenarios.length > 0 && (
        <select
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value || undefined)}
          className={cn(
            'rounded-md border border-border bg-card px-3 py-1.5 text-sm text-foreground',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
            className,
          )}
        >
          <option value="">Base scenario</option>
          {scenarios
            .filter((s) => !s.is_base)
            .map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
        </select>
      )}
      <Button variant="ghost" size="icon-xs" onClick={() => setAdding(true)} title="New scenario">
        <IconPlus size={14} stroke={1.5} />
      </Button>
    </div>
  );
}
