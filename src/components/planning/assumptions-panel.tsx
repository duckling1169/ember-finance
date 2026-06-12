'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { InfoTip } from '@/components/ui/info-tip';
import { Alert } from '@/components/ui/alert';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { FormField } from '@/components/ui/form-field';
import { IconHistory, IconPencil } from '@tabler/icons-react';
import { createAssumptionRecord, deleteAssumptionRecord, getAssumptionHistory } from '@/lib/api';
import { useToast } from '@/components/ui/toast';
import { useAssumptions, mutateAssumptions, mutatePlanningComputed } from '@/lib/swr';
import { fmt, fmtPct } from '@/lib/formatters';
import { cn } from '@/lib/utils';

import {
  ASSUMPTION_KEYS,
  ASSUMPTION_GROUP_LABELS,
  type AssumptionGroup,
  type AssumptionKeyMeta,
  type AssumptionSource,
  type ResolvedAssumption,
} from '@shared/types';

const GROUP_ORDER: AssumptionGroup[] = [
  'returns',
  'retirement',
  'tax_core',
  'tax_limits',
  'tax_rules',
  'allocation',
];

const SOURCE_LABELS: Record<AssumptionSource, string> = {
  default: 'Default',
  household: 'Edited',
  scenario: 'Scenario',
};

const ENUM_LABELS: Record<string, string> = {
  none: 'None',
  inflation: 'Match Inflation',
  fixed_rate: 'Fixed Rate',
};

/**
 * The audit surface (design principles 3 + 7): every assumption behind any
 * number on screen, each with its own value, effective date, source layer, and
 * append-only history revealed on demand. Rendered full-page at /assumptions.
 */
/** One row open at a time — keeps a single primary action visible per view. */
export interface ActiveAssumptionRow {
  key: string;
  mode: 'edit' | 'history';
}

export function AssumptionsPanel({ scenarioId }: { scenarioId?: string }) {
  const { data, isLoading } = useAssumptions(scenarioId);
  const [activeRow, setActiveRow] = useState<ActiveAssumptionRow | null>(null);

  const byKey = new Map<string, ResolvedAssumption>(
    (data?.assumptions ?? []).map((a) => [a.key, a]),
  );

  return (
    <div className="space-y-5">
      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      )}

      {data &&
        GROUP_ORDER.map((group) => (
          <AssumptionGroupSection
            key={group}
            group={group}
            scenarioId={scenarioId}
            byKey={byKey}
            asOf={data.as_of}
            activeRow={activeRow}
            setActiveRow={setActiveRow}
          />
        ))}
    </div>
  );
}

export function getAssumptionsTaxYear(
  assumptions: ResolvedAssumption[] | undefined,
): number | null {
  const brackets = assumptions?.find((a) => a.key === 'tax.federal_brackets');
  return getTableYear(brackets?.value);
}

function AssumptionGroupSection({
  group,
  scenarioId,
  byKey,
  asOf,
  activeRow,
  setActiveRow,
}: {
  group: AssumptionGroup;
  scenarioId?: string;
  byKey: Map<string, ResolvedAssumption>;
  asOf: string;
  activeRow: ActiveAssumptionRow | null;
  setActiveRow: (row: ActiveAssumptionRow | null) => void;
}) {
  const metas = ASSUMPTION_KEYS.filter((k) => k.group === group);

  return (
    <div>
      <h3 className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {ASSUMPTION_GROUP_LABELS[group]}
      </h3>
      <div className="divide-y divide-border rounded-lg border bg-card">
        {metas.map((meta) => (
          <AssumptionRow
            key={meta.key}
            meta={meta}
            resolved={byKey.get(meta.key)}
            scenarioId={scenarioId}
            asOf={asOf}
            mode={activeRow?.key === meta.key ? activeRow.mode : null}
            setMode={(mode) => setActiveRow(mode ? { key: meta.key, mode } : null)}
          />
        ))}
      </div>
    </div>
  );
}

function AssumptionRow({
  meta,
  resolved,
  scenarioId,
  asOf,
  mode,
  setMode,
}: {
  meta: AssumptionKeyMeta;
  resolved: ResolvedAssumption | undefined;
  scenarioId?: string;
  asOf: string;
  mode: 'edit' | 'history' | null;
  setMode: (mode: 'edit' | 'history' | null) => void;
}) {
  return (
    <div className="px-3 py-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          <span className="truncate text-sm">{meta.label}</span>
          <InfoTip content={meta.description} size={13} />
          {resolved && <SourceBadge source={resolved.source} />}
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="font-mono text-sm tabular-nums">
              {resolved ? formatValue(meta, resolved.value) : '—'}
            </div>
            {resolved && (
              <div className="text-xs text-muted-foreground">as of {resolved.effective_date}</div>
            )}
          </div>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Edit ${meta.label}`}
              aria-expanded={mode === 'edit'}
              onClick={() => setMode(mode === 'edit' ? null : 'edit')}
            >
              <IconPencil size={14} stroke={1.5} />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`History of ${meta.label}`}
              aria-expanded={mode === 'history'}
              onClick={() => setMode(mode === 'history' ? null : 'history')}
            >
              <IconHistory size={14} stroke={1.5} />
            </Button>
          </div>
        </div>
      </div>

      {mode === 'edit' && resolved && (
        <AssumptionEditor
          meta={meta}
          currentValue={resolved.value}
          scenarioId={scenarioId}
          asOf={asOf}
          onDone={() => setMode(null)}
        />
      )}
      {mode === 'history' && <AssumptionHistory meta={meta} scenarioId={scenarioId} />}
    </div>
  );
}

function SourceBadge({ source }: { source: AssumptionSource }) {
  return (
    <span
      className={cn(
        'rounded px-1.5 py-0.5 text-xs leading-none',
        source === 'default' && 'bg-muted text-muted-foreground',
        source === 'household' && 'bg-primary/15 text-primary',
        source === 'scenario' && 'bg-scenario/15 text-scenario',
      )}
    >
      {SOURCE_LABELS[source]}
    </span>
  );
}

function AssumptionEditor({
  meta,
  currentValue,
  scenarioId,
  asOf,
  onDone,
}: {
  meta: AssumptionKeyMeta;
  currentValue: unknown;
  scenarioId?: string;
  asOf: string;
  onDone: () => void;
}) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [effectiveDate, setEffectiveDate] = useState(asOf);
  const [note, setNote] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [dateError, setDateError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [rateStr, setRateStr] = useState(
    meta.kind === 'rate' && typeof currentValue === 'number' ? (currentValue * 100).toString() : '',
  );
  const [currencyStr, setCurrencyStr] = useState(
    meta.kind === 'currency' && typeof currentValue === 'number' ? currentValue.toString() : '',
  );
  const [enumVal, setEnumVal] = useState(
    meta.kind === 'enum' && typeof currentValue === 'string'
      ? currentValue
      : (meta.enum_options?.[0] ?? ''),
  );
  const [jsonStr, setJsonStr] = useState(
    meta.kind === 'table' ? JSON.stringify(currentValue, null, 2) : '',
  );

  function validate(): { ok: boolean; value?: unknown } {
    switch (meta.kind) {
      case 'rate': {
        if (rateStr === '' && meta.nullable) return { ok: true, value: null };
        const parsed = parseFloat(rateStr);
        if (Number.isNaN(parsed)) {
          setFieldError('Enter a percentage, e.g. 6.5');
          return { ok: false };
        }
        return { ok: true, value: parsed / 100 };
      }
      case 'currency': {
        if (currencyStr === '' && meta.nullable) return { ok: true, value: null };
        const parsed = parseFloat(currencyStr);
        if (Number.isNaN(parsed)) {
          setFieldError('Enter a dollar amount');
          return { ok: false };
        }
        return { ok: true, value: parsed };
      }
      case 'enum':
        return { ok: true, value: enumVal };
      case 'table':
        try {
          return { ok: true, value: JSON.parse(jsonStr) };
        } catch {
          setFieldError('Invalid JSON');
          return { ok: false };
        }
    }
  }

  /** Validate on blur; the change handlers clear the error as soon as input becomes valid. */
  function handleBlur() {
    setFieldError(null);
    validate();
  }

  async function handleSave() {
    setFieldError(null);
    if (!effectiveDate) {
      setDateError('An effective date is required');
      return;
    }
    const result = validate();
    if (!result.ok) return;

    setSaving(true);
    setSaveError(null);
    try {
      await createAssumptionRecord({
        key: meta.key,
        value: result.value,
        effective_date: effectiveDate,
        note: note.trim() || null,
        scenario_id: scenarioId ?? null,
      });
      await Promise.all([mutateAssumptions(), mutatePlanningComputed()]);
      toast('success', `${meta.label} updated`);
      onDone();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  const dateId = `assumption-date-${meta.key}`;
  const valueId = `assumption-value-${meta.key}`;

  return (
    <div className="mt-2 space-y-2 rounded-md bg-muted/40 p-2.5">
      <div className="flex flex-wrap items-end gap-2">
        {meta.kind === 'rate' && (
          <FormField label="Value (%)" htmlFor={valueId} error={fieldError}>
            <Input
              id={valueId}
              type="number"
              step="0.1"
              value={rateStr}
              aria-invalid={!!fieldError}
              onChange={(e) => {
                setRateStr(e.target.value);
                if (fieldError && !Number.isNaN(parseFloat(e.target.value))) setFieldError(null);
              }}
              onBlur={handleBlur}
              placeholder={meta.nullable ? 'Blank = none' : undefined}
              className="h-8 w-28 font-mono text-xs"
            />
          </FormField>
        )}
        {meta.kind === 'currency' && (
          <FormField label="Value ($/yr)" htmlFor={valueId} error={fieldError}>
            <Input
              id={valueId}
              type="number"
              step="1000"
              min="0"
              value={currencyStr}
              aria-invalid={!!fieldError}
              onChange={(e) => {
                setCurrencyStr(e.target.value);
                if (fieldError && !Number.isNaN(parseFloat(e.target.value))) setFieldError(null);
              }}
              onBlur={handleBlur}
              placeholder={meta.nullable ? 'Blank = use budget' : undefined}
              className="h-8 w-32 font-mono text-xs"
            />
          </FormField>
        )}
        {meta.kind === 'enum' && (
          <FormField label="Value" htmlFor={valueId}>
            <Select
              id={valueId}
              value={enumVal}
              onChange={(e) => setEnumVal(e.target.value)}
              className="h-8 px-2 text-xs"
            >
              {meta.enum_options?.map((opt) => (
                <option key={opt} value={opt}>
                  {ENUM_LABELS[opt] ?? opt}
                </option>
              ))}
            </Select>
          </FormField>
        )}

        <FormField label="Effective date" htmlFor={dateId} required error={dateError}>
          <Input
            id={dateId}
            type="date"
            value={effectiveDate}
            aria-invalid={!!dateError}
            onChange={(e) => {
              setEffectiveDate(e.target.value);
              if (e.target.value) setDateError(null);
            }}
            onBlur={() => setDateError(effectiveDate ? null : 'An effective date is required')}
            className="h-8 w-36 text-xs"
          />
        </FormField>

        <FormField label="Note (optional)" htmlFor={`assumption-note-${meta.key}`}>
          <Input
            id={`assumption-note-${meta.key}`}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Why this change?"
            className="h-8 w-44 text-xs"
          />
        </FormField>

        <div className="ml-auto flex gap-1.5">
          <Button size="sm" variant="ghost" onClick={onDone}>
            Cancel
          </Button>
          <Button size="sm" variant="primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>

      {meta.kind === 'table' && (
        <FormField
          label="Value (JSON) — validated on save"
          htmlFor={`assumption-json-${meta.key}`}
          error={fieldError}
        >
          <textarea
            id={`assumption-json-${meta.key}`}
            value={jsonStr}
            aria-invalid={!!fieldError}
            onChange={(e) => {
              setJsonStr(e.target.value);
              if (fieldError) {
                try {
                  JSON.parse(e.target.value);
                  setFieldError(null);
                } catch {
                  /* still invalid — keep the error until fixed */
                }
              }
            }}
            onBlur={handleBlur}
            rows={Math.min(14, jsonStr.split('\n').length)}
            spellCheck={false}
            className="mt-1 w-full rounded-md border bg-background p-2 font-mono text-xs"
          />
        </FormField>
      )}

      {saveError && (
        <Alert size="sm" onDismiss={() => setSaveError(null)}>
          {saveError}
        </Alert>
      )}
    </div>
  );
}

function AssumptionHistory({ meta, scenarioId }: { meta: AssumptionKeyMeta; scenarioId?: string }) {
  const toast = useToast();
  const {
    data,
    error,
    mutate: mutateHistory,
  } = useSWR(['assumption-history', meta.key, scenarioId ?? 'base'], () =>
    getAssumptionHistory(meta.key, scenarioId),
  );
  const entries = data?.history;
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleDelete() {
    if (!confirmId) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteAssumptionRecord(confirmId);
      await Promise.all([mutateHistory(), mutateAssumptions(), mutatePlanningComputed()]);
      toast('success', 'Record removed');
      setConfirmId(null);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete record');
      setConfirmId(null);
    } finally {
      setDeleting(false);
    }
  }

  if (error)
    return (
      <Alert size="sm" className="mt-2">
        {error instanceof Error ? error.message : 'Failed to load history'}
      </Alert>
    );
  if (!entries) return <Skeleton className="mt-2 h-12 w-full" />;

  return (
    <>
      {deleteError && (
        <Alert size="sm" className="mt-2" onDismiss={() => setDeleteError(null)}>
          {deleteError}
        </Alert>
      )}
      <ul className="mt-2 space-y-1 rounded-md bg-muted/40 p-2.5">
        {entries.map((entry, i) => (
          <li
            key={entry.id ?? `default-${i}`}
            className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs"
          >
            <span className="font-mono tabular-nums">{formatValue(meta, entry.value)}</span>
            <span className="text-muted-foreground">effective {entry.effective_date}</span>
            <SourceBadge source={entry.source} />
            {entry.note && <span className="text-muted-foreground italic">{entry.note}</span>}
            {entry.id && (
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto text-destructive hover:text-destructive"
                onClick={() => setConfirmId(entry.id!)}
              >
                Remove
              </Button>
            )}
          </li>
        ))}
      </ul>
      <ConfirmDialog
        open={!!confirmId}
        onOpenChange={(open) => !open && setConfirmId(null)}
        title={`Remove this ${meta.label} record?`}
        description="The assumption will fall back to the next most recent record. This cannot be undone."
        confirmLabel="Remove record"
        onConfirm={handleDelete}
        busy={deleting}
      />
    </>
  );
}

// ── Value formatting ──

function getTableYear(value: unknown): number | null {
  if (typeof value === 'object' && value !== null && 'year' in value) {
    const year = (value as { year: unknown }).year;
    return typeof year === 'number' ? year : null;
  }
  return null;
}

function formatValue(meta: AssumptionKeyMeta, value: unknown): string {
  if (value === null || value === undefined) {
    return meta.key === 'retirement_annual_spend_override' ? 'From budget' : '—';
  }

  switch (meta.kind) {
    case 'rate':
      return typeof value === 'number' ? fmtPct(value) : String(value);
    case 'currency':
      return typeof value === 'number' ? fmt(value) : String(value);
    case 'enum':
      return ENUM_LABELS[String(value)] ?? String(value);
    case 'table':
      return summarizeTable(meta.key, value);
  }
}

function summarizeTable(key: string, value: unknown): string {
  const year = getTableYear(value);

  if (key === 'allocation.targets' && Array.isArray(value)) {
    return value.length === 0 ? 'No targets set' : `${value.length} target band(s)`;
  }
  if (key === 'allocation.symbol_overrides' && typeof value === 'object' && value !== null) {
    const n = Object.keys(value).length;
    return n === 0 ? 'No overrides' : `${n} symbol override(s)`;
  }
  if (key === 'tax.roth_conversion' && typeof value === 'object' && value !== null) {
    const amount = (value as { annual_conversion_amount?: unknown }).annual_conversion_amount;
    return typeof amount === 'number' && amount > 0 ? `${fmt(amount)}/yr planned` : 'None planned';
  }

  return year != null ? `${year} tables` : 'Custom table';
}
