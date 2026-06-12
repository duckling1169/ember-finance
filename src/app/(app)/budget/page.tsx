'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert } from '@/components/ui/alert';
import { FormField } from '@/components/ui/form-field';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EmptyState, LoadingState } from '@/components/ui/states';
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { IconPlus, IconReceipt2 } from '@tabler/icons-react';

import { fmt } from '@/lib/formatters';
import { useToast } from '@/components/ui/toast';
import {
  useExpenseCategories,
  mutateExpenseCategories,
  useCashflowItems,
  mutateCashflowItems,
  mutatePlanningComputed,
} from '@/lib/swr';
import {
  createExpenseCategory,
  updateExpenseCategory,
  deleteExpenseCategory,
  createCashflowItem,
  updateCashflowItem,
  deleteCashflowItem,
} from '@/lib/api';
import type { CashflowItem, CreateCashflowItemInput, ExpenseCategory } from '@shared/types';
import { CategorySection, UncategorizedSection } from './_components/category-section';
import { ExpenseItemForm } from './_components/expense-item-form';

const TO_MONTHLY: Record<string, number> = {
  monthly: 1,
  biweekly: 26 / 12,
  annual: 1 / 12,
  one_time: 0,
};

function toMonthly(amount: number, frequency: string): number {
  return amount * (TO_MONTHLY[frequency] ?? 0);
}

type DeleteTarget =
  | { kind: 'category'; id: string; name: string }
  | { kind: 'expense'; id: string; name: string };

interface CategorySheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  saving: boolean;
  /** Must throw on failure — the error is shown in an Alert inside the sheet. */
  onSave: (data: { name: string; is_essential: boolean }) => Promise<void>;
}

/** "Add category" side panel: Name + Essential. */
function CategorySheet({ open, onOpenChange, saving, onSave }: CategorySheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right">
        {open && <CategorySheetBody onOpenChange={onOpenChange} saving={saving} onSave={onSave} />}
      </SheetContent>
    </Sheet>
  );
}

// Mounted only while the sheet is open, so form state initializes fresh on every open.
function CategorySheetBody({ onOpenChange, saving, onSave }: Omit<CategorySheetProps, 'open'>) {
  const [name, setName] = useState('');
  const [essential, setEssential] = useState(true);
  const [nameError, setNameError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  function validateName(value: string): string | null {
    return value.trim() ? null : 'Name is required';
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const nErr = validateName(name);
    setNameError(nErr);
    if (nErr) return;
    setSubmitError(null);
    try {
      await onSave({ name: name.trim(), is_essential: essential });
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to create category');
    }
  }

  return (
    <>
      <SheetHeader>
        <SheetTitle>Add category</SheetTitle>
        <SheetDescription>Group your expenses under a named category.</SheetDescription>
      </SheetHeader>
      <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
        <div className="flex-1 space-y-4 overflow-y-auto px-4">
          {submitError && (
            <Alert variant="error" onDismiss={() => setSubmitError(null)}>
              {submitError}
            </Alert>
          )}
          <FormField label="Name" htmlFor="category-name" required error={nameError}>
            <Input
              id="category-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (nameError && e.target.value.trim()) setNameError(null);
              }}
              onBlur={() => setNameError(validateName(name))}
              aria-invalid={!!nameError}
              placeholder="e.g. Groceries"
              autoFocus
            />
          </FormField>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={essential} onChange={(e) => setEssential(e.target.checked)} />
            Essential
          </label>
        </div>
        <SheetFooter className="flex-row justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={saving}>
            {saving ? 'Saving…' : 'Add category'}
          </Button>
        </SheetFooter>
      </form>
    </>
  );
}

export default function BudgetPage() {
  const { data: categories, isLoading: catLoading } = useExpenseCategories();
  const { data: allItems, isLoading: itemsLoading } = useCashflowItems();
  const toast = useToast();

  const [saving, setSaving] = useState(false);
  const [categorySheetOpen, setCategorySheetOpen] = useState(false);
  const [expenseSheetOpen, setExpenseSheetOpen] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);

  // Filter to expense items only
  const expenseItems = useMemo(
    () => (allItems ?? []).filter((i) => i.bucket === 'expense'),
    [allItems],
  );

  // Split by essential
  const essentialCats = useMemo(
    () => (categories ?? []).filter((c) => c.is_essential),
    [categories],
  );
  const nonEssentialCats = useMemo(
    () => (categories ?? []).filter((c) => !c.is_essential),
    [categories],
  );

  // Group items by category
  function itemsForCategory(catName: string) {
    return expenseItems.filter((i) => i.category === catName);
  }

  const uncategorizedEssential = expenseItems.filter((i) => !i.category && i.is_essential);
  const uncategorizedNonEssential = expenseItems.filter((i) => !i.category && !i.is_essential);

  // Totals
  const essentialTotal = expenseItems
    .filter((i) => i.is_essential)
    .reduce((sum, i) => sum + toMonthly(i.amount, i.frequency), 0);
  const nonEssentialTotal = expenseItems
    .filter((i) => !i.is_essential)
    .reduce((sum, i) => sum + toMonthly(i.amount, i.frequency), 0);
  const grandTotal = essentialTotal + nonEssentialTotal;

  const isLoading = catLoading || itemsLoading;

  const editingItem = editingItemId
    ? (expenseItems.find((i) => i.id === editingItemId) ?? null)
    : null;

  function openAddExpense() {
    setEditingItemId(null);
    setExpenseSheetOpen(true);
  }

  function openEditExpense(id: string) {
    setEditingItemId(id);
    setExpenseSheetOpen(true);
  }

  // Throws on failure so the sheet can show the error inline.
  async function handleSaveExpense(data: CreateCashflowItemInput) {
    setSaving(true);
    try {
      if (editingItem) {
        await updateCashflowItem(editingItem.id, data);
      } else {
        await createCashflowItem(data);
      }
      await Promise.all([mutateCashflowItems(), mutatePlanningComputed()]);
      toast('success', editingItem ? 'Expense updated' : 'Expense added');
      setExpenseSheetOpen(false);
    } finally {
      setSaving(false);
    }
  }

  // Throws on failure so the sheet can show the error inline.
  async function handleSaveCategory(data: { name: string; is_essential: boolean }) {
    setSaving(true);
    try {
      await createExpenseCategory(data);
      await mutateExpenseCategories();
      toast('success', 'Category added');
      setCategorySheetOpen(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateCategory(id: string, data: { name?: string; is_essential?: boolean }) {
    setSaving(true);
    try {
      await updateExpenseCategory(id, data);
      await Promise.all([
        mutateExpenseCategories(),
        mutateCashflowItems(),
        mutatePlanningComputed(),
      ]);
      toast('success', 'Category updated');
    } catch (err) {
      setPageError(err instanceof Error ? err.message : 'Failed to update category');
    } finally {
      setSaving(false);
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      if (deleteTarget.kind === 'category') {
        await deleteExpenseCategory(deleteTarget.id);
        await Promise.all([mutateExpenseCategories(), mutateCashflowItems()]);
        toast('success', 'Category deleted');
      } else {
        await deleteCashflowItem(deleteTarget.id);
        await Promise.all([mutateCashflowItems(), mutatePlanningComputed()]);
        toast('success', 'Expense deleted');
      }
    } catch (err) {
      setPageError(
        err instanceof Error
          ? err.message
          : `Failed to delete ${deleteTarget.kind === 'category' ? 'category' : 'expense'}`,
      );
    } finally {
      setSaving(false);
      setDeleteTarget(null);
    }
  }

  const requestDeleteCategory = (category: ExpenseCategory) =>
    setDeleteTarget({ kind: 'category', id: category.id, name: category.name });
  const requestDeleteExpense = (item: CashflowItem) =>
    setDeleteTarget({ kind: 'expense', id: item.id, name: item.name });

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Budget</h1>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => setCategorySheetOpen(true)}>
            <IconPlus size={14} stroke={1.5} />
            Add category
          </Button>
          <Button variant="primary" size="sm" onClick={openAddExpense}>
            <IconPlus size={14} stroke={1.5} />
            Add expense
          </Button>
        </div>
      </div>

      {pageError && (
        <Alert variant="error" onDismiss={() => setPageError(null)}>
          {pageError}
        </Alert>
      )}

      {/* Totals bar */}
      <div className="flex flex-wrap gap-3">
        <Card size="sm" className="min-w-[140px] flex-1">
          <CardContent className="py-2">
            <p className="text-sm text-muted-foreground">Essentials</p>
            <p className="font-mono tabular-nums text-xl font-semibold">
              {fmt(essentialTotal)}
              <span className="text-xs text-muted-foreground font-normal">/mo</span>
            </p>
          </CardContent>
        </Card>
        <Card size="sm" className="min-w-[140px] flex-1">
          <CardContent className="py-2">
            <p className="text-sm text-muted-foreground">Non-essentials</p>
            <p className="font-mono tabular-nums text-xl font-semibold">
              {fmt(nonEssentialTotal)}
              <span className="text-xs text-muted-foreground font-normal">/mo</span>
            </p>
          </CardContent>
        </Card>
        <Card size="sm" className="min-w-[140px] flex-1">
          <CardContent className="py-2">
            <p className="text-sm text-muted-foreground">Total</p>
            <p className="font-mono tabular-nums text-xl font-semibold">
              {fmt(grandTotal)}
              <span className="text-xs text-muted-foreground font-normal">/mo</span>
            </p>
          </CardContent>
        </Card>
      </div>

      {isLoading ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <LoadingState rows={4} />
          <LoadingState rows={4} />
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Essentials column */}
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Essentials
            </h2>
            {essentialCats.map((cat) => (
              <CategorySection
                key={cat.id}
                category={cat}
                items={itemsForCategory(cat.name)}
                onEditCategory={handleUpdateCategory}
                onDeleteCategory={requestDeleteCategory}
                onEditItem={openEditExpense}
                onDeleteItem={requestDeleteExpense}
                saving={saving}
              />
            ))}
            <UncategorizedSection
              items={uncategorizedEssential}
              onEditItem={openEditExpense}
              onDeleteItem={requestDeleteExpense}
            />
            {essentialCats.length === 0 && uncategorizedEssential.length === 0 && (
              <EmptyState
                icon={IconReceipt2}
                title="No essential expenses yet"
                description="Track rent, groceries, utilities, and other must-pay costs."
                action={
                  <Button variant="secondary" size="sm" onClick={openAddExpense}>
                    <IconPlus size={14} stroke={1.5} />
                    Add expense
                  </Button>
                }
              />
            )}
          </div>

          {/* Non-essentials column */}
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Non-essentials
            </h2>
            {nonEssentialCats.map((cat) => (
              <CategorySection
                key={cat.id}
                category={cat}
                items={itemsForCategory(cat.name)}
                onEditCategory={handleUpdateCategory}
                onDeleteCategory={requestDeleteCategory}
                onEditItem={openEditExpense}
                onDeleteItem={requestDeleteExpense}
                saving={saving}
              />
            ))}
            <UncategorizedSection
              items={uncategorizedNonEssential}
              onEditItem={openEditExpense}
              onDeleteItem={requestDeleteExpense}
            />
            {nonEssentialCats.length === 0 && uncategorizedNonEssential.length === 0 && (
              <EmptyState
                icon={IconReceipt2}
                title="No non-essential expenses yet"
                description="Track dining out, subscriptions, hobbies, and other flexible spending."
                action={
                  <Button variant="secondary" size="sm" onClick={openAddExpense}>
                    <IconPlus size={14} stroke={1.5} />
                    Add expense
                  </Button>
                }
              />
            )}
          </div>
        </div>
      )}

      {/* Add / edit expense side panel */}
      <ExpenseItemForm
        open={expenseSheetOpen}
        onOpenChange={setExpenseSheetOpen}
        initial={editingItem}
        categories={categories ?? []}
        saving={saving}
        onSave={handleSaveExpense}
      />

      {/* Add category side panel */}
      <CategorySheet
        open={categorySheetOpen}
        onOpenChange={setCategorySheetOpen}
        saving={saving}
        onSave={handleSaveCategory}
      />

      {/* Delete confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title={
          deleteTarget?.kind === 'category'
            ? `Delete category "${deleteTarget.name}"?`
            : `Delete expense "${deleteTarget?.name}"?`
        }
        description={
          deleteTarget?.kind === 'category'
            ? 'Expenses in this category are not deleted — they move to Uncategorized.'
            : 'This permanently removes the expense from your budget.'
        }
        confirmLabel={deleteTarget?.kind === 'category' ? 'Delete category' : 'Delete expense'}
        busy={saving}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
