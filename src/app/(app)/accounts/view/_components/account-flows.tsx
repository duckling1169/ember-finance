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
import { TAX_TREATMENT_LABELS } from '@/lib/constants';
import {
  useCashflowItems,
  mutateCashflowItems,
  mutatePlanningComputed,
  useIncomeSources,
  useAccounts,
} from '@/lib/swr';
import { createCashflowItem, updateCashflowItem, deleteCashflowItem } from '@/lib/api';
import type {
  CashflowItem,
  CashflowBucket,
  CashflowFrequency,
  CreateCashflowItemInput,
} from '@shared/types';
import { CASHFLOW_FREQUENCIES } from '@shared/types';

const FREQ_LABELS: Record<CashflowFrequency, string> = {
  monthly: 'Monthly',
  biweekly: 'Biweekly',
  annual: 'Annual',
  one_time: 'One-time',
};

const BUCKET_OPTIONS: { value: CashflowBucket; label: string }[] = [
  { value: 'savings', label: 'Savings' },
  { value: 'employer_match', label: 'Employer match' },
];

function bucketToDirection(bucket: CashflowBucket): 'inflow' | 'outflow' {
  return bucket === 'employer_match' ? 'inflow' : 'outflow';
}

interface FlowFormValues {
  name: string;
  bucket: CashflowBucket;
  amount: number;
  frequency: CashflowFrequency;
  income_source_id: string | null;
  source_account_id: string | null;
}

interface AccountFlowsProps {
  accountId: string;
  taxTreatment?: string;
  memberId?: string;
}

export function AccountFlows({ accountId, taxTreatment: accountTax, memberId }: AccountFlowsProps) {
  const { data: allItems, isLoading, error: fetchError } = useCashflowItems();
  const { data: incomeSources } = useIncomeSources();
  const { data: accounts } = useAccounts();
  const [sheetOpen, setSheetOpen] = useState(false);
  // Remount key so the sheet form re-initializes from props on every open.
  const [sheetKey, setSheetKey] = useState(0);
  const [editingItem, setEditingItem] = useState<CashflowItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CashflowItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [cardError, setCardError] = useState<string | null>(null);
  const toast = useToast();

  // Items flowing into or out of this account
  const accountItems = (allItems ?? []).filter(
    (ci) => ci.destination_account_id === accountId || ci.source_account_id === accountId,
  );

  const sourceMap = new Map((incomeSources ?? []).map((s) => [s.id, s]));
  const accountMap = new Map((accounts ?? []).map((a) => [a.id, a]));

  function openAdd() {
    setEditingItem(null);
    setSheetKey((k) => k + 1);
    setSheetOpen(true);
  }

  function openEdit(item: CashflowItem) {
    setEditingItem(item);
    setSheetKey((k) => k + 1);
    setSheetOpen(true);
  }

  // Throws on failure so the sheet can show the error inline.
  async function handleSave(values: FlowFormValues) {
    setSaving(true);
    try {
      if (editingItem) {
        await updateCashflowItem(editingItem.id, {
          name: values.name,
          bucket: values.bucket,
          direction: bucketToDirection(values.bucket),
          amount: values.amount,
          frequency: values.frequency,
          income_source_id: values.income_source_id,
          source_account_id: values.source_account_id,
        });
      } else {
        const data: CreateCashflowItemInput = {
          member_id: memberId || null,
          name: values.name,
          direction: bucketToDirection(values.bucket),
          bucket: values.bucket,
          amount: values.amount,
          frequency: values.frequency,
          start_date: new Date().toISOString().slice(0, 10),
          destination_account_id: accountId,
          income_source_id: values.income_source_id,
          source_account_id: values.source_account_id,
        };
        await createCashflowItem(data);
      }
      await Promise.all([mutateCashflowItems(), mutatePlanningComputed()]);
      toast('success', editingItem ? 'Flow updated' : 'Flow added');
      setSheetOpen(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      await deleteCashflowItem(deleteTarget.id);
      await Promise.all([mutateCashflowItems(), mutatePlanningComputed()]);
      toast('success', 'Flow removed');
    } catch (err) {
      setCardError(err instanceof Error ? err.message : 'Failed to remove flow');
    } finally {
      setSaving(false);
      setDeleteTarget(null);
    }
  }

  function getSourceLabel(item: CashflowItem): string {
    if (item.income_source_id) {
      const src = sourceMap.get(item.income_source_id);
      return src ? src.name : 'Income source';
    }
    if (item.source_account_id) {
      const acct = accountMap.get(item.source_account_id);
      return acct ? acct.name : 'Account';
    }
    return '';
  }

  const columns: DataTableColumn<CashflowItem>[] = [
    {
      key: 'name',
      header: 'Name',
      priority: 1,
      sortValue: (item) => item.name.toLowerCase(),
      cell: (item) => <span className="font-medium">{item.name}</span>,
    },
    {
      key: 'type',
      header: 'Type',
      priority: 2,
      cell: (item) => {
        const bucketLabel = item.bucket === 'employer_match' ? 'Employer' : 'Savings';
        const taxLabel = accountTax ? TAX_TREATMENT_LABELS[accountTax] : undefined;
        const badge = item.bucket === 'employer_match' ? 'Employer' : (taxLabel ?? bucketLabel);
        return (
          <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
            {badge}
          </span>
        );
      },
    },
    {
      key: 'amount',
      header: 'Amount',
      align: 'right',
      priority: 1,
      sortValue: (item) => item.amount,
      cell: (item) => (
        <>
          <span className="font-mono tabular-nums">
            {item.amount_type === 'percent' ? `${item.amount}%` : fmt(item.amount)}
          </span>{' '}
          <span className="text-muted-foreground">
            {item.amount_type === 'percent'
              ? 'of income'
              : FREQ_LABELS[item.frequency]?.toLowerCase()}
          </span>
        </>
      ),
    },
    {
      key: 'source',
      header: 'Source',
      priority: 2,
      cell: (item) => {
        const label = getSourceLabel(item);
        if (!label) return <span className="text-muted-foreground">&mdash;</span>;
        const direction = item.destination_account_id === accountId ? 'from' : 'to';
        return (
          <span className="text-muted-foreground">
            {direction} {label}
          </span>
        );
      },
    },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      align: 'right',
      priority: 1,
      cell: (item) => (
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Edit ${item.name}`}
            onClick={() => openEdit(item)}
          >
            <IconPencil size={14} stroke={1.5} />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Remove ${item.name}`}
            onClick={() => setDeleteTarget(item)}
          >
            <IconTrash size={14} stroke={1.5} />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Flows</CardTitle>
        <CardAction>
          <Button variant="primary" size="sm" onClick={openAdd}>
            <IconPlus size={14} stroke={1.5} />
            Add flow
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
          rows={accountItems}
          rowKey={(item) => item.id}
          density="compact"
          mobile="priority"
          loading={isLoading}
          error={fetchError ? { message: 'Failed to load flows.' } : null}
          empty={{
            title: 'No flows configured for this account.',
            action: (
              <Button variant="secondary" size="sm" onClick={openAdd}>
                <IconPlus size={14} stroke={1.5} />
                Add a flow
              </Button>
            ),
          }}
        />
      </CardContent>

      <FlowFormSheet
        key={sheetKey}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        item={editingItem}
        incomeSources={incomeSources ?? []}
        accounts={(accounts ?? []).filter((a) => a.id !== accountId)}
        saving={saving}
        onSave={handleSave}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title={`Remove flow "${deleteTarget?.name}"?`}
        description="This flow will stop feeding planning and money-flow calculations."
        confirmLabel="Remove flow"
        busy={saving}
        onConfirm={handleConfirmDelete}
      />
    </Card>
  );
}

// ── Flow Form Sheet ──

function FlowFormSheet({
  open,
  onOpenChange,
  item,
  incomeSources,
  accounts,
  saving,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When set, the sheet edits this flow; otherwise it creates a new one. */
  item?: CashflowItem | null;
  incomeSources: { id: string; name: string }[];
  accounts: { id: string; name: string }[];
  saving: boolean;
  /** Must throw on failure — the error is shown in an Alert inside the sheet. */
  onSave: (values: FlowFormValues) => Promise<void>;
}) {
  const isEditing = !!item;

  // The parent remounts this component (via key) on every open, so initial
  // state derived from `item` is always fresh.
  const [name, setName] = useState(item?.name ?? '');
  const [bucket, setBucket] = useState<CashflowBucket>(item?.bucket ?? 'savings');
  const [amount, setAmount] = useState(item?.amount != null ? String(item.amount) : '');
  const [frequency, setFrequency] = useState<CashflowFrequency>(item?.frequency ?? 'monthly');
  const [sourceType, setSourceType] = useState<'income' | 'account'>(
    item?.source_account_id && !item?.income_source_id ? 'account' : 'income',
  );
  const [sourceId, setSourceId] = useState(item?.income_source_id || item?.source_account_id || '');
  const [nameError, setNameError] = useState<string | null>(null);
  const [amountError, setAmountError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  function validateName(value: string): string | null {
    return value.trim() ? null : 'Name is required';
  }

  function validateAmount(value: string): string | null {
    const parsed = parseFloat(value);
    return !isNaN(parsed) && parsed > 0 ? null : 'Amount must be greater than 0';
  }

  function handleSourceTypeChange(newType: 'income' | 'account') {
    setSourceType(newType);
    setSourceId(''); // Reset selection when switching types
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
        name,
        bucket,
        amount: parseFloat(amount),
        frequency,
        income_source_id: sourceType === 'income' ? sourceId || null : null,
        source_account_id: sourceType === 'account' ? sourceId || null : null,
      });
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to save flow');
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>{isEditing ? 'Edit flow' : 'Add flow'}</SheetTitle>
          <SheetDescription>
            {isEditing
              ? 'Update this flow. Changes apply to planning and money-flow calculations immediately.'
              : 'Add a recurring flow into or out of this account.'}
          </SheetDescription>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 space-y-4 overflow-y-auto px-4">
            {submitError && (
              <Alert variant="error" onDismiss={() => setSubmitError(null)}>
                {submitError}
              </Alert>
            )}
            <FormField label="Name" htmlFor="flow-name" required error={nameError}>
              <Input
                id="flow-name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (nameError && e.target.value.trim()) setNameError(null);
                }}
                onBlur={() => setNameError(validateName(name))}
                aria-invalid={!!nameError}
                placeholder="401k deferral"
                autoFocus
              />
            </FormField>
            <FormField label="Type" htmlFor="flow-bucket">
              <Select
                id="flow-bucket"
                value={bucket}
                onChange={(e) => setBucket(e.target.value as CashflowBucket)}
              >
                {BUCKET_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Amount" htmlFor="flow-amount" required error={amountError}>
              <Input
                id="flow-amount"
                type="number"
                step="0.01"
                min="0.01"
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  if (amountError && !validateAmount(e.target.value)) setAmountError(null);
                }}
                onBlur={() => setAmountError(validateAmount(amount))}
                aria-invalid={!!amountError}
                placeholder="500.00"
                className="font-mono"
              />
            </FormField>
            <FormField label="Frequency" htmlFor="flow-frequency">
              <Select
                id="flow-frequency"
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
            <FormField label="Source" htmlFor="flow-source-type">
              <Select
                id="flow-source-type"
                value={sourceType}
                onChange={(e) => handleSourceTypeChange(e.target.value as 'income' | 'account')}
              >
                <option value="income">From income source</option>
                <option value="account">From account</option>
              </Select>
            </FormField>
            <FormField
              label={sourceType === 'income' ? 'Income Source' : 'Source Account'}
              htmlFor="flow-source-id"
            >
              <Select
                id="flow-source-id"
                value={sourceId}
                onChange={(e) => setSourceId(e.target.value)}
              >
                <option value="">None</option>
                {sourceType === 'income'
                  ? incomeSources.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))
                  : accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
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
              {saving ? 'Saving…' : isEditing ? 'Save flow' : 'Add flow'}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
