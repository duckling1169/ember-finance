'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { IconPlus, IconCheck, IconX } from '@tabler/icons-react';
import { cn } from '@/lib/utils';
import { fmt } from '@/lib/formatters';
import { useFlash } from '@/lib/use-flash';
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
import type { CashflowItem, CreateCashflowItemInput } from '@shared/types';
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

export default function BudgetPage() {
  const { data: categories, isLoading: catLoading } = useExpenseCategories();
  const { data: allItems, isLoading: itemsLoading } = useCashflowItems();
  const { flash, show: showFlash } = useFlash();

  const [saving, setSaving] = useState(false);
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatEssential, setNewCatEssential] = useState(true);
  const [addingExpense, setAddingExpense] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

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

  async function handleCreateCategory(e: React.FormEvent) {
    e.preventDefault();
    if (!newCatName.trim()) return;
    setSaving(true);
    try {
      await createExpenseCategory({ name: newCatName.trim(), is_essential: newCatEssential });
      await mutateExpenseCategories();
      setAddingCategory(false);
      setNewCatName('');
      setNewCatEssential(true);
    } catch (err) {
      showFlash('error', err instanceof Error ? err.message : 'Failed to create category');
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
    } catch (err) {
      showFlash('error', err instanceof Error ? err.message : 'Failed to update category');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteCategory(id: string) {
    setSaving(true);
    try {
      await deleteExpenseCategory(id);
      await Promise.all([mutateExpenseCategories(), mutateCashflowItems()]);
    } catch (err) {
      showFlash('error', err instanceof Error ? err.message : 'Failed to delete category');
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateExpense(data: CreateCashflowItemInput) {
    setSaving(true);
    try {
      await createCashflowItem(data);
      await Promise.all([mutateCashflowItems(), mutatePlanningComputed()]);
      setAddingExpense(false);
    } catch (err) {
      showFlash('error', err instanceof Error ? err.message : 'Failed to create expense');
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateExpense(id: string, data: CreateCashflowItemInput) {
    setSaving(true);
    try {
      await updateCashflowItem(id, data);
      await Promise.all([mutateCashflowItems(), mutatePlanningComputed()]);
      setEditingItemId(null);
    } catch (err) {
      showFlash('error', err instanceof Error ? err.message : 'Failed to update expense');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteExpense(id: string) {
    setSaving(true);
    try {
      await deleteCashflowItem(id);
      await Promise.all([mutateCashflowItems(), mutatePlanningComputed()]);
    } catch (err) {
      showFlash('error', err instanceof Error ? err.message : 'Failed to delete expense');
    } finally {
      setSaving(false);
    }
  }

  function renderEditingItem(item: CashflowItem) {
    return (
      <ExpenseItemForm
        key={item.id}
        initial={item}
        categories={categories ?? []}
        saving={saving}
        onSave={(data) => handleUpdateExpense(item.id, data)}
        onCancel={() => setEditingItemId(null)}
      />
    );
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Budget</h1>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAddingCategory(true)}
            disabled={addingCategory}
          >
            <IconPlus size={14} stroke={1.5} className="mr-1" />
            Category
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAddingExpense(true)}
            disabled={addingExpense}
          >
            <IconPlus size={14} stroke={1.5} className="mr-1" />
            Expense
          </Button>
        </div>
      </div>

      {flash && (
        <div
          className={cn(
            'rounded-md px-3 py-1.5 text-xs',
            flash.type === 'error' ? 'bg-destructive/10 text-destructive' : 'bg-gain/10 text-gain',
          )}
        >
          {flash.message}
        </div>
      )}

      {/* Totals bar */}
      <div className="flex gap-3">
        <Card size="sm" className="flex-1">
          <CardContent className="py-2">
            <p className="text-xs text-muted-foreground">Essentials</p>
            <p className="font-mono tabular-nums text-lg font-semibold">
              {fmt(essentialTotal)}
              <span className="text-xs text-muted-foreground font-normal">/mo</span>
            </p>
          </CardContent>
        </Card>
        <Card size="sm" className="flex-1">
          <CardContent className="py-2">
            <p className="text-xs text-muted-foreground">Non-essentials</p>
            <p className="font-mono tabular-nums text-lg font-semibold">
              {fmt(nonEssentialTotal)}
              <span className="text-xs text-muted-foreground font-normal">/mo</span>
            </p>
          </CardContent>
        </Card>
        <Card size="sm" className="flex-1">
          <CardContent className="py-2">
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="font-mono tabular-nums text-lg font-semibold">
              {fmt(grandTotal)}
              <span className="text-xs text-muted-foreground font-normal">/mo</span>
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Add category form */}
      {addingCategory && (
        <form
          onSubmit={handleCreateCategory}
          className="flex items-end gap-2 rounded-md bg-muted/30 p-2"
        >
          <div className="min-w-[160px] flex-1">
            <label className="text-[10px] text-muted-foreground">Category Name</label>
            <Input
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              placeholder="e.g. Groceries"
              className="h-7 text-xs"
              autoFocus
            />
          </div>
          <div className="flex h-7 items-center gap-1.5">
            <label className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <input
                type="checkbox"
                checked={newCatEssential}
                onChange={(e) => setNewCatEssential(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-border accent-primary"
              />
              Essential
            </label>
          </div>
          <div className="flex h-7 items-center gap-1">
            <Button
              type="submit"
              variant="ghost"
              size="icon-xs"
              disabled={saving || !newCatName.trim()}
            >
              <IconCheck size={14} stroke={1.5} className="text-primary" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={() => {
                setAddingCategory(false);
                setNewCatName('');
              }}
            >
              <IconX size={14} stroke={1.5} />
            </Button>
          </div>
        </form>
      )}

      {/* Add expense form */}
      {addingExpense && (
        <ExpenseItemForm
          categories={categories ?? []}
          saving={saving}
          onSave={handleCreateExpense}
          onCancel={() => setAddingExpense(false)}
        />
      )}

      {/* Editing an existing item inline */}
      {editingItemId &&
        (() => {
          const item = expenseItems.find((i) => i.id === editingItemId);
          if (!item) return null;
          return renderEditingItem(item);
        })()}

      {isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}

      {!isLoading && (
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
                onDeleteCategory={handleDeleteCategory}
                onEditItem={setEditingItemId}
                onDeleteItem={handleDeleteExpense}
                saving={saving}
              />
            ))}
            <UncategorizedSection
              items={uncategorizedEssential}
              onEditItem={setEditingItemId}
              onDeleteItem={handleDeleteExpense}
            />
            {essentialCats.length === 0 && uncategorizedEssential.length === 0 && (
              <p className="text-sm text-muted-foreground">No essential expenses yet.</p>
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
                onDeleteCategory={handleDeleteCategory}
                onEditItem={setEditingItemId}
                onDeleteItem={handleDeleteExpense}
                saving={saving}
              />
            ))}
            <UncategorizedSection
              items={uncategorizedNonEssential}
              onEditItem={setEditingItemId}
              onDeleteItem={handleDeleteExpense}
            />
            {nonEssentialCats.length === 0 && uncategorizedNonEssential.length === 0 && (
              <p className="text-sm text-muted-foreground">No non-essential expenses yet.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
