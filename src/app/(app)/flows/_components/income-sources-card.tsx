'use client';

import { useState } from 'react';
import { useToast } from '@/components/ui/toast';
import { Card, CardHeader, CardTitle, CardAction, CardContent } from '@/components/ui/card';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Alert } from '@/components/ui/alert';
import { FormField } from '@/components/ui/form-field';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { IconPlus, IconPencil, IconTrash } from '@tabler/icons-react';

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
  const { data: sources, isLoading, error: fetchError } = useIncomeSources();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingSource, setEditingSource] = useState<IncomeSource | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<IncomeSource | null>(null);
  const [saving, setSaving] = useState(false);
  const [cardError, setCardError] = useState<string | null>(null);
  const toast = useToast();

  const memberSources = (sources ?? []).filter((s) => s.member_id === memberId);

  function openAdd() {
    setEditingSource(null);
    setSheetOpen(true);
  }

  function openEdit(source: IncomeSource) {
    setEditingSource(source);
    setSheetOpen(true);
  }

  // Throws on failure so the sheet can show the error inline.
  async function handleSave(data: CreateIncomeSourceInput) {
    setSaving(true);
    try {
      if (editingSource) {
        await updateIncomeSource(editingSource.id, data);
      } else {
        await createIncomeSource(data);
      }
      await Promise.all([mutateIncomeSources(), mutatePlanningComputed()]);
      toast('success', editingSource ? 'Income source updated' : 'Income source added');
      setSheetOpen(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      await deleteIncomeSource(deleteTarget.id);
      await Promise.all([mutateIncomeSources(), mutatePlanningComputed()]);
      toast('success', 'Income source deleted');
    } catch (err) {
      setCardError(err instanceof Error ? err.message : 'Failed to delete income source');
    } finally {
      setSaving(false);
      setDeleteTarget(null);
    }
  }

  const columns: DataTableColumn<IncomeSource>[] = [
    {
      key: 'name',
      header: 'Name',
      priority: 1,
      sortValue: (s) => s.name.toLowerCase(),
      cell: (s) => <span className="font-medium">{s.name}</span>,
    },
    {
      key: 'type',
      header: 'Type',
      priority: 2,
      sortValue: (s) => s.type,
      cell: (s) => TYPE_LABELS[s.type],
    },
    {
      key: 'gross_amount',
      header: 'Amount',
      numeric: true,
      priority: 1,
      sortValue: (s) => s.gross_amount,
      cell: (s) => fmt(s.gross_amount),
    },
    {
      key: 'frequency',
      header: 'Frequency',
      priority: 2,
      sortValue: (s) => s.frequency,
      cell: (s) => FREQ_LABELS[s.frequency],
    },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      align: 'right',
      priority: 1,
      cell: (s) => (
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Edit ${s.name}`}
            onClick={() => openEdit(s)}
          >
            <IconPencil size={14} stroke={1.5} />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Delete ${s.name}`}
            onClick={() => setDeleteTarget(s)}
          >
            <IconTrash size={14} stroke={1.5} />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>Income Sources</CardTitle>
        <CardAction>
          <Button variant="primary" size="sm" onClick={openAdd}>
            <IconPlus size={14} stroke={1.5} />
            Add income source
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-2">
        {cardError && (
          <Alert variant="error" size="sm" onDismiss={() => setCardError(null)}>
            {cardError}
          </Alert>
        )}
        <DataTable
          columns={columns}
          rows={memberSources}
          rowKey={(s) => s.id}
          density="compact"
          mobile="priority"
          defaultSort={{ key: 'name', dir: 'asc' }}
          loading={isLoading}
          error={fetchError ? { message: 'Failed to load income sources.' } : null}
          empty={{
            title: 'No income sources yet',
            description: 'Add one to see your money flows.',
            action: (
              <Button variant="secondary" size="sm" onClick={openAdd}>
                <IconPlus size={14} stroke={1.5} />
                Add income source
              </Button>
            ),
          }}
        />
      </CardContent>

      <IncomeSourceForm
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        memberId={memberId}
        initial={editingSource}
        saving={saving}
        onSave={handleSave}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title={`Delete income source "${deleteTarget?.name}"?`}
        description="Allocations funded by this source will lose the link and draw from any income instead. If a percent-of-income allocation references it, the delete will fail — those allocations require an income source."
        confirmLabel="Delete income source"
        busy={saving}
        onConfirm={handleConfirmDelete}
      />
    </Card>
  );
}

interface IncomeSourceFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  memberId: string;
  /** When set, the sheet edits this source; otherwise it creates a new one. */
  initial?: IncomeSource | null;
  saving: boolean;
  /** Must throw on failure — the error is shown in an Alert inside the sheet. */
  onSave: (data: CreateIncomeSourceInput) => Promise<void>;
}

function IncomeSourceForm({
  open,
  onOpenChange,
  memberId,
  initial,
  saving,
  onSave,
}: IncomeSourceFormProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right">
        {open && (
          <IncomeSourceFormBody
            key={initial?.id ?? 'new'}
            onOpenChange={onOpenChange}
            memberId={memberId}
            initial={initial}
            saving={saving}
            onSave={onSave}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

// Mounted only while the sheet is open and remounted (via key) when the editing
// target changes, so all form state initializes fresh from `initial`.
function IncomeSourceFormBody({
  onOpenChange,
  memberId,
  initial,
  saving,
  onSave,
}: Omit<IncomeSourceFormProps, 'open'>) {
  const [name, setName] = useState(initial?.name ?? '');
  const [type, setType] = useState<IncomeSourceType>(initial?.type ?? 'employment');
  const [amount, setAmount] = useState(
    initial?.gross_amount != null ? String(initial.gross_amount) : '',
  );
  const [frequency, setFrequency] = useState<CashflowFrequency>(initial?.frequency ?? 'annual');
  const [nameError, setNameError] = useState<string | null>(null);
  const [amountError, setAmountError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const isEditing = !!initial;

  function validateName(value: string): string | null {
    return value.trim() ? null : 'Name is required';
  }

  function validateAmount(value: string): string | null {
    const parsed = parseFloat(value);
    return !isNaN(parsed) && parsed > 0 ? null : 'Amount must be greater than 0';
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const nErr = validateName(name);
    const aErr = validateAmount(amount);
    setNameError(nErr);
    setAmountError(aErr);
    if (nErr || aErr) return;

    setSubmitError(null);
    try {
      await onSave({
        member_id: memberId,
        name: name.trim(),
        type,
        gross_amount: parseFloat(amount),
        frequency,
      });
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to save income source');
    }
  }

  return (
    <>
      <SheetHeader>
        <SheetTitle>{isEditing ? 'Edit income source' : 'Add income source'}</SheetTitle>
        <SheetDescription>
          {isEditing
            ? 'Update this income source. Changes apply to your money flows immediately.'
            : 'Add a source of income to see it in your money flows.'}
        </SheetDescription>
      </SheetHeader>
      <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
        <div className="flex-1 space-y-4 overflow-y-auto px-4">
          {submitError && (
            <Alert variant="error" onDismiss={() => setSubmitError(null)}>
              {submitError}
            </Alert>
          )}
          <FormField label="Name" htmlFor="income-source-name" required error={nameError}>
            <Input
              id="income-source-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (nameError && e.target.value.trim()) setNameError(null);
              }}
              onBlur={() => setNameError(validateName(name))}
              aria-invalid={!!nameError}
              placeholder="Job title"
              autoFocus
            />
          </FormField>
          <FormField label="Type" htmlFor="income-source-type">
            <Select
              id="income-source-type"
              value={type}
              onChange={(e) => setType(e.target.value as IncomeSourceType)}
            >
              {INCOME_SOURCE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {TYPE_LABELS[t]}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Amount" htmlFor="income-source-amount" required error={amountError}>
            <Input
              id="income-source-amount"
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                if (amountError && !validateAmount(e.target.value)) setAmountError(null);
              }}
              onBlur={() => setAmountError(validateAmount(amount))}
              aria-invalid={!!amountError}
              placeholder="0.00"
              className="font-mono"
            />
          </FormField>
          <FormField label="Frequency" htmlFor="income-source-frequency">
            <Select
              id="income-source-frequency"
              value={frequency}
              onChange={(e) => setFrequency(e.target.value as CashflowFrequency)}
            >
              {CASHFLOW_FREQUENCIES.map((f) => (
                <option key={f} value={f}>
                  {FREQ_LABELS[f]}
                </option>
              ))}
            </Select>
          </FormField>
        </div>
        <SheetFooter className="flex-row justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={saving}>
            {saving ? 'Saving…' : isEditing ? 'Save income source' : 'Add income source'}
          </Button>
        </SheetFooter>
      </form>
    </>
  );
}
