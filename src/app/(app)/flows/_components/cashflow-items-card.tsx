'use client';

import { useState } from 'react';
import { useFlash } from '@/lib/use-flash';
import { Card, CardHeader, CardTitle, CardAction, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { IconPlus, IconPencil, IconTrash, IconCheck, IconX } from '@tabler/icons-react';
import { cn } from '@/lib/utils';
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
  CashflowBucket,
  CashflowFrequency,
  CashflowDirection,
  CreateCashflowItemInput,
} from '@shared/types';
import { CASHFLOW_BUCKETS, CASHFLOW_FREQUENCIES } from '@shared/types';

const BUCKET_LABELS: Record<CashflowBucket, string> = {
  salary: 'Salary',
  employer_match: 'Employer Match',
  pre_tax_deduction: 'Pre-tax Deduction',
  retirement_deferral: 'Retirement Deferral',
  post_tax_contribution: 'Post-tax Contribution',
  expense: 'Expense',
  other: 'Other',
};

const FREQ_LABELS: Record<CashflowFrequency, string> = {
  monthly: 'Monthly',
  biweekly: 'Biweekly',
  annual: 'Annual',
  one_time: 'One-time',
};

// Buckets relevant for user-created cashflow items (salary is auto from income sources)
const EDITABLE_BUCKETS = CASHFLOW_BUCKETS.filter((b) => b !== 'salary');

// Group items for display
const BUCKET_GROUPS = [
  {
    label: 'Deductions & Deferrals',
    buckets: ['pre_tax_deduction', 'retirement_deferral', 'employer_match'] as CashflowBucket[],
  },
  {
    label: 'Post-tax Contributions',
    buckets: ['post_tax_contribution'] as CashflowBucket[],
  },
  {
    label: 'Expenses',
    buckets: ['expense'] as CashflowBucket[],
  },
  {
    label: 'Other',
    buckets: ['other'] as CashflowBucket[],
  },
];

interface CashflowItemsCardProps {
  memberId: string;
}

export function CashflowItemsCard({ memberId }: CashflowItemsCardProps) {
  const { data: items, isLoading } = useCashflowItems();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const { flash, show: showFlash } = useFlash();

  const memberItems = (items ?? []).filter((i) => i.member_id === memberId || i.member_id === null);

  async function handleCreate(data: CreateCashflowItemInput) {
    setSaving(true);
    try {
      await createCashflowItem(data);
      await Promise.all([mutateCashflowItems(), mutatePlanningComputed()]);
      setAdding(false);
    } catch (err) {
      showFlash('error', err instanceof Error ? err.message : 'Failed to create item');
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdate(id: string, data: Partial<CashflowItem>) {
    setSaving(true);
    try {
      await updateCashflowItem(id, data);
      await Promise.all([mutateCashflowItems(), mutatePlanningComputed()]);
      setEditingId(null);
    } catch (err) {
      showFlash('error', err instanceof Error ? err.message : 'Failed to update item');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setSaving(true);
    try {
      await deleteCashflowItem(id);
      await Promise.all([mutateCashflowItems(), mutatePlanningComputed()]);
    } catch (err) {
      showFlash('error', err instanceof Error ? err.message : 'Failed to delete item');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>Cashflow Items</CardTitle>
        <CardAction>
          {!adding && (
            <Button variant="ghost" size="icon-xs" onClick={() => setAdding(true)}>
              <IconPlus size={14} stroke={1.5} />
            </Button>
          )}
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-3">
        {flash && (
          <div
            className={cn(
              'rounded-md px-3 py-1.5 text-xs',
              flash.type === 'error'
                ? 'bg-destructive/10 text-destructive'
                : 'bg-gain/10 text-gain',
            )}
          >
            {flash.message}
          </div>
        )}

        {isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}

        {!isLoading && memberItems.length === 0 && !adding && (
          <p className="text-sm text-muted-foreground">
            No cashflow items yet. Add deductions, contributions, or expenses.
          </p>
        )}

        {BUCKET_GROUPS.map((group) => {
          const groupItems = memberItems.filter((i) => group.buckets.includes(i.bucket));
          if (groupItems.length === 0) return null;

          return (
            <div key={group.label}>
              <h4 className="mb-1 text-xs font-medium text-muted-foreground">{group.label}</h4>
              <div className="space-y-1">
                {groupItems.map((item) =>
                  editingId === item.id ? (
                    <ItemInlineForm
                      key={item.id}
                      memberId={memberId}
                      initial={item}
                      saving={saving}
                      onSave={(data) => handleUpdate(item.id, data)}
                      onCancel={() => setEditingId(null)}
                    />
                  ) : (
                    <ItemRow
                      key={item.id}
                      item={item}
                      onEdit={() => setEditingId(item.id)}
                      onDelete={() => handleDelete(item.id)}
                    />
                  ),
                )}
              </div>
            </div>
          );
        })}

        {adding && (
          <ItemInlineForm
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

function ItemRow({
  item,
  onEdit,
  onDelete,
}: {
  item: CashflowItem;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted/50">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{item.name}</span>
          <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
            {BUCKET_LABELS[item.bucket]}
          </span>
        </div>
        <div className="text-xs text-muted-foreground">
          <span className="font-mono tabular-nums">{fmt(item.amount)}</span>{' '}
          {FREQ_LABELS[item.frequency].toLowerCase()}
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

function ItemInlineForm({
  memberId,
  initial,
  saving,
  onSave,
  onCancel,
}: {
  memberId: string;
  initial?: CashflowItem;
  saving: boolean;
  onSave: (data: CreateCashflowItemInput) => void;
  onCancel: () => void;
}) {
  const { data: incomeSources } = useIncomeSources();
  const { data: accounts } = useAccounts();

  const [name, setName] = useState(initial?.name ?? '');
  const [bucket, setBucket] = useState<CashflowBucket>(initial?.bucket ?? 'expense');
  const [amount, setAmount] = useState(initial?.amount?.toString() ?? '');
  const [frequency, setFrequency] = useState<CashflowFrequency>(initial?.frequency ?? 'monthly');
  const [incomeSourceId, setIncomeSourceId] = useState(initial?.income_source_id ?? '');
  const [destAccountId, setDestAccountId] = useState(initial?.destination_account_id ?? '');

  const direction: CashflowDirection =
    bucket === 'salary' || bucket === 'employer_match' ? 'inflow' : 'outflow';

  const showIncomeSource = ['pre_tax_deduction', 'retirement_deferral', 'employer_match'].includes(
    bucket,
  );
  const showDestAccount = [
    'retirement_deferral',
    'post_tax_contribution',
    'employer_match',
  ].includes(bucket);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = parseFloat(amount);
    if (!name.trim() || isNaN(parsed) || parsed <= 0) return;

    const today = new Date().toISOString().split('T')[0];

    onSave({
      member_id: memberId,
      name: name.trim(),
      direction,
      bucket,
      amount: parsed,
      frequency,
      start_date: initial?.start_date ?? today,
      income_source_id: showIncomeSource && incomeSourceId ? incomeSourceId : undefined,
      destination_account_id: showDestAccount && destAccountId ? destAccountId : undefined,
    });
  }

  const selectCn = cn(
    'flex h-7 w-full rounded-md border border-input bg-card px-2 text-xs',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
  );

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-wrap items-end gap-2 rounded-md bg-muted/30 p-2"
    >
      <div className="min-w-[120px] flex-1">
        <label className="text-[10px] text-muted-foreground">Name</label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Item name"
          className="h-7 text-xs"
        />
      </div>
      <div className="w-[140px]">
        <label className="text-[10px] text-muted-foreground">Bucket</label>
        <select
          value={bucket}
          onChange={(e) => setBucket(e.target.value as CashflowBucket)}
          className={selectCn}
        >
          {EDITABLE_BUCKETS.map((b) => (
            <option key={b} value={b}>
              {BUCKET_LABELS[b]}
            </option>
          ))}
        </select>
      </div>
      <div className="w-[100px]">
        <label className="text-[10px] text-muted-foreground">Amount</label>
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
        <label className="text-[10px] text-muted-foreground">Frequency</label>
        <select
          value={frequency}
          onChange={(e) => setFrequency(e.target.value as CashflowFrequency)}
          className={selectCn}
        >
          {CASHFLOW_FREQUENCIES.map((f) => (
            <option key={f} value={f}>
              {FREQ_LABELS[f]}
            </option>
          ))}
        </select>
      </div>

      {showIncomeSource && incomeSources && incomeSources.length > 0 && (
        <div className="w-[140px]">
          <label className="text-[10px] text-muted-foreground">Income Source</label>
          <select
            value={incomeSourceId}
            onChange={(e) => setIncomeSourceId(e.target.value)}
            className={selectCn}
          >
            <option value="">None</option>
            {incomeSources.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {showDestAccount && accounts && accounts.length > 0 && (
        <div className="w-[140px]">
          <label className="text-[10px] text-muted-foreground">Destination Account</label>
          <select
            value={destAccountId}
            onChange={(e) => setDestAccountId(e.target.value)}
            className={selectCn}
          >
            <option value="">None</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="flex gap-1">
        <Button type="submit" size="icon-xs" disabled={saving}>
          <IconCheck size={14} stroke={1.5} />
        </Button>
        <Button type="button" variant="ghost" size="icon-xs" onClick={onCancel}>
          <IconX size={14} stroke={1.5} />
        </Button>
      </div>
    </form>
  );
}
