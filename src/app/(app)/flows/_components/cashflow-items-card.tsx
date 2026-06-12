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
import {
  useCashflowItems,
  mutateCashflowItems,
  mutatePlanningComputed,
  useIncomeSources,
  useAccounts,
  useExpenseCategories,
  mutateAccounts,
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

interface CashflowItemsCardProps {
  memberId: string;
}

export function CashflowItemsCard({ memberId }: CashflowItemsCardProps) {
  const { data: items, isLoading, error: fetchError } = useCashflowItems();
  const { data: accounts, householdId } = useAccounts();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<CashflowItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CashflowItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [cardError, setCardError] = useState<string | null>(null);
  const toast = useToast();

  const memberItems = (items ?? []).filter((i) => i.member_id === memberId || i.member_id === null);

  function openAdd() {
    setEditingItem(null);
    setSheetOpen(true);
  }

  function openEdit(item: CashflowItem) {
    setEditingItem(item);
    setSheetOpen(true);
  }

  // Throws on failure so the sheet can show the error inline.
  async function handleSave(data: CreateCashflowItemInput) {
    setSaving(true);
    try {
      if (editingItem) {
        await updateCashflowItem(editingItem.id, data);
      } else {
        await createCashflowItem(data);
      }
      await Promise.all([mutateCashflowItems(), mutatePlanningComputed()]);
      toast('success', editingItem ? 'Allocation updated' : 'Allocation added');
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
      toast('success', 'Allocation deleted');
    } catch (err) {
      setCardError(err instanceof Error ? err.message : 'Failed to delete allocation');
    } finally {
      setSaving(false);
      setDeleteTarget(null);
    }
  }

  function buildColumns(showAccount: boolean): DataTableColumn<CashflowItem>[] {
    const columns: DataTableColumn<CashflowItem>[] = [
      {
        key: 'name',
        header: 'Name',
        priority: 1,
        sortValue: (i) => i.name.toLowerCase(),
        cell: (i) => <span className="font-medium">{i.name}</span>,
      },
      {
        key: 'bucket',
        header: 'Type',
        priority: 2,
        sortValue: (i) => i.bucket,
        cell: (i) => BUCKET_TAGS[i.bucket] ?? i.bucket,
      },
      {
        key: 'amount',
        header: 'Amount',
        numeric: true,
        priority: 1,
        sortValue: (i) => i.amount,
        cell: (i) => (i.amount_type === 'percent' ? `${i.amount}%` : fmt(i.amount)),
      },
      {
        key: 'frequency',
        header: 'Freq',
        priority: 2,
        sortValue: (i) => (i.amount_type === 'percent' ? 'of income' : i.frequency),
        cell: (i) => (i.amount_type === 'percent' ? 'of income' : FREQ_LABELS[i.frequency]),
      },
    ];
    if (showAccount) {
      columns.push({
        key: 'account',
        header: 'Account',
        priority: 2,
        cellClassName: 'max-w-[120px] truncate',
        cell: (i) => {
          const linked = i.destination_account_id
            ? accounts?.find((a: EnrichedAccount) => a.id === i.destination_account_id)
            : undefined;
          return linked?.name ?? '—';
        },
      });
    }
    columns.push({
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      align: 'right',
      priority: 1,
      cell: (i) => (
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Edit ${i.name}`}
            onClick={() => openEdit(i)}
          >
            <IconPencil size={14} stroke={1.5} />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Delete ${i.name}`}
            onClick={() => setDeleteTarget(i)}
          >
            <IconTrash size={14} stroke={1.5} />
          </Button>
        </div>
      ),
    });
    return columns;
  }

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>Allocations</CardTitle>
        <CardAction>
          <Button variant="secondary" size="sm" onClick={openAdd}>
            <IconPlus size={14} stroke={1.5} />
            Add allocation
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-3">
        {cardError && (
          <Alert variant="error" size="sm" onDismiss={() => setCardError(null)}>
            {cardError}
          </Alert>
        )}

        {isLoading || memberItems.length === 0 ? (
          <DataTable
            columns={buildColumns(false)}
            rows={[]}
            rowKey={(i) => i.id}
            density="compact"
            mobile="priority"
            loading={isLoading}
            error={fetchError ? { message: 'Failed to load allocations.' } : null}
            empty={{
              title: 'No allocations yet',
              description: 'Add savings or expenses.',
              action: (
                <Button variant="secondary" size="sm" onClick={openAdd}>
                  <IconPlus size={14} stroke={1.5} />
                  Add allocation
                </Button>
              ),
            }}
          />
        ) : (
          DISPLAY_GROUPS.map((group) => {
            const groupItems = memberItems.filter((i) => group.match(i.bucket));
            if (groupItems.length === 0) return null;
            const showAccount = group.label === 'Savings';

            return (
              <div key={group.label}>
                <h4 className="mb-1 text-xs font-medium text-muted-foreground">{group.label}</h4>
                <DataTable
                  columns={buildColumns(showAccount)}
                  rows={groupItems}
                  rowKey={(i) => i.id}
                  density="compact"
                  mobile="priority"
                  defaultSort={{ key: 'name', dir: 'asc' }}
                />
              </div>
            );
          })
        )}
      </CardContent>

      <CashflowItemForm
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        memberId={memberId}
        householdId={householdId}
        initial={editingItem}
        saving={saving}
        onSave={handleSave}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title={`Delete allocation "${deleteTarget?.name}"?`}
        description="It will stop feeding the money-flow waterfall and your planning projections."
        confirmLabel="Delete allocation"
        busy={saving}
        onConfirm={handleConfirmDelete}
      />
    </Card>
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
    <div className="space-y-3 rounded-md border border-dashed border-border bg-muted/20 p-3">
      {error && (
        <Alert variant="error" size="sm" onDismiss={() => setError('')}>
          {error}
        </Alert>
      )}
      <FormField label="Account name" htmlFor="new-account-name">
        <Input
          id="new-account-name"
          value={acctName}
          onChange={(e) => setAcctName(e.target.value)}
          placeholder="e.g. 401k, Roth IRA"
        />
      </FormField>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Type" htmlFor="new-account-type">
          <Select
            id="new-account-type"
            value={acctType}
            onChange={(e) => setAcctType(e.target.value as AccountType)}
          >
            {INLINE_ACCOUNT_TYPES.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Tax treatment" htmlFor="new-account-tax">
          <Select
            id="new-account-tax"
            value={taxTreatment}
            onChange={(e) => setTaxTreatment(e.target.value as TaxTreatment)}
          >
            {TAX_TREATMENT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </FormField>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={busy || !acctName.trim()}
          onClick={handleCreate}
        >
          {busy ? 'Saving…' : 'Save account'}
        </Button>
      </div>
    </div>
  );
}

// ── Allocation Sheet Form ──

interface CashflowItemFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  memberId: string;
  householdId?: string;
  /** When set, the sheet edits this allocation; otherwise it creates a new one. */
  initial?: CashflowItem | null;
  saving: boolean;
  /** Must throw on failure — the error is shown in an Alert inside the sheet. */
  onSave: (data: CreateCashflowItemInput) => Promise<void>;
}

function CashflowItemForm({
  open,
  onOpenChange,
  memberId,
  householdId,
  initial,
  saving,
  onSave,
}: CashflowItemFormProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right">
        {open && (
          <CashflowItemFormBody
            key={initial?.id ?? 'new'}
            onOpenChange={onOpenChange}
            memberId={memberId}
            householdId={householdId}
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
function CashflowItemFormBody({
  onOpenChange,
  memberId,
  householdId,
  initial,
  saving,
  onSave,
}: Omit<CashflowItemFormProps, 'open'>) {
  const { data: incomeSources } = useIncomeSources();
  const { data: accounts } = useAccounts();
  const { data: expenseCategories } = useExpenseCategories();

  const [name, setName] = useState(initial?.name ?? '');
  const [bucket, setBucket] = useState<CashflowBucket>(initial?.bucket ?? 'expense');
  const [amount, setAmount] = useState(initial?.amount != null ? String(initial.amount) : '');
  const [amountType, setAmountType] = useState<AmountType>(initial?.amount_type ?? 'fixed');
  const [frequency, setFrequency] = useState<CashflowFrequency>(initial?.frequency ?? 'monthly');
  const [incomeSourceId, setIncomeSourceId] = useState(initial?.income_source_id ?? '');
  const [destAccountId, setDestAccountId] = useState(initial?.destination_account_id ?? '');
  const [category, setCategory] = useState(initial?.category ?? '');
  const [showNewAccount, setShowNewAccount] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [amountError, setAmountError] = useState<string | null>(null);
  const [incomeError, setIncomeError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const isEditing = !!initial;

  // Conditional fields by bucket
  const isSavingBucket = bucket === 'savings' || bucket === 'employer_match';
  const showFromIncome = bucket === 'savings' || amountType === 'percent';
  const showToAccount = isSavingBucket;
  const showCategory = bucket === 'expense';
  const incomeFieldVisible = showFromIncome && !!incomeSources && incomeSources.length > 0;

  function validateName(value: string): string | null {
    return value.trim() ? null : 'Name is required';
  }

  function validateAmount(value: string, type: AmountType): string | null {
    const parsed = parseFloat(value);
    if (isNaN(parsed) || parsed <= 0) return 'Amount must be greater than 0';
    if (type === 'percent' && parsed > 100) return 'Percent must be 100 or less';
    return null;
  }

  function validateIncome(type: AmountType, sourceId: string): string | null {
    return type === 'percent' && !sourceId ? 'Percent allocations need an income source' : null;
  }

  function toggleAmountType() {
    const next: AmountType = amountType === 'fixed' ? 'percent' : 'fixed';
    setAmountType(next);
    if (amountError) setAmountError(validateAmount(amount, next));
    if (next === 'fixed') setIncomeError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const nErr = validateName(name);
    const aErr = validateAmount(amount, amountType);
    const iErr = validateIncome(amountType, incomeSourceId);
    setNameError(nErr);
    setAmountError(aErr);
    setIncomeError(incomeFieldVisible ? iErr : null);
    if (nErr || aErr) return;
    if (iErr) {
      // No income-source field to attach the error to — surface it in the sheet.
      if (!incomeFieldVisible) {
        setSubmitError('Percent allocations need an income source. Add an income source first.');
      }
      return;
    }

    const today = new Date().toISOString().split('T')[0];

    setSubmitError(null);
    try {
      await onSave({
        member_id: memberId,
        name: name.trim(),
        direction: bucketToDirection(bucket),
        bucket,
        amount: parseFloat(amount),
        amount_type: amountType,
        frequency: amountType === 'percent' ? 'monthly' : frequency,
        start_date: initial?.start_date ?? today,
        income_source_id: incomeSourceId || null,
        destination_account_id: showToAccount && destAccountId ? destAccountId : null,
        category: showCategory && category ? category : null,
      });
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to save allocation');
    }
  }

  return (
    <>
      <SheetHeader>
        <SheetTitle>{isEditing ? 'Edit allocation' : 'Add allocation'}</SheetTitle>
        <SheetDescription>
          {isEditing
            ? 'Update this allocation. Changes apply to your money flows immediately.'
            : 'Allocate income to savings or expenses to see it in your money flows.'}
        </SheetDescription>
      </SheetHeader>
      <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
        <div className="flex-1 space-y-4 overflow-y-auto px-4">
          {submitError && (
            <Alert variant="error" onDismiss={() => setSubmitError(null)}>
              {submitError}
            </Alert>
          )}
          <FormField label="Name" htmlFor="allocation-name" required error={nameError}>
            <Input
              id="allocation-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (nameError && e.target.value.trim()) setNameError(null);
              }}
              onBlur={() => setNameError(validateName(name))}
              aria-invalid={!!nameError}
              placeholder="e.g. 401k, Rent"
              autoFocus
            />
          </FormField>
          <FormField label="Type" htmlFor="allocation-bucket">
            <Select
              id="allocation-bucket"
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
            >
              {BUCKET_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField
            label="Amount"
            htmlFor="allocation-amount"
            required
            error={amountError}
            hint={amountType === 'percent' ? 'Percent of income' : undefined}
          >
            <div className="flex items-stretch">
              <button
                type="button"
                onClick={toggleAmountType}
                aria-label={
                  amountType === 'percent'
                    ? 'Switch to fixed dollar amount'
                    : 'Switch to percent of income'
                }
                className="flex w-9 shrink-0 items-center justify-center rounded-l-md border border-r-0 border-border bg-muted text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                {amountType === 'percent' ? '%' : '$'}
              </button>
              <Input
                id="allocation-amount"
                type="number"
                step={amountType === 'percent' ? '1' : '0.01'}
                min="0"
                max={amountType === 'percent' ? '100' : undefined}
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  if (amountError && !validateAmount(e.target.value, amountType)) {
                    setAmountError(null);
                  }
                }}
                onBlur={() => setAmountError(validateAmount(amount, amountType))}
                aria-invalid={!!amountError}
                placeholder={amountType === 'percent' ? '25' : '0.00'}
                className="rounded-l-none font-mono"
              />
            </div>
          </FormField>
          {amountType === 'fixed' && (
            <FormField label="Frequency" htmlFor="allocation-frequency">
              <Select
                id="allocation-frequency"
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
          )}

          {incomeFieldVisible && (
            <FormField
              label="From income source"
              htmlFor="allocation-income-source"
              required={amountType === 'percent'}
              error={incomeError}
            >
              <Select
                id="allocation-income-source"
                value={incomeSourceId}
                onChange={(e) => {
                  setIncomeSourceId(e.target.value);
                  if (incomeError && e.target.value) setIncomeError(null);
                }}
                onBlur={() => setIncomeError(validateIncome(amountType, incomeSourceId))}
                aria-invalid={!!incomeError}
              >
                <option value="">Any</option>
                {(incomeSources ?? []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </FormField>
          )}

          {showToAccount && (
            <FormField label="To account" htmlFor="allocation-account">
              <Select
                id="allocation-account"
                value={destAccountId}
                onChange={(e) => {
                  if (e.target.value === '__new__') {
                    setShowNewAccount(true);
                  } else {
                    setDestAccountId(e.target.value);
                  }
                }}
              >
                <option value="">None</option>
                {(accounts ?? []).map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
                <option value="__new__">+ New Account</option>
              </Select>
            </FormField>
          )}

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

          {showCategory && expenseCategories && expenseCategories.length > 0 && (
            <FormField label="Category" htmlFor="allocation-category">
              <Select
                id="allocation-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="">None</option>
                {expenseCategories.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </FormField>
          )}
        </div>
        <SheetFooter className="flex-row justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={saving}>
            {saving ? 'Saving…' : isEditing ? 'Save allocation' : 'Add allocation'}
          </Button>
        </SheetFooter>
      </form>
    </>
  );
}
