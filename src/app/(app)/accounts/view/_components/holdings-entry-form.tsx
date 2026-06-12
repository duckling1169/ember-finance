'use client';

import { useState, useCallback } from 'react';
import type { CurrentPosition, NormalizedHolding } from '@shared/types';
import { fetchQuotes, ingestManual } from '@/lib/api';
import { fmt } from '@/lib/formatters';
import { mutateAccountDetail, mutateAccounts } from '@/lib/swr';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { IconPlus, IconX, IconCheck } from '@tabler/icons-react';

interface HoldingRow {
  id: string;
  symbol: string;
  quantity: string;
  costBasis: string;
  /** Populated after quote fetch (from pre-populated positions) */
  price?: number;
}

interface HoldingsEntryFormProps {
  accountId: string;
  householdId: string;
  existingPositions: CurrentPosition[];
  onSuccess: () => void;
  onCancel: () => void;
}

function makeId() {
  return `row-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function positionsToRows(positions: CurrentPosition[]): HoldingRow[] {
  if (positions.length === 0) {
    return [{ id: makeId(), symbol: '', quantity: '', costBasis: '' }];
  }
  return positions.map((p) => ({
    id: makeId(),
    symbol: p.symbol,
    quantity: String(p.quantity),
    costBasis: p.cost_basis != null ? String(p.cost_basis) : '',
    price: p.effective_price ?? p.snapshot_price ?? undefined,
  }));
}

export function HoldingsEntryForm({
  accountId,
  householdId,
  existingPositions,
  onSuccess,
  onCancel,
}: HoldingsEntryFormProps) {
  const [rows, setRows] = useState<HoldingRow[]>(() => positionsToRows(existingPositions));
  const [asOf, setAsOf] = useState(() => new Date().toISOString().slice(0, 10));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const updateRow = useCallback((id: string, field: keyof HoldingRow, value: string) => {
    setRows((prev) =>
      prev.map((r) =>
        r.id === id ? { ...r, [field]: field === 'symbol' ? value.toUpperCase() : value } : r,
      ),
    );
  }, []);

  function addRow() {
    setRows((prev) => [...prev, { id: makeId(), symbol: '', quantity: '', costBasis: '' }]);
  }

  function removeRow(id: string) {
    setRows((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((r) => r.id !== id);
    });
  }

  /** Check for duplicate symbols */
  function getDuplicates(): string[] {
    const symbols = rows.map((r) => r.symbol.trim().toUpperCase()).filter(Boolean);
    const seen = new Set<string>();
    const dupes = new Set<string>();
    for (const s of symbols) {
      if (seen.has(s)) dupes.add(s);
      seen.add(s);
    }
    return Array.from(dupes);
  }

  /** Computed total from rows that have prices */
  const total = rows.reduce((sum, r) => {
    const qty = parseFloat(r.quantity);
    const price = r.price;
    if (!isNaN(qty) && price != null) return sum + qty * price;
    return sum;
  }, 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    // Validate rows
    const filledRows = rows.filter((r) => r.symbol.trim() !== '');
    if (filledRows.length === 0) {
      setError('Add at least one holding.');
      return;
    }

    for (const r of filledRows) {
      if (!r.quantity || isNaN(parseFloat(r.quantity)) || parseFloat(r.quantity) <= 0) {
        setError(`Invalid shares for ${r.symbol || 'a row'}.`);
        return;
      }
    }

    const dupes = getDuplicates();
    if (dupes.length > 0) {
      setError(`Duplicate symbols: ${dupes.join(', ')}. Combine into one row.`);
      return;
    }

    try {
      setSubmitting(true);

      // 1. Fetch quotes for all symbols
      const symbols = filledRows.map((r) => r.symbol.trim().toUpperCase());
      const quotes = await fetchQuotes(symbols);

      // Check for symbols that failed to fetch
      const failedSymbols = symbols.filter((s) => !quotes[s]);
      if (failedSymbols.length > 0) {
        setError(
          `Could not fetch price for: ${failedSymbols.join(', ')}. Check the symbols and try again.`,
        );
        return;
      }

      // 2. Build NormalizedHolding[] with fetched prices
      const holdings: NormalizedHolding[] = filledRows.map((r) => {
        const sym = r.symbol.trim().toUpperCase();
        const qty = parseFloat(r.quantity);
        const price = quotes[sym]!.price;
        const marketValue = qty * price;
        const costBasis = r.costBasis ? parseFloat(r.costBasis) : undefined;

        return {
          asOf,
          symbol: sym,
          quantity: qty,
          price,
          marketValue,
          costBasis: !isNaN(costBasis as number) ? costBasis : undefined,
        };
      });

      // 3. Ingest
      await ingestManual(householdId, accountId, { holdings });

      // 4. Refresh
      await Promise.all([mutateAccountDetail(accountId), mutateAccounts()]);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save holdings');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <Alert variant="error">{error}</Alert>}

          {/* As-of date */}
          <div className="max-w-xs">
            <label className="mb-1.5 block text-sm font-medium">As Of Date</label>
            <Input type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} required />
          </div>

          {/* Holdings rows */}
          <div className="space-y-2">
            <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 text-xs font-medium text-muted-foreground px-0.5">
              <span>Symbol</span>
              <span>Shares</span>
              <span>Cost Basis ($)</span>
              <span className="w-8" />
            </div>

            {rows.map((row) => (
              <div key={row.id} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-center">
                <Input
                  placeholder="VTI"
                  value={row.symbol}
                  onChange={(e) => updateRow(row.id, 'symbol', e.target.value)}
                  required
                />
                <Input
                  type="number"
                  step="any"
                  min="0"
                  placeholder="100"
                  value={row.quantity}
                  onChange={(e) => updateRow(row.id, 'quantity', e.target.value)}
                  required
                />
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Optional"
                  value={row.costBasis}
                  onChange={(e) => updateRow(row.id, 'costBasis', e.target.value)}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => removeRow(row.id)}
                  disabled={rows.length <= 1}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <IconX size={14} />
                </Button>
              </div>
            ))}
          </div>

          <Button type="button" variant="ghost" size="sm" onClick={addRow}>
            <IconPlus size={14} />
            Add Row
          </Button>

          {/* Total */}
          {total > 0 && (
            <div className="flex justify-end text-sm">
              <span className="text-muted-foreground mr-2">Estimated Total:</span>
              <span className="font-mono tabular-nums font-medium">{fmt(total)}</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onCancel} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" variant="primary-outline" disabled={submitting}>
              <IconCheck size={16} />
              {submitting ? 'Saving...' : 'Save Holdings'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
