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
import { TAX_BUCKET_LABELS } from '@/lib/constants';
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
  { value: 'saving', label: 'Saving' },
  { value: 'employer_match', label: 'Employer match' },
];

function bucketToDirection(bucket: CashflowBucket): 'inflow' | 'outflow' {
  return bucket === 'employer_match' ? 'inflow' : 'outflow';
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
      const bucket = form.get('bucket') as CashflowBucket;
      const sourceType = form.get('source_type') as string;
      const data: CreateCashflowItemInput = {
        member_id: memberId || null,
        name: form.get('name') as string,
        direction: bucketToDirection(bucket),
        bucket,
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
      const bucket = form.get('bucket') as CashflowBucket;
      const sourceType = form.get('source_type') as string;
      await updateCashflowItem(itemId, {
        name: form.get('name') as string,
        bucket,
        direction: bucketToDirection(bucket),
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
              size="icon-xs"
              onClick={() => {
                setAdding(true);
                setEditingId(null);
              }}
            >
              <IconPlus size={14} stroke={1.5} />
            </Button>
          )}
        </CardAction>
      </CardHeader>
      <CardContent>
        {flash && (
          <Alert variant={flash.type === 'error' ? 'error' : 'success'} size="sm" className="mb-2">
            {flash.message}
          </Alert>
        )}

        {isLoading ? (
          <p className="py-4 text-center text-sm text-muted-foreground">Loading...</p>
        ) : accountItems.length === 0 && !adding ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
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
                  defaultBucket={item.bucket}
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
                  accountTax={accountTax}
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
              defaultBucket="saving"
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
  accountTax,
  onEdit,
  onDelete,
}: {
  item: CashflowItem;
  sourceLabel: string;
  isDestination: boolean;
  accountTax?: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const bucketLabel = item.bucket === 'employer_match' ? 'Employer' : 'Saving';
  const taxLabel = accountTax ? TAX_BUCKET_LABELS[accountTax] : undefined;
  const badge = item.bucket === 'employer_match' ? 'Employer' : (taxLabel ?? bucketLabel);
  const direction = isDestination ? 'from' : 'to';

  return (
    <div className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted/50">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{item.name}</span>
          <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
            {badge}
          </span>
        </div>
        <div className="text-xs text-muted-foreground">
          <span className="font-mono tabular-nums">{fmt(item.amount)}</span>{' '}
          {FREQ_LABELS[item.frequency]?.toLowerCase()}
          {sourceLabel && (
            <span>
              {' '}
              &middot; {direction} {sourceLabel}
            </span>
          )}
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

// ── Flow Form ──

function FlowForm({
  item,
  defaultBucket,
  incomeSources,
  accounts,
  saving,
  onSubmit,
  onCancel,
}: {
  item?: CashflowItem;
  defaultBucket?: CashflowBucket;
  incomeSources: { id: string; name: string }[];
  accounts: { id: string; name: string }[];
  saving: boolean;
  onSubmit: (form: FormData) => void;
  onCancel: () => void;
}) {
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
          <label className="mb-1.5 block text-sm font-medium">Name</label>
          <Input name="name" required defaultValue={item?.name || ''} placeholder="401k deferral" />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium">Type</label>
          <Select name="bucket" required defaultValue={item?.bucket ?? defaultBucket ?? 'saving'}>
            {BUCKET_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-sm font-medium">Amount</label>
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
          <label className="mb-1.5 block text-sm font-medium">Frequency</label>
          <Select name="frequency" required defaultValue={item?.frequency || 'monthly'}>
            {CASHFLOW_FREQUENCIES.map((f) => (
              <option key={f} value={f}>
                {FREQ_LABELS[f]}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-sm font-medium">Source</label>
          <Select
            name="source_type"
            value={sourceType}
            onChange={(e) => setSourceType(e.target.value)}
          >
            <option value="income">From income source</option>
            <option value="account">From account</option>
          </Select>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium">
            {sourceType === 'income' ? 'Income Source' : 'Source Account'}
          </label>
          <Select name="source_id" defaultValue={defaultSourceId}>
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
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          <IconX size={14} stroke={1.5} />
          Cancel
        </Button>
        <Button type="submit" variant="outline" size="sm" disabled={saving}>
          <IconCheck size={14} stroke={1.5} className="text-primary" />
          {saving ? 'Saving...' : item ? 'Update' : 'Add Flow'}
        </Button>
      </div>
    </form>
  );
}
