'use client';

import { useState } from 'react';
import { useScenarios, mutateScenarios } from '@/lib/swr';
import { createScenario } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { IconPlus, IconCheck, IconX } from '@tabler/icons-react';

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
        <Button type="submit" variant="ghost" size="icon-xs" disabled={saving}>
          <IconCheck size={14} stroke={1.5} className="text-primary" />
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
        <Select
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value || undefined)}
          className={`h-8 w-auto ${className ?? ''}`}
        >
          <option value="">Base scenario</option>
          {scenarios
            .filter((s) => !s.is_base)
            .map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
        </Select>
      )}
      <Button variant="ghost" size="icon-xs" onClick={() => setAdding(true)} title="New scenario">
        <IconPlus size={14} stroke={1.5} />
      </Button>
    </div>
  );
}
