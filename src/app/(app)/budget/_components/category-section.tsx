'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { IconPencil, IconTrash, IconCheck, IconX } from '@tabler/icons-react';
import { cn } from '@/lib/utils';
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

interface CategorySectionProps {
  category: ExpenseCategory;
  items: CashflowItem[];
  onEditCategory: (id: string, data: { name?: string; is_essential?: boolean }) => void;
  onDeleteCategory: (id: string) => void;
  onEditItem: (id: string) => void;
  onDeleteItem: (id: string) => void;
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
    if (!editName.trim() || editName.trim() === category.name) {
      setEditing(false);
      return;
    }
    onEditCategory(category.id, { name: editName.trim() });
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
              className="h-6 text-xs"
              autoFocus
            />
            <Button type="submit" variant="ghost" size="icon-xs" disabled={saving}>
              <IconCheck size={14} stroke={1.5} className="text-primary" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
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
            <Button variant="ghost" size="icon-xs" onClick={() => setEditing(true)}>
              <IconPencil size={14} stroke={1.5} />
            </Button>
            <Button variant="ghost" size="icon-xs" onClick={() => onDeleteCategory(category.id)}>
              <IconTrash size={14} stroke={1.5} />
            </Button>
          </>
        )}
      </div>

      {/* Items */}
      {items.length === 0 ? (
        <p className="px-3 py-2 text-xs text-muted-foreground">No expenses in this category</p>
      ) : (
        <div className="divide-y divide-border/20">
          {items.map((item) => (
            <div key={item.id} className="flex items-center gap-3 px-3 py-1.5 hover:bg-muted/30">
              <div className="min-w-0 flex-1">
                <span className="truncate text-sm">{item.name}</span>
              </div>
              <span className="shrink-0 font-mono tabular-nums text-xs text-muted-foreground">
                {fmt(item.amount)}
                <span className="ml-0.5">{FREQ_LABELS[item.frequency]}</span>
              </span>
              <span
                className={cn(
                  'shrink-0 font-mono tabular-nums text-xs',
                  toMonthly(item.amount, item.frequency) > 0
                    ? 'text-foreground'
                    : 'text-muted-foreground',
                )}
              >
                {fmt(toMonthly(item.amount, item.frequency))}/mo
              </span>
              <div className="flex shrink-0 gap-1">
                <Button variant="ghost" size="icon-xs" onClick={() => onEditItem(item.id)}>
                  <IconPencil size={14} stroke={1.5} />
                </Button>
                <Button variant="ghost" size="icon-xs" onClick={() => onDeleteItem(item.id)}>
                  <IconTrash size={14} stroke={1.5} />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface UncategorizedSectionProps {
  items: CashflowItem[];
  onEditItem: (id: string) => void;
  onDeleteItem: (id: string) => void;
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
      <div className="divide-y divide-border/20">
        {items.map((item) => (
          <div key={item.id} className="flex items-center gap-3 px-3 py-1.5 hover:bg-muted/30">
            <div className="min-w-0 flex-1">
              <span className="truncate text-sm">{item.name}</span>
            </div>
            <span className="shrink-0 font-mono tabular-nums text-xs text-muted-foreground">
              {fmt(item.amount)}
              <span className="ml-0.5">{FREQ_LABELS[item.frequency]}</span>
            </span>
            <span className="shrink-0 font-mono tabular-nums text-xs">
              {fmt(toMonthly(item.amount, item.frequency))}/mo
            </span>
            <div className="flex shrink-0 gap-1">
              <Button variant="ghost" size="icon-xs" onClick={() => onEditItem(item.id)}>
                <IconPencil size={14} stroke={1.5} />
              </Button>
              <Button variant="ghost" size="icon-xs" onClick={() => onDeleteItem(item.id)}>
                <IconTrash size={14} stroke={1.5} />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
