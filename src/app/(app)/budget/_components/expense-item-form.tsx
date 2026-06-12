'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert } from '@/components/ui/alert';
import { FormField } from '@/components/ui/form-field';
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';

import type {
  CashflowItem,
  CashflowFrequency,
  ExpenseCategory,
  CreateCashflowItemInput,
} from '@shared/types';
import { CASHFLOW_FREQUENCIES } from '@shared/types';

const FREQ_LABELS: Record<CashflowFrequency, string> = {
  monthly: 'Monthly',
  biweekly: 'Biweekly',
  annual: 'Annual',
  one_time: 'One-time',
};

interface ExpenseItemFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When set, the sheet edits this item; otherwise it creates a new expense. */
  initial?: CashflowItem | null;
  categories: ExpenseCategory[];
  saving: boolean;
  /** Must throw on failure — the error is shown in an Alert inside the sheet. */
  onSave: (data: CreateCashflowItemInput) => Promise<void>;
}

export function ExpenseItemForm({
  open,
  onOpenChange,
  initial,
  categories,
  saving,
  onSave,
}: ExpenseItemFormProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right">
        {open && (
          <ExpenseItemFormBody
            key={initial?.id ?? 'new'}
            onOpenChange={onOpenChange}
            initial={initial}
            categories={categories}
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
function ExpenseItemFormBody({
  onOpenChange,
  initial,
  categories,
  saving,
  onSave,
}: Omit<ExpenseItemFormProps, 'open'>) {
  const [name, setName] = useState(initial?.name ?? '');
  const [amount, setAmount] = useState(initial?.amount != null ? String(initial.amount) : '');
  const [frequency, setFrequency] = useState<CashflowFrequency>(initial?.frequency ?? 'monthly');
  const [category, setCategory] = useState(initial?.category ?? '');
  const [isEssential, setIsEssential] = useState(initial?.is_essential ?? true);
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

  // When selecting a category, auto-set essential flag to match
  function handleCategoryChange(catName: string) {
    setCategory(catName);
    const cat = categories.find((c) => c.name === catName);
    if (cat) setIsEssential(cat.is_essential);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const nErr = validateName(name);
    const aErr = validateAmount(amount);
    setNameError(nErr);
    setAmountError(aErr);
    if (nErr || aErr) return;

    const today = new Date().toISOString().split('T')[0];
    setSubmitError(null);
    try {
      await onSave({
        name: name.trim(),
        direction: 'outflow',
        bucket: 'expense',
        amount: parseFloat(amount),
        frequency,
        start_date: initial?.start_date ?? today,
        category: category || null,
        is_essential: isEssential,
      });
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to save expense');
    }
  }

  return (
    <>
      <SheetHeader>
        <SheetTitle>{isEditing ? 'Edit expense' : 'Add expense'}</SheetTitle>
        <SheetDescription>
          {isEditing
            ? 'Update this expense. Changes apply to your budget immediately.'
            : 'Add a recurring or one-time expense to your budget.'}
        </SheetDescription>
      </SheetHeader>
      <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
        <div className="flex-1 space-y-4 overflow-y-auto px-4">
          {submitError && (
            <Alert variant="error" onDismiss={() => setSubmitError(null)}>
              {submitError}
            </Alert>
          )}
          <FormField label="Name" htmlFor="expense-name" required error={nameError}>
            <Input
              id="expense-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (nameError && e.target.value.trim()) setNameError(null);
              }}
              onBlur={() => setNameError(validateName(name))}
              aria-invalid={!!nameError}
              placeholder="e.g. Rent"
              autoFocus
            />
          </FormField>
          <FormField label="Amount" htmlFor="expense-amount" required error={amountError}>
            <Input
              id="expense-amount"
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
          <FormField label="Frequency" htmlFor="expense-frequency">
            <Select
              id="expense-frequency"
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
          <FormField label="Category" htmlFor="expense-category">
            <Select
              id="expense-category"
              value={category}
              onChange={(e) => handleCategoryChange(e.target.value)}
            >
              <option value="">None</option>
              {categories.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </Select>
          </FormField>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={isEssential} onChange={(e) => setIsEssential(e.target.checked)} />
            Essential
          </label>
        </div>
        <SheetFooter className="flex-row justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={saving}>
            {saving ? 'Saving…' : isEditing ? 'Save expense' : 'Add expense'}
          </Button>
        </SheetFooter>
      </form>
    </>
  );
}
