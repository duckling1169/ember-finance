'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import { IconPencil, IconTrash, IconCheck, IconX } from '@tabler/icons-react';
import { fmt } from '@/lib/formatters';
import type { CashflowItem, ExpenseCategory } from '@shared/types';

const FREQ_LABELS: Record<string, string> = {
  monthly: '/mo',
  biweekly: '/2wk',
  annual: '/yr',
  one_time: 'once',
};

const TO_MONTHLY: Record<string, number> = {
  monthly: 1,
  biweekly: 26 / 12,
  annual: 1 / 12,
  one_time: 0,
};

function toMonthly(amount: number, frequency: string): number {
  return amount * (TO_MONTHLY[frequency] ?? 0);
}

/** Compact expense rows shared by categorized + uncategorized sections. */
function ExpenseItemsTable({
  items,
  onEditItem,
  onDeleteItem,
}: {
  items: CashflowItem[];
  onEditItem: (id: string) => void;
  onDeleteItem: (item: CashflowItem) => void;
}) {
  const columns: DataTableColumn<CashflowItem>[] = [
    {
      key: 'name',
      header: 'Name',
      priority: 1,
      cell: (item) => <span className="truncate">{item.name}</span>,
    },
    {
      key: 'monthly',
      header: 'Monthly',
      numeric: true,
      priority: 1,
      cell: (item) => (
        <>
          <span>{fmt(toMonthly(item.amount, item.frequency))}/mo</span>
          {item.frequency !== 'monthly' && (
            <span className="block text-muted-foreground/60">
              ({fmt(item.amount)} {FREQ_LABELS[item.frequency]})
            </span>
          )}
        </>
      ),
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
            onClick={() => onEditItem(item.id)}
          >
            <IconPencil size={14} stroke={1.5} />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Delete ${item.name}`}
            onClick={() => onDeleteItem(item)}
          >
            <IconTrash size={14} stroke={1.5} />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={items}
      rowKey={(item) => item.id}
      density="compact"
      mobile="priority"
      className="px-3 pb-1"
    />
  );
}

interface CategorySectionProps {
  category: ExpenseCategory;
  items: CashflowItem[];
  onEditCategory: (id: string, data: { name?: string; is_essential?: boolean }) => void;
  onDeleteCategory: (category: ExpenseCategory) => void;
  onEditItem: (id: string) => void;
  onDeleteItem: (item: CashflowItem) => void;
  saving: boolean;
}

export function CategorySection({
  category,
  items,
  onEditCategory,
  onDeleteCategory,
  onEditItem,
  onDeleteItem,
  saving,
}: CategorySectionProps) {
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(category.name);

  const monthlyTotal = items.reduce((sum, i) => sum + toMonthly(i.amount, i.frequency), 0);

  function handleSaveName() {
    const trimmed = editName.trim();
    if (!trimmed) return; // non-empty required — stay in edit mode
    if (trimmed === category.name) {
      setEditing(false);
      return;
    }
    onEditCategory(category.id, { name: trimmed });
    setEditing(false);
  }

  return (
    <div className="rounded-lg border border-border/50 bg-card">
      {/* Category header */}
      <div className="flex items-center gap-2 border-b border-border/30 px-3 py-2">
        {editing ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSaveName();
            }}
            className="flex flex-1 items-center gap-1"
          >
            <Input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              aria-label="Category name"
              aria-invalid={!editName.trim()}
              className="h-7 text-xs"
              autoFocus
            />
            <Button
              type="submit"
              variant="ghost"
              size="icon-sm"
              aria-label="Save category name"
              disabled={saving || !editName.trim()}
            >
              <IconCheck size={14} stroke={1.5} className="text-primary" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Cancel rename"
              onClick={() => {
                setEditName(category.name);
                setEditing(false);
              }}
            >
              <IconX size={14} stroke={1.5} />
            </Button>
          </form>
        ) : (
          <>
            <span className="flex-1 text-sm font-medium">{category.name}</span>
            <span className="font-mono tabular-nums text-xs text-muted-foreground">
              {fmt(monthlyTotal)}/mo
            </span>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Rename ${category.name}`}
              onClick={() => {
                setEditName(category.name);
                setEditing(true);
              }}
            >
              <IconPencil size={14} stroke={1.5} />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Delete ${category.name}`}
              onClick={() => onDeleteCategory(category)}
            >
              <IconTrash size={14} stroke={1.5} />
            </Button>
          </>
        )}
      </div>

      {/* Items */}
      {items.length === 0 ? (
        <p className="px-3 py-2 text-xs text-muted-foreground">No expenses in this category</p>
      ) : (
        <ExpenseItemsTable items={items} onEditItem={onEditItem} onDeleteItem={onDeleteItem} />
      )}
    </div>
  );
}

interface UncategorizedSectionProps {
  items: CashflowItem[];
  onEditItem: (id: string) => void;
  onDeleteItem: (item: CashflowItem) => void;
}

export function UncategorizedSection({
  items,
  onEditItem,
  onDeleteItem,
}: UncategorizedSectionProps) {
  if (items.length === 0) return null;

  const monthlyTotal = items.reduce((sum, i) => sum + toMonthly(i.amount, i.frequency), 0);

  return (
    <div className="rounded-lg border border-dashed border-border/50 bg-card">
      <div className="flex items-center gap-2 border-b border-border/30 px-3 py-2">
        <span className="flex-1 text-sm font-medium text-muted-foreground">Uncategorized</span>
        <span className="font-mono tabular-nums text-xs text-muted-foreground">
          {fmt(monthlyTotal)}/mo
        </span>
      </div>
      <ExpenseItemsTable items={items} onEditItem={onEditItem} onDeleteItem={onDeleteItem} />
    </div>
  );
}
