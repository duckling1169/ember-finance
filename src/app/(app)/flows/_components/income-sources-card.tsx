'use client';

import { useState } from 'react';
import { useFlash } from '@/lib/use-flash';
import { Card, CardHeader, CardTitle, CardAction, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Alert } from '@/components/ui/alert';
import { IconPlus, IconPencil, IconTrash, IconCheck, IconX } from '@tabler/icons-react';

import { fmt } from '@/lib/formatters';
import { useIncomeSources, mutateIncomeSources, mutatePlanningComputed } from '@/lib/swr';
import { createIncomeSource, updateIncomeSource, deleteIncomeSource } from '@/lib/api';
import type {
  IncomeSource,
  IncomeSourceType,
  CashflowFrequency,
  CreateIncomeSourceInput,
} from '@shared/types';
import { INCOME_SOURCE_TYPES, CASHFLOW_FREQUENCIES } from '@shared/types';

const TYPE_LABELS: Record<IncomeSourceType, string> = {
  employment: 'Employment',
  self_employment: 'Self-employment',
  passive: 'Passive',
  other: 'Other',
};

const FREQ_LABELS: Record<CashflowFrequency, string> = {
  monthly: 'Monthly',
  biweekly: 'Biweekly',
  annual: 'Annual',
  one_time: 'One-time',
};

interface IncomeSourcesCardProps {
  memberId: string;
}

export function IncomeSourcesCard({ memberId }: IncomeSourcesCardProps) {
  const { data: sources, isLoading } = useIncomeSources();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const { flash, show: showFlash } = useFlash();

  const memberSources = (sources ?? []).filter((s) => s.member_id === memberId);

  async function handleCreate(data: CreateIncomeSourceInput) {
    setSaving(true);
    try {
      await createIncomeSource(data);
      await Promise.all([mutateIncomeSources(), mutatePlanningComputed()]);
      setAdding(false);
    } catch (err) {
      showFlash('error', err instanceof Error ? err.message : 'Failed to create income source');
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdate(id: string, data: Partial<IncomeSource>) {
    setSaving(true);
    try {
      await updateIncomeSource(id, data);
      await Promise.all([mutateIncomeSources(), mutatePlanningComputed()]);
      setEditingId(null);
    } catch (err) {
      showFlash('error', err instanceof Error ? err.message : 'Failed to update income source');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setSaving(true);
    try {
      await deleteIncomeSource(id);
      await Promise.all([mutateIncomeSources(), mutatePlanningComputed()]);
    } catch (err) {
      showFlash('error', err instanceof Error ? err.message : 'Failed to delete income source');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>Income Sources</CardTitle>
        <CardAction>
          {!adding && (
            <Button variant="ghost" size="icon-xs" onClick={() => setAdding(true)}>
              <IconPlus size={14} stroke={1.5} />
            </Button>
          )}
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-1">
        {flash && (
          <Alert variant={flash.type === 'error' ? 'error' : 'success'} size="sm">
            {flash.message}
          </Alert>
        )}

        {isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}

        {!isLoading && memberSources.length === 0 && !adding && (
          <p className="text-sm text-muted-foreground">
            No income sources yet. Add one to see your money flows.
          </p>
        )}

        {memberSources.map((src) =>
          editingId === src.id ? (
            <InlineForm
              key={src.id}
              memberId={memberId}
              initial={src}
              saving={saving}
              onSave={(data) => handleUpdate(src.id, data)}
              onCancel={() => setEditingId(null)}
            />
          ) : (
            <SourceRow
              key={src.id}
              source={src}
              onEdit={() => setEditingId(src.id)}
              onDelete={() => handleDelete(src.id)}
            />
          ),
        )}

        {adding && (
          <InlineForm
            memberId={memberId}
            saving={saving}
            onSave={handleCreate}
            onCancel={() => setAdding(false)}
          />
        )}
      </CardContent>
    </Card>
  );
}

function SourceRow({
  source,
  onEdit,
  onDelete,
}: {
  source: IncomeSource;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted/50">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{source.name}</span>
          <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
            {TYPE_LABELS[source.type]}
          </span>
        </div>
        <div className="text-xs text-muted-foreground">
          <span className="font-mono tabular-nums">{fmt(source.gross_amount)}</span>{' '}
          {FREQ_LABELS[source.frequency].toLowerCase()}
        </div>
      </div>
      <div className="flex shrink-0 gap-1">
        <Button variant="ghost" size="icon-xs" onClick={onEdit}>
          <IconPencil size={14} stroke={1.5} />
        </Button>
        <Button variant="ghost" size="icon-xs" onClick={onDelete}>
          <IconTrash size={14} stroke={1.5} />
        </Button>
      </div>
    </div>
  );
}

function InlineForm({
  memberId,
  initial,
  saving,
  onSave,
  onCancel,
}: {
  memberId: string;
  initial?: IncomeSource;
  saving: boolean;
  onSave: (data: CreateIncomeSourceInput) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [type, setType] = useState<IncomeSourceType>(initial?.type ?? 'employment');
  const [amount, setAmount] = useState(initial?.gross_amount?.toString() ?? '');
  const [frequency, setFrequency] = useState<CashflowFrequency>(initial?.frequency ?? 'annual');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = parseFloat(amount);
    if (!name.trim() || isNaN(parsed) || parsed <= 0) return;
    onSave({ member_id: memberId, name: name.trim(), type, gross_amount: parsed, frequency });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-wrap items-end gap-2 rounded-md bg-muted/30 p-2"
    >
      <div className="min-w-[120px] flex-1">
        <label className="text-xs text-muted-foreground">Name</label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Job title"
          className="h-7 text-xs"
        />
      </div>
      <div className="w-[120px]">
        <label className="text-xs text-muted-foreground">Type</label>
        <Select
          value={type}
          onChange={(e) => setType(e.target.value as IncomeSourceType)}
          className="h-7 px-2 text-xs"
        >
          {INCOME_SOURCE_TYPES.map((t) => (
            <option key={t} value={t}>
              {TYPE_LABELS[t]}
            </option>
          ))}
        </Select>
      </div>
      <div className="w-[100px]">
        <label className="text-xs text-muted-foreground">Amount</label>
        <Input
          type="number"
          step="0.01"
          min="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.00"
          className="h-7 text-xs font-mono"
        />
      </div>
      <div className="w-[100px]">
        <label className="text-xs text-muted-foreground">Frequency</label>
        <Select
          value={frequency}
          onChange={(e) => setFrequency(e.target.value as CashflowFrequency)}
          className="h-7 px-2 text-xs"
        >
          {CASHFLOW_FREQUENCIES.map((f) => (
            <option key={f} value={f}>
              {FREQ_LABELS[f]}
            </option>
          ))}
        </Select>
      </div>
      <div className="flex h-7 items-center gap-1">
        <Button type="submit" variant="ghost" size="icon-xs" disabled={saving}>
          <IconCheck size={14} stroke={1.5} className="text-primary" />
        </Button>
        <Button type="button" variant="ghost" size="icon-xs" onClick={onCancel}>
          <IconX size={14} stroke={1.5} />
        </Button>
      </div>
    </form>
  );
}
