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
  useExpenseCategories,
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

const TAX_BUCKET_LABELS: Record<string, string> = {
  pre_tax: 'Pre-tax',
  after_tax: 'After-tax',
  tax_free: 'Tax-free',
};

/** User-facing flow types — maps to engine concepts */
type FlowType = 'deduction' | 'contribution' | 'expense';

const FLOW_TYPE_OPTIONS: { value: FlowType; label: string }[] = [
  { value: 'deduction', label: 'Deduction (from paycheck)' },
  { value: 'contribution', label: 'Contribution (to account)' },
  { value: 'expense', label: 'Expense' },
];

/** Map flow type + tax bucket to engine bucket */
function deriveBucket(flowType: FlowType, taxBucket: string, isEmployer: boolean): CashflowBucket {
  if (isEmployer) return 'employer_match';
  if (flowType === 'expense') return 'expense';
  if (taxBucket === 'pre_tax') return 'pre_tax_deduction';
  return 'post_tax_contribution';
}

/** Reverse: derive user-facing values from engine bucket */
function bucketToFlowType(bucket: string): {
  flowType: FlowType;
  taxBucket: string;
  isEmployer: boolean;
} {
  if (bucket === 'employer_match')
    return { flowType: 'contribution', taxBucket: 'pre_tax', isEmployer: true };
  if (bucket === 'expense')
    return { flowType: 'expense', taxBucket: 'after_tax', isEmployer: false };
  if (bucket === 'pre_tax_deduction' || bucket === 'retirement_deferral')
    return { flowType: 'deduction', taxBucket: 'pre_tax', isEmployer: false };
  if (bucket === 'post_tax_contribution')
    return { flowType: 'contribution', taxBucket: 'after_tax', isEmployer: false };
  return { flowType: 'expense', taxBucket: 'after_tax', isEmployer: false };
}

// Group items for display
const DISPLAY_GROUPS = [
  {
    label: 'Deductions',
    match: (b: string) =>
      b === 'pre_tax_deduction' || b === 'retirement_deferral' || b === 'employer_match',
  },
  {
    label: 'Contributions',
    match: (b: string) => b === 'post_tax_contribution',
  },
  {
    label: 'Expenses',
    match: (b: string) => b === 'expense',
  },
  {
    label: 'Other',
    match: (b: string) => b === 'other',
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
      showFlash('error', err instanceof Error ? err.message : 'Failed to create flow');
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
      showFlash('error', err instanceof Error ? err.message : 'Failed to update flow');
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
      showFlash('error', err instanceof Error ? err.message : 'Failed to delete flow');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>Flows</CardTitle>
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
            No flows yet. Add deductions, contributions, or expenses.
          </p>
        )}

        {DISPLAY_GROUPS.map((group) => {
          const groupItems = memberItems.filter((i) => group.match(i.bucket));
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
  const { taxBucket, isEmployer } = bucketToFlowType(item.bucket);
  const taxLabel =
    item.tax_treatment && TAX_BUCKET_LABELS[item.tax_treatment]
      ? TAX_BUCKET_LABELS[item.tax_treatment]
      : TAX_BUCKET_LABELS[taxBucket] || taxBucket;

  return (
    <div className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted/50">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{item.name}</span>
          <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
            {taxLabel}
          </span>
          {isEmployer && (
            <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
              Employer
            </span>
          )}
          {item.bucket === 'expense' && item.category && (
            <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
              {item.category}
            </span>
          )}
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
  const { data: expenseCategories } = useExpenseCategories();

  const initialDerived = initial ? bucketToFlowType(initial.bucket) : null;

  const [name, setName] = useState(initial?.name ?? '');
  const [flowType, setFlowType] = useState<FlowType>(initialDerived?.flowType ?? 'expense');
  const [taxBucket, setTaxBucket] = useState(
    initial?.tax_treatment || initialDerived?.taxBucket || 'after_tax',
  );
  const [isEmployer, setIsEmployer] = useState(initialDerived?.isEmployer ?? false);
  const [amount, setAmount] = useState(initial?.amount?.toString() ?? '');
  const [frequency, setFrequency] = useState<CashflowFrequency>(initial?.frequency ?? 'monthly');
  const [incomeSourceId, setIncomeSourceId] = useState(initial?.income_source_id ?? '');
  const [destAccountId, setDestAccountId] = useState(initial?.destination_account_id ?? '');
  const [sourceAccountId, setSourceAccountId] = useState(initial?.source_account_id ?? '');
  const [category, setCategory] = useState(initial?.category ?? '');

  const showIncomeSource = flowType === 'deduction' || isEmployer;
  const showDestAccount = flowType === 'deduction' || flowType === 'contribution';
  const showSourceAccount = flowType === 'contribution' && !isEmployer;
  const showTaxBucket = flowType !== 'expense';
  const showExpenseFields = flowType === 'expense';

  function handleCategoryChange(catName: string) {
    setCategory(catName);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = parseFloat(amount);
    if (!name.trim() || isNaN(parsed) || parsed <= 0) return;

    const today = new Date().toISOString().split('T')[0];
    const bucket = deriveBucket(flowType, taxBucket, isEmployer);
    const direction = isEmployer ? 'inflow' : 'outflow';

    onSave({
      member_id: memberId,
      name: name.trim(),
      direction,
      bucket,
      tax_treatment: showTaxBucket ? taxBucket : undefined,
      amount: parsed,
      frequency,
      start_date: initial?.start_date ?? today,
      income_source_id: showIncomeSource && incomeSourceId ? incomeSourceId : undefined,
      destination_account_id: showDestAccount && destAccountId ? destAccountId : undefined,
      source_account_id: showSourceAccount && sourceAccountId ? sourceAccountId : undefined,
      category: showExpenseFields && category ? category : undefined,
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
          placeholder="Flow name"
          className="h-7 text-xs"
        />
      </div>
      <div className="w-[160px]">
        <label className="text-[10px] text-muted-foreground">Type</label>
        <select
          value={flowType}
          onChange={(e) => setFlowType(e.target.value as FlowType)}
          className={selectCn}
        >
          {FLOW_TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
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

      {showTaxBucket && (
        <div className="w-[100px]">
          <label className="text-[10px] text-muted-foreground">Tax Bucket</label>
          <select
            value={taxBucket}
            onChange={(e) => setTaxBucket(e.target.value)}
            className={selectCn}
          >
            <option value="pre_tax">Pre-tax</option>
            <option value="after_tax">After-tax</option>
            <option value="tax_free">Tax-free</option>
          </select>
        </div>
      )}

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
          <label className="text-[10px] text-muted-foreground">To Account</label>
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

      {showSourceAccount && accounts && accounts.length > 0 && (
        <div className="w-[140px]">
          <label className="text-[10px] text-muted-foreground">From Account</label>
          <select
            value={sourceAccountId}
            onChange={(e) => setSourceAccountId(e.target.value)}
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

      {showExpenseFields && expenseCategories && expenseCategories.length > 0 && (
        <div className="w-[130px]">
          <label className="text-[10px] text-muted-foreground">Category</label>
          <select
            value={category}
            onChange={(e) => handleCategoryChange(e.target.value)}
            className={selectCn}
          >
            <option value="">None</option>
            {expenseCategories.map((c) => (
              <option key={c.id} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {(flowType === 'deduction' || flowType === 'contribution') && (
        <div className="flex items-center gap-1.5 pb-0.5">
          <label className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <input
              type="checkbox"
              checked={isEmployer}
              onChange={(e) => setIsEmployer(e.target.checked)}
              className="h-3 w-3 rounded border-border"
            />
            Employer
          </label>
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
