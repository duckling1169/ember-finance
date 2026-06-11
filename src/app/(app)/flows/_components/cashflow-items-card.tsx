'use client';

import { useState } from 'react';
import { useToast } from '@/components/ui/toast';
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
import { IconPlus, IconPencil, IconTrash, IconCheck, IconX } from '@tabler/icons-react';
import { SortIcon, type SortDir } from '@/components/common/sort-icon';

import { fmt } from '@/lib/formatters';
import {
  useCashflowItems,
  mutateCashflowItems,
  mutatePlanningComputed,
  useIncomeSources,
  useAccounts,
  useExpenseCategories,
} from '@/lib/swr';
import {
  createCashflowItem,
  updateCashflowItem,
  deleteCashflowItem,
  createAccount,
} from '@/lib/api';
import type {
  CashflowItem,
  CashflowBucket,
  CashflowFrequency,
  AmountType,
  CreateCashflowItemInput,
  EnrichedAccount,
  AccountType,
  TaxTreatment,
} from '@shared/types';
import { CASHFLOW_FREQUENCIES } from '@shared/types';
import { TAX_TREATMENT_OPTIONS } from '@/lib/constants';
import { mutateAccounts } from '@/lib/swr';

const FREQ_LABELS: Record<CashflowFrequency, string> = {
  monthly: 'Monthly',
  biweekly: 'Biweekly',
  annual: 'Annual',
  one_time: 'One-time',
};

// ── Bucket display labels ──
const BUCKET_TAGS: Record<CashflowBucket, string> = {
  savings: 'Savings',
  employer_match: 'Employer',
  expense: 'Expense',
};

const BUCKET_OPTIONS: { value: CashflowBucket; label: string }[] = [
  { value: 'savings', label: 'Savings' },
  { value: 'employer_match', label: 'Employer match' },
  { value: 'expense', label: 'Expense' },
];

function bucketToDirection(bucket: CashflowBucket): 'inflow' | 'outflow' {
  return bucket === 'employer_match' ? 'inflow' : 'outflow';
}

// Display groups
const DISPLAY_GROUPS = [
  {
    label: 'Savings',
    match: (b: string) => b === 'savings' || b === 'employer_match',
  },
  {
    label: 'Expenses',
    match: (b: string) => b === 'expense',
  },
];

type CashflowSortKey = 'name' | 'bucket' | 'amount' | 'frequency';

interface CashflowItemsCardProps {
  memberId: string;
}

export function CashflowItemsCard({ memberId }: CashflowItemsCardProps) {
  const { data: items, isLoading } = useCashflowItems();
  const { data: accounts, householdId } = useAccounts();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [sortKey, setSortKey] = useState<CashflowSortKey>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const toast = useToast();

  function toggleSort(key: CashflowSortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'amount' ? 'desc' : 'asc');
    }
  }

  function sortItems(list: CashflowItem[]): CashflowItem[] {
    return [...list].sort((a, b) => {
      let aVal: string | number;
      let bVal: string | number;
      switch (sortKey) {
        case 'name':
          aVal = a.name.toLowerCase();
          bVal = b.name.toLowerCase();
          break;
        case 'bucket':
          aVal = a.bucket;
          bVal = b.bucket;
          break;
        case 'amount':
          aVal = a.amount;
          bVal = b.amount;
          break;
        case 'frequency':
          aVal = a.amount_type === 'percent' ? 'of income' : a.frequency;
          bVal = b.amount_type === 'percent' ? 'of income' : b.frequency;
          break;
      }
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortDir === 'asc' ? Number(aVal) - Number(bVal) : Number(bVal) - Number(aVal);
    });
  }

  const memberItems = (items ?? []).filter((i) => i.member_id === memberId || i.member_id === null);

  async function handleCreate(data: CreateCashflowItemInput) {
    setSaving(true);
    try {
      await createCashflowItem(data);
      await Promise.all([mutateCashflowItems(), mutatePlanningComputed()]);
      setAdding(false);
    } catch (err) {
      toast('error', err instanceof Error ? err.message : 'Failed to create allocation');
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
      toast('error', err instanceof Error ? err.message : 'Failed to update allocation');
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
      toast('error', err instanceof Error ? err.message : 'Failed to delete allocation');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>Allocations</CardTitle>
        <CardAction>
          {!adding && (
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => setAdding(true)}
              aria-label="Add allocation"
            >
              <IconPlus size={14} stroke={1.5} />
            </Button>
          )}
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}

        {!isLoading && memberItems.length === 0 && !adding && (
          <p className="text-sm text-muted-foreground">
            No allocations yet. Add savings or expenses.
          </p>
        )}

        {DISPLAY_GROUPS.map((group) => {
          const groupItems = memberItems.filter((i) => group.match(i.bucket));
          if (groupItems.length === 0) return null;

          // Separate items being edited (shown as inline forms) from table rows
          const editingItem = editingId ? groupItems.find((i) => i.id === editingId) : undefined;
          const tableItems = sortItems(groupItems.filter((i) => i.id !== editingId));
          const showAccount = group.label === 'Savings';

          const groupColumns: { key: CashflowSortKey; label: string; align?: 'right' }[] = [
            { key: 'name', label: 'Name' },
            { key: 'bucket', label: 'Type' },
            { key: 'amount', label: 'Amount', align: 'right' },
            { key: 'frequency', label: 'Freq' },
          ];

          return (
            <div key={group.label}>
              <h4 className="mb-1 text-xs font-medium text-muted-foreground">{group.label}</h4>
              {tableItems.length > 0 && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      {groupColumns.map((col) => (
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
                      {showAccount && <TableHead>Account</TableHead>}
                      <TableHead className="w-16" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tableItems.map((item) => (
                      <ItemTableRow
                        key={item.id}
                        item={item}
                        accounts={accounts}
                        showAccount={showAccount}
                        onEdit={() => setEditingId(item.id)}
                        onDelete={() => handleDelete(item.id)}
                      />
                    ))}
                  </TableBody>
                </Table>
              )}
              {editingItem && (
                <ItemInlineForm
                  key={editingItem.id}
                  memberId={memberId}
                  householdId={householdId}
                  initial={editingItem}
                  saving={saving}
                  onSave={(data) => handleUpdate(editingItem.id, data)}
                  onCancel={() => setEditingId(null)}
                />
              )}
            </div>
          );
        })}

        {adding && (
          <ItemInlineForm
            memberId={memberId}
            householdId={householdId}
            saving={saving}
            onSave={handleCreate}
            onCancel={() => setAdding(false)}
          />
        )}
      </CardContent>
    </Card>
  );
}

function ItemTableRow({
  item,
  accounts,
  showAccount,
  onEdit,
  onDelete,
}: {
  item: CashflowItem;
  accounts?: EnrichedAccount[];
  showAccount: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const bucketLabel = BUCKET_TAGS[item.bucket] ?? item.bucket;
  const linkedAccount = item.destination_account_id
    ? accounts?.find((a) => a.id === item.destination_account_id)
    : undefined;

  return (
    <TableRow>
      <TableCell className="font-medium">{item.name}</TableCell>
      <TableCell>{bucketLabel}</TableCell>
      <TableCell className="text-right font-mono tabular-nums">
        {item.amount_type === 'percent' ? `${item.amount}%` : fmt(item.amount)}
      </TableCell>
      <TableCell>
        {item.amount_type === 'percent' ? 'of income' : FREQ_LABELS[item.frequency]}
      </TableCell>
      {showAccount && (
        <TableCell className="truncate max-w-[120px]">{linkedAccount?.name ?? '\u2014'}</TableCell>
      )}
      <TableCell className="text-right">
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon-xs" onClick={onEdit} aria-label={`Edit ${item.name}`}>
            <IconPencil size={14} stroke={1.5} />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={onDelete}
            aria-label={`Delete ${item.name}`}
          >
            <IconTrash size={14} stroke={1.5} />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

// ── Inline Account Creation Mini-Form ──

const INLINE_ACCOUNT_TYPES: { value: AccountType; label: string }[] = [
  { value: 'checking', label: 'Checking' },
  { value: 'savings', label: 'Savings' },
  { value: 'brokerage', label: 'Brokerage' },
  { value: 'retirement', label: 'Retirement' },
  { value: 'hsa', label: 'HSA' },
  { value: 'other', label: 'Other' },
];

function InlineNewAccount({
  householdId: hhId,
  onCreated,
  onCancel,
}: {
  householdId: string;
  onCreated: (accountId: string) => void;
  onCancel: () => void;
}) {
  const [acctName, setAcctName] = useState('');
  const [acctType, setAcctType] = useState<AccountType>('retirement');
  const [taxTreatment, setTaxTreatment] = useState<TaxTreatment>('pre_tax');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleCreate() {
    if (!acctName.trim()) return;
    setBusy(true);
    setError('');
    try {
      const acct = await createAccount(hhId, {
        name: acctName.trim(),
        account_type: acctType,
        tax_treatment: taxTreatment,
      });
      await mutateAccounts();
      onCreated(acct.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create account');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-1.5 rounded-md border border-dashed border-border bg-muted/20 p-2">
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[100px] flex-1">
          <label className="text-xs text-muted-foreground">Account Name</label>
          <Input
            value={acctName}
            onChange={(e) => setAcctName(e.target.value)}
            placeholder="e.g. 401k, Roth IRA"
            className="h-7 text-xs"
          />
        </div>
        <div className="w-[110px]">
          <label className="text-xs text-muted-foreground">Type</label>
          <Select
            value={acctType}
            onChange={(e) => setAcctType(e.target.value as AccountType)}
            className="h-7 px-2 text-xs"
          >
            {INLINE_ACCOUNT_TYPES.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </div>
        <div className="w-[100px]">
          <label className="text-xs text-muted-foreground">Tax Treatment</label>
          <Select
            value={taxTreatment}
            onChange={(e) => setTaxTreatment(e.target.value as TaxTreatment)}
            className="h-7 px-2 text-xs"
          >
            {TAX_TREATMENT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex h-7 items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            disabled={busy || !acctName.trim()}
            onClick={handleCreate}
            aria-label="Create account"
          >
            <IconCheck size={14} stroke={1.5} className="text-primary" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={onCancel}
            aria-label="Cancel account creation"
          >
            <IconX size={14} stroke={1.5} />
          </Button>
        </div>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

// ── Item Inline Form ──

function ItemInlineForm({
  memberId,
  householdId,
  initial,
  saving,
  onSave,
  onCancel,
}: {
  memberId: string;
  householdId?: string;
  initial?: CashflowItem;
  saving: boolean;
  onSave: (data: CreateCashflowItemInput) => void;
  onCancel: () => void;
}) {
  const { data: incomeSources } = useIncomeSources();
  const { data: accounts } = useAccounts();
  const { data: expenseCategories } = useExpenseCategories();

  const [name, setName] = useState(initial?.name ?? '');
  const [bucket, setBucket] = useState<CashflowBucket>(initial?.bucket ?? 'expense');
  const [amount, setAmount] = useState(initial?.amount?.toString() ?? '');
  const [amountType, setAmountType] = useState<AmountType>(initial?.amount_type ?? 'fixed');
  const [frequency, setFrequency] = useState<CashflowFrequency>(initial?.frequency ?? 'monthly');
  const [incomeSourceId, setIncomeSourceId] = useState(initial?.income_source_id ?? '');
  const [destAccountId, setDestAccountId] = useState(initial?.destination_account_id ?? '');
  const [category, setCategory] = useState(initial?.category ?? '');
  const [showNewAccount, setShowNewAccount] = useState(false);

  // Conditional fields by bucket
  const isSaving = bucket === 'savings' || bucket === 'employer_match';
  const showFromIncome = bucket === 'savings' || amountType === 'percent';
  const showToAccount = isSaving;
  const showCategory = bucket === 'expense';

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = parseFloat(amount);
    if (!name.trim() || isNaN(parsed) || parsed <= 0) return;
    if (amountType === 'percent' && parsed > 100) return;
    if (amountType === 'percent' && !incomeSourceId) return;

    const today = new Date().toISOString().split('T')[0];

    onSave({
      member_id: memberId,
      name: name.trim(),
      direction: bucketToDirection(bucket),
      bucket,
      amount: parsed,
      amount_type: amountType,
      frequency: amountType === 'percent' ? 'monthly' : frequency,
      start_date: initial?.start_date ?? today,
      income_source_id: incomeSourceId || null,
      destination_account_id: showToAccount && destAccountId ? destAccountId : null,
      category: showCategory && category ? category : null,
    });
  }

  const compactSelect = 'h-7 px-2 text-xs';

  return (
    <form onSubmit={handleSubmit} className="space-y-2 rounded-md bg-muted/30 p-2">
      <div className="flex items-end gap-1.5">
        <div className="min-w-0 flex-1">
          <label className="text-xs text-muted-foreground">Name</label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. 401k, Rent"
            className="h-7 text-xs"
          />
        </div>
        <div className="w-[110px] shrink-0">
          <label className="text-xs text-muted-foreground">Type</label>
          <Select
            value={bucket}
            onChange={(e) => {
              const newBucket = e.target.value as CashflowBucket;
              setBucket(newBucket);
              // Clear relational fields that don't apply to the new bucket
              const nowSaving = newBucket === 'savings' || newBucket === 'employer_match';
              if (!nowSaving) {
                setDestAccountId('');
                setIncomeSourceId('');
              }
              if (newBucket === 'expense') setCategory('');
            }}
            className={compactSelect}
          >
            {BUCKET_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </div>
        <div className="w-[110px] shrink-0">
          <label className="text-xs text-muted-foreground">Amount</label>
          <div className="flex h-7 items-stretch">
            <button
              type="button"
              onClick={() => setAmountType(amountType === 'fixed' ? 'percent' : 'fixed')}
              className="flex w-7 shrink-0 items-center justify-center rounded-l-md border border-r-0 border-border bg-muted text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              {amountType === 'percent' ? '%' : '$'}
            </button>
            <Input
              type="number"
              step={amountType === 'percent' ? '1' : '0.01'}
              min="0"
              max={amountType === 'percent' ? '100' : undefined}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={amountType === 'percent' ? '25' : '0.00'}
              className="h-7 rounded-l-none text-xs font-mono"
            />
          </div>
        </div>
        {amountType === 'fixed' && (
          <div className="w-[90px] shrink-0">
            <label className="text-xs text-muted-foreground">Freq</label>
            <Select
              value={frequency}
              onChange={(e) => setFrequency(e.target.value as CashflowFrequency)}
              className={compactSelect}
            >
              {CASHFLOW_FREQUENCIES.map((f) => (
                <option key={f} value={f}>
                  {FREQ_LABELS[f]}
                </option>
              ))}
            </Select>
          </div>
        )}

        {showFromIncome && incomeSources && incomeSources.length > 0 && (
          <div className="w-[100px] shrink-0">
            <label className="text-xs text-muted-foreground">From</label>
            <Select
              value={incomeSourceId}
              onChange={(e) => setIncomeSourceId(e.target.value)}
              className={compactSelect}
            >
              <option value="">Any</option>
              {incomeSources.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </div>
        )}

        {showToAccount && (
          <div className="w-[120px] shrink-0">
            <label className="text-xs text-muted-foreground">To Account</label>
            <Select
              value={destAccountId}
              onChange={(e) => {
                if (e.target.value === '__new__') {
                  setShowNewAccount(true);
                } else {
                  setDestAccountId(e.target.value);
                }
              }}
              className={compactSelect}
            >
              <option value="">None</option>
              {(accounts ?? []).map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
              <option value="__new__">+ New Account</option>
            </Select>
          </div>
        )}

        {showCategory && expenseCategories && expenseCategories.length > 0 && (
          <div className="w-[100px] shrink-0">
            <label className="text-xs text-muted-foreground">Category</label>
            <Select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className={compactSelect}
            >
              <option value="">None</option>
              {expenseCategories.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>
        )}

        <div className="flex h-7 shrink-0 items-center gap-1">
          <Button
            type="submit"
            variant="ghost"
            size="icon-xs"
            disabled={saving}
            aria-label="Save allocation"
          >
            <IconCheck size={14} stroke={1.5} className="text-primary" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={onCancel}
            aria-label="Cancel"
          >
            <IconX size={14} stroke={1.5} />
          </Button>
        </div>
      </div>

      {/* Inline new account form */}
      {showNewAccount && householdId && (
        <InlineNewAccount
          householdId={householdId}
          onCreated={(id) => {
            setDestAccountId(id);
            setShowNewAccount(false);
          }}
          onCancel={() => setShowNewAccount(false)}
        />
      )}
    </form>
  );
}
