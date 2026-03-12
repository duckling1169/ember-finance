'use client';

import { useState } from 'react';
import { useFlash } from '@/lib/use-flash';
import { Card, CardHeader, CardTitle, CardAction, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { IconPlus, IconPencil, IconTrash, IconCheck, IconX } from '@tabler/icons-react';
import { fmt } from '@/lib/formatters';
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
  CashflowFrequency,
  CashflowBucket,
  CreateCashflowItemInput,
} from '@shared/types';
import { CASHFLOW_FREQUENCIES } from '@shared/types';

const FREQ_LABELS: Record<CashflowFrequency, string> = {
  monthly: 'Monthly',
  biweekly: 'Biweekly',
  annual: 'Annual',
  one_time: 'One-time',
};

const TAX_BUCKET_LABELS: Record<string, string> = {
  pre_tax: 'Pre-tax',
  after_tax: 'After-tax',
  tax_free: 'Tax-free',
};

/** Derive the engine bucket from user-facing tax treatment + employer flag */
function deriveBucket(taxTreatment: string, isEmployer: boolean): CashflowBucket {
  if (isEmployer) return 'employer_match';
  if (taxTreatment === 'pre_tax') return 'pre_tax_deduction';
  // Both after_tax and tax_free are post-tax contributions in the waterfall
  return 'post_tax_contribution';
}

/** Reverse: derive user-facing values from engine bucket + stored tax_treatment */
function bucketToTaxTreatment(
  bucket: string,
  storedTaxTreatment?: string,
): { taxTreatment: string; isEmployer: boolean } {
  if (bucket === 'employer_match')
    return { taxTreatment: storedTaxTreatment || 'pre_tax', isEmployer: true };
  if (bucket === 'pre_tax_deduction' || bucket === 'retirement_deferral')
    return { taxTreatment: 'pre_tax', isEmployer: false };
  // For post_tax_contribution, use stored tax_treatment to distinguish after_tax vs tax_free
  return { taxTreatment: storedTaxTreatment || 'after_tax', isEmployer: false };
}

/** Default tax treatment based on account's tax treatment */
function defaultTaxTreatmentForAccount(accountTaxTreatment?: string): string {
  // Map legacy values too
  if (accountTaxTreatment === 'pre_tax' || accountTaxTreatment === 'traditional') return 'pre_tax';
  if (
    accountTaxTreatment === 'tax_free' ||
    accountTaxTreatment === 'roth' ||
    accountTaxTreatment === 'hsa'
  )
    return 'tax_free';
  return 'after_tax';
}

interface AccountFlowsProps {
  accountId: string;
  taxTreatment?: string;
  memberId?: string;
}

export function AccountFlows({ accountId, taxTreatment: accountTax, memberId }: AccountFlowsProps) {
  const { data: allItems, isLoading } = useCashflowItems();
  const { data: incomeSources } = useIncomeSources();
  const { data: accounts } = useAccounts();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const { flash, show: showFlash } = useFlash();

  // Items flowing into or out of this account
  const accountItems = (allItems ?? []).filter(
    (ci) => ci.destination_account_id === accountId || ci.source_account_id === accountId,
  );

  const sourceMap = new Map((incomeSources ?? []).map((s) => [s.id, s]));
  const accountMap = new Map((accounts ?? []).map((a) => [a.id, a]));

  async function handleCreate(form: FormData) {
    setSaving(true);
    try {
      const taxTreatment = form.get('tax_treatment') as string;
      const isEmployer = form.get('is_employer') === 'on';
      const bucket = deriveBucket(taxTreatment, isEmployer);
      const sourceType = form.get('source_type') as string;
      const data: CreateCashflowItemInput = {
        member_id: memberId || null,
        name: form.get('name') as string,
        direction: 'inflow',
        bucket,
        tax_treatment: taxTreatment,
        amount: parseFloat(form.get('amount') as string),
        frequency: form.get('frequency') as CashflowFrequency,
        start_date: new Date().toISOString().slice(0, 10),
        destination_account_id: accountId,
        income_source_id:
          sourceType === 'income' ? (form.get('source_id') as string) || null : null,
        source_account_id:
          sourceType === 'account' ? (form.get('source_id') as string) || null : null,
      };
      await createCashflowItem(data);
      await Promise.all([mutateCashflowItems(), mutatePlanningComputed()]);
      setAdding(false);
      showFlash('success', 'Flow added');
    } catch (err) {
      showFlash('error', err instanceof Error ? err.message : 'Failed to add flow');
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdate(itemId: string, form: FormData) {
    setSaving(true);
    try {
      const taxTreatment = form.get('tax_treatment') as string;
      const isEmployer = form.get('is_employer') === 'on';
      const bucket = deriveBucket(taxTreatment, isEmployer);
      const sourceType = form.get('source_type') as string;
      await updateCashflowItem(itemId, {
        name: form.get('name') as string,
        bucket,
        tax_treatment: taxTreatment,
        amount: parseFloat(form.get('amount') as string),
        frequency: form.get('frequency') as CashflowFrequency,
        income_source_id:
          sourceType === 'income' ? (form.get('source_id') as string) || null : null,
        source_account_id:
          sourceType === 'account' ? (form.get('source_id') as string) || null : null,
      });
      await Promise.all([mutateCashflowItems(), mutatePlanningComputed()]);
      setEditingId(null);
      showFlash('success', 'Flow updated');
    } catch (err) {
      showFlash('error', err instanceof Error ? err.message : 'Failed to update flow');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(itemId: string) {
    try {
      await deleteCashflowItem(itemId);
      await Promise.all([mutateCashflowItems(), mutatePlanningComputed()]);
      showFlash('success', 'Flow removed');
    } catch (err) {
      showFlash('error', err instanceof Error ? err.message : 'Failed to remove flow');
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Flows</CardTitle>
        <CardAction>
          {!adding && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setAdding(true);
                setEditingId(null);
              }}
            >
              <IconPlus size={14} />
            </Button>
          )}
        </CardAction>
      </CardHeader>
      <CardContent>
        {flash && (
          <div
            className={`mb-3 rounded-md px-3 py-2 text-sm ${
              flash.type === 'error' ? 'bg-destructive/10 text-destructive' : 'bg-gain/10 text-gain'
            }`}
          >
            {flash.message}
          </div>
        )}

        {isLoading ? (
          <p className="py-4 text-center text-sm text-muted-foreground">Loading...</p>
        ) : accountItems.length === 0 && !adding ? (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <p className="text-sm text-muted-foreground">No flows configured for this account.</p>
            <button
              onClick={() => setAdding(true)}
              className="text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              Add a flow
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {accountItems.map((item) =>
              editingId === item.id ? (
                <FlowForm
                  key={item.id}
                  item={item}
                  defaultAccountTax={accountTax}
                  incomeSources={incomeSources ?? []}
                  accounts={(accounts ?? []).filter((a) => a.id !== accountId)}
                  saving={saving}
                  onSubmit={(form) => handleUpdate(item.id, form)}
                  onCancel={() => setEditingId(null)}
                />
              ) : (
                <FlowRow
                  key={item.id}
                  item={item}
                  sourceLabel={getSourceLabel(item)}
                  isDestination={item.destination_account_id === accountId}
                  onEdit={() => {
                    setEditingId(item.id);
                    setAdding(false);
                  }}
                  onDelete={() => handleDelete(item.id)}
                />
              ),
            )}
          </div>
        )}

        {adding && (
          <div className={accountItems.length > 0 ? 'mt-3' : ''}>
            <FlowForm
              defaultAccountTax={accountTax}
              incomeSources={incomeSources ?? []}
              accounts={(accounts ?? []).filter((a) => a.id !== accountId)}
              saving={saving}
              onSubmit={(form) => handleCreate(form)}
              onCancel={() => setAdding(false)}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Flow Row ──

function FlowRow({
  item,
  sourceLabel,
  isDestination,
  onEdit,
  onDelete,
}: {
  item: CashflowItem;
  sourceLabel: string;
  isDestination: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { taxTreatment, isEmployer } = bucketToTaxTreatment(item.bucket, item.tax_treatment);
  const treatmentLabel = TAX_BUCKET_LABELS[taxTreatment] || taxTreatment;
  const badge = isEmployer ? 'Employer' : treatmentLabel;
  const direction = isDestination ? 'from' : 'to';

  return (
    <div className="flex items-center justify-between rounded-md border border-border px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate">{item.name}</span>
          <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            {badge}
          </span>
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          <span className="font-mono tabular-nums">{fmt(item.amount)}</span>{' '}
          {FREQ_LABELS[item.frequency]?.toLowerCase()}
          {sourceLabel && (
            <span>
              {' '}
              &middot; {direction} {sourceLabel}
            </span>
          )}
        </p>
      </div>
      <div className="flex items-center gap-1 shrink-0 ml-2">
        <Button variant="ghost" size="sm" onClick={onEdit}>
          <IconPencil size={14} />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive hover:text-destructive"
          onClick={onDelete}
        >
          <IconTrash size={14} />
        </Button>
      </div>
    </div>
  );
}

// ── Flow Form ──

function FlowForm({
  item,
  defaultAccountTax,
  incomeSources,
  accounts,
  saving,
  onSubmit,
  onCancel,
}: {
  item?: CashflowItem;
  defaultAccountTax?: string;
  incomeSources: { id: string; name: string }[];
  accounts: { id: string; name: string }[];
  saving: boolean;
  onSubmit: (form: FormData) => void;
  onCancel: () => void;
}) {
  const existing = item ? bucketToTaxTreatment(item.bucket, item.tax_treatment) : null;
  const defaultTax = existing?.taxTreatment ?? defaultTaxTreatmentForAccount(defaultAccountTax);
  const defaultEmployer = existing?.isEmployer ?? false;

  const defaultSourceType = item?.income_source_id
    ? 'income'
    : item?.source_account_id
      ? 'account'
      : 'income';
  const defaultSourceId = item?.income_source_id || item?.source_account_id || '';

  const [sourceType, setSourceType] = useState(defaultSourceType);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    onSubmit(new FormData(e.currentTarget));
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-md border border-border p-3 space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Name</label>
          <Input name="name" required defaultValue={item?.name || ''} placeholder="401k deferral" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Tax Bucket</label>
          <select
            name="tax_treatment"
            required
            defaultValue={defaultTax}
            className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <option value="pre_tax">Pre-tax</option>
            <option value="after_tax">After-tax</option>
            <option value="tax_free">Tax-free</option>
          </select>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Amount</label>
          <Input
            name="amount"
            type="number"
            step="0.01"
            min="0.01"
            required
            defaultValue={item?.amount || ''}
            placeholder="500.00"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Frequency</label>
          <select
            name="frequency"
            required
            defaultValue={item?.frequency || 'monthly'}
            className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            {CASHFLOW_FREQUENCIES.map((f) => (
              <option key={f} value={f}>
                {FREQ_LABELS[f]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Source</label>
          <select
            name="source_type"
            value={sourceType}
            onChange={(e) => setSourceType(e.target.value)}
            className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <option value="income">From income source</option>
            <option value="account">From account</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            {sourceType === 'income' ? 'Income Source' : 'Source Account'}
          </label>
          <select
            name="source_id"
            defaultValue={defaultSourceId}
            className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
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
          </select>
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="is_employer"
          defaultChecked={defaultEmployer}
          className="rounded border-input"
        />
        <span className="text-muted-foreground">Employer contribution (not from your pay)</span>
      </label>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          <IconX size={14} />
          Cancel
        </Button>
        <Button
          type="submit"
          variant="outline"
          size="sm"
          disabled={saving}
          className="hover:bg-primary hover:text-primary-foreground hover:border-primary"
        >
          <IconCheck size={14} />
          {saving ? 'Saving...' : item ? 'Update' : 'Add Flow'}
        </Button>
      </div>
    </form>
  );
}
