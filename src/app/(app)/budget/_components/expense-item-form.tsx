'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { IconCheck, IconX } from '@tabler/icons-react';

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
  initial?: CashflowItem;
  categories: ExpenseCategory[];
  saving: boolean;
  onSave: (data: CreateCashflowItemInput) => void;
  onCancel: () => void;
}

export function ExpenseItemForm({
  initial,
  categories,
  saving,
  onSave,
  onCancel,
}: ExpenseItemFormProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [amount, setAmount] = useState(initial?.amount?.toString() ?? '');
  const [frequency, setFrequency] = useState<CashflowFrequency>(initial?.frequency ?? 'monthly');
  const [category, setCategory] = useState(initial?.category ?? '');
  const [isEssential, setIsEssential] = useState(initial?.is_essential ?? true);

  // When selecting a category, auto-set essential flag to match
  function handleCategoryChange(catName: string) {
    setCategory(catName);
    const cat = categories.find((c) => c.name === catName);
    if (cat) setIsEssential(cat.is_essential);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = parseFloat(amount);
    if (!name.trim() || isNaN(parsed) || parsed <= 0) return;

    const today = new Date().toISOString().split('T')[0];

    onSave({
      name: name.trim(),
      direction: 'outflow',
      bucket: 'expense',
      amount: parsed,
      frequency,
      start_date: initial?.start_date ?? today,
      category: category || null,
      is_essential: isEssential,
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-wrap items-end gap-2 rounded-md bg-muted/30 p-2"
    >
      <div className="min-w-[120px] flex-1">
        <label className="text-xs text-muted-foreground">Name</label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Expense name"
          className="h-7 text-xs"
          autoFocus
        />
      </div>
      <div className="w-[100px]">
        <label className="text-xs text-muted-foreground">Amount</label>
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
        <label className="text-xs text-muted-foreground">Frequency</label>
        <Select
          value={frequency}
          onChange={(e) => setFrequency(e.target.value as CashflowFrequency)}
          className="h-7 px-2 text-xs"
        >
          {CASHFLOW_FREQUENCIES.map((f) => (
            <option key={f} value={f}>
              {FREQ_LABELS[f]}
            </option>
          ))}
        </Select>
      </div>
      <div className="w-[130px]">
        <label className="text-xs text-muted-foreground">Category</label>
        <Select
          value={category}
          onChange={(e) => handleCategoryChange(e.target.value)}
          className="h-7 px-2 text-xs"
        >
          <option value="">None</option>
          {categories.map((c) => (
            <option key={c.id} value={c.name}>
              {c.name}
            </option>
          ))}
        </Select>
      </div>
      <div className="flex h-7 items-center gap-1.5">
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Checkbox checked={isEssential} onChange={(e) => setIsEssential(e.target.checked)} />
          Essential
        </label>
      </div>
      <div className="flex h-7 items-center gap-1">
        <Button type="submit" variant="ghost" size="icon-xs" disabled={saving}>
          <IconCheck size={14} stroke={1.5} className="text-primary" />
        </Button>
        <Button type="button" variant="ghost" size="icon-xs" onClick={onCancel}>
          <IconX size={14} stroke={1.5} />
        </Button>
      </div>
    </form>
  );
}
