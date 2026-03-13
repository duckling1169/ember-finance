'use client';

import { useState } from 'react';
import { useFlash } from '@/lib/use-flash';
import { Card, CardHeader, CardTitle, CardAction, CardContent } from '@/components/ui/card';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Alert } from '@/components/ui/alert';
import { IconPlus, IconPencil, IconTrash, IconCheck, IconX } from '@tabler/icons-react';
import { SortIcon, type SortDir } from '@/components/common/sort-icon';

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

type SortKey = 'name' | 'type' | 'gross_amount' | 'frequency';

const columns: { key: SortKey; label: string; align?: 'right' }[] = [
  { key: 'name', label: 'Name' },
  { key: 'type', label: 'Type' },
  { key: 'gross_amount', label: 'Amount', align: 'right' },
  { key: 'frequency', label: 'Frequency' },
];

interface IncomeSourcesCardProps {
  memberId: string;
}

export function IncomeSourcesCard({ memberId }: IncomeSourcesCardProps) {
  const { data: sources, isLoading } = useIncomeSources();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const { flash, show: showFlash } = useFlash();

  const memberSources = (sources ?? []).filter((s) => s.member_id === memberId);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'gross_amount' ? 'desc' : 'asc');
    }
  }

  const sorted = [...memberSources].sort((a, b) => {
    let aVal: string | number;
    let bVal: string | number;
    switch (sortKey) {
      case 'name':
        aVal = a.name.toLowerCase();
        bVal = b.name.toLowerCase();
        break;
      case 'type':
        aVal = a.type;
        bVal = b.type;
        break;
      case 'gross_amount':
        aVal = a.gross_amount;
        bVal = b.gross_amount;
        break;
      case 'frequency':
        aVal = a.frequency;
        bVal = b.frequency;
        break;
    }
    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    }
    return sortDir === 'asc' ? Number(aVal) - Number(bVal) : Number(bVal) - Number(aVal);
  });

  // Separate editing item from table rows
  const editingSource = editingId ? sorted.find((s) => s.id === editingId) : undefined;
  const tableRows = sorted.filter((s) => s.id !== editingId);

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
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => setAdding(true)}
              aria-label="Add income source"
            >
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

        {tableRows.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map((col) => (
                  <TableHead
                    key={col.key}
                    className={`cursor-pointer select-none hover:text-foreground transition-colors ${col.align === 'right' ? 'text-right' : ''}`}
                    onClick={() => toggleSort(col.key)}
                  >
                    <span className="inline-flex items-center gap-1">
                      {col.label}
                      <SortIcon field={col.key} sortKey={sortKey} sortDir={sortDir} />
                    </span>
                  </TableHead>
                ))}
                <TableHead className="w-16" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {tableRows.map((src) => (
                <TableRow key={src.id}>
                  <TableCell className="font-medium">{src.name}</TableCell>
                  <TableCell>{TYPE_LABELS[src.type]}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {fmt(src.gross_amount)}
                  </TableCell>
                  <TableCell>{FREQ_LABELS[src.frequency]}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => setEditingId(src.id)}
                        aria-label={`Edit ${src.name}`}
                      >
                        <IconPencil size={14} stroke={1.5} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => handleDelete(src.id)}
                        aria-label={`Delete ${src.name}`}
                      >
                        <IconTrash size={14} stroke={1.5} />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {editingSource && (
          <InlineForm
            key={editingSource.id}
            memberId={memberId}
            initial={editingSource}
            saving={saving}
            onSave={(data) => handleUpdate(editingSource.id, data)}
            onCancel={() => setEditingId(null)}
          />
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
        <Button
          type="submit"
          variant="ghost"
          size="icon-xs"
          disabled={saving}
          aria-label="Save income source"
        >
          <IconCheck size={14} stroke={1.5} className="text-primary" />
        </Button>
        <Button type="button" variant="ghost" size="icon-xs" onClick={onCancel} aria-label="Cancel">
          <IconX size={14} stroke={1.5} />
        </Button>
      </div>
    </form>
  );
}
