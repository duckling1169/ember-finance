'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Card, CardHeader, CardTitle, CardAction, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { InfoTip } from '@/components/ui/info-tip';
import { IconChevronDown, IconChevronUp, IconHistory, IconPencil } from '@tabler/icons-react';
import { createAssumptionRecord, deleteAssumptionRecord, getAssumptionHistory } from '@/lib/api';
import { useToast } from '@/components/ui/toast';
import { useAssumptions, useScenarios, mutateAssumptions, mutatePlanningComputed } from '@/lib/swr';
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

interface AssumptionsPanelProps {
  scenarioId?: string;
  defaultOpen?: boolean;
}

/**
 * The audit surface: every assumption behind any number on screen,
 * each with its own value, effective date, source layer, and edit
 * history. Edits append dated records — they never overwrite.
 */
export function AssumptionsPanel({ scenarioId, defaultOpen = false }: AssumptionsPanelProps) {
  const [open, setOpen] = useState(defaultOpen);
  const { data, isLoading } = useAssumptions(scenarioId);
  const { data: scenarios } = useScenarios();

  const scenario = scenarioId ? scenarios?.find((s) => s.id === scenarioId) : undefined;
  const isScenarioScoped = !!scenario && !scenario.is_base;

  const byKey = new Map<string, ResolvedAssumption>(
    (data?.assumptions ?? []).map((a) => [a.key, a]),
  );

  const taxYear = getTableYear(byKey.get('tax.federal_brackets')?.value);

  const panelId = 'assumptions-content';

  return (
    <Card size="sm">
      <button
        type="button"
        className="w-full cursor-pointer text-left"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls={panelId}
      >
        <CardHeader>
          <CardTitle>
            Assumptions
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              {isScenarioScoped ? `${scenario.name} (scenario overrides)` : 'household baseline'}
              {taxYear != null && ` · tax tables effective ${taxYear}`}
            </span>
          </CardTitle>
          <CardAction>
            {open ? (
              <IconChevronUp size={16} stroke={1.5} aria-hidden="true" />
            ) : (
              <IconChevronDown size={16} stroke={1.5} aria-hidden="true" />
            )}
          </CardAction>
        </CardHeader>
      </button>

      {open && (
        <CardContent id={panelId} className="space-y-5">
          <p className="text-xs text-muted-foreground">
            Every projection and tax figure derives from these dated records. Edits append a new
            record with its own effective date — history is never overwritten. Ember ships dated
            defaults but does not track live law; you own the upkeep.
          </p>

          {isLoading && <Skeleton className="h-40 w-full" />}

          {data &&
            GROUP_ORDER.map((group) => (
              <AssumptionGroupSection
                key={group}
                group={group}
                scenarioId={scenarioId}
                byKey={byKey}
                asOf={data.as_of}
              />
            ))}
        </CardContent>
      )}
    </Card>
  );
}

function AssumptionGroupSection({
  group,
  scenarioId,
  byKey,
  asOf,
}: {
  group: AssumptionGroup;
  scenarioId?: string;
  byKey: Map<string, ResolvedAssumption>;
  asOf: string;
}) {
  const metas = ASSUMPTION_KEYS.filter((k) => k.group === group);

  return (
    <div>
      <h3 className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {ASSUMPTION_GROUP_LABELS[group]}
      </h3>
      <div className="divide-y divide-border rounded-lg border">
        {metas.map((meta) => (
          <AssumptionRow
            key={meta.key}
            meta={meta}
            resolved={byKey.get(meta.key)}
            scenarioId={scenarioId}
            asOf={asOf}
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
}: {
  meta: AssumptionKeyMeta;
  resolved: ResolvedAssumption | undefined;
  scenarioId?: string;
  asOf: string;
}) {
  const [mode, setMode] = useState<'view' | 'edit' | 'history'>('view');

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
              onClick={() => setMode(mode === 'edit' ? 'view' : 'edit')}
            >
              <IconPencil size={14} stroke={1.5} />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`History of ${meta.label}`}
              onClick={() => setMode(mode === 'history' ? 'view' : 'history')}
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
          onDone={() => setMode('view')}
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
        source === 'scenario' && 'bg-chart-2/15 text-chart-2',
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

  async function handleSave() {
    let value: unknown;
    switch (meta.kind) {
      case 'rate': {
        if (rateStr === '' && meta.nullable) {
          value = null;
          break;
        }
        const parsed = parseFloat(rateStr);
        if (Number.isNaN(parsed)) {
          toast('error', 'Enter a percentage, e.g. 6.5');
          return;
        }
        value = parsed / 100;
        break;
      }
      case 'currency': {
        if (currencyStr === '' && meta.nullable) {
          value = null;
          break;
        }
        const parsed = parseFloat(currencyStr);
        if (Number.isNaN(parsed)) {
          toast('error', 'Enter a dollar amount');
          return;
        }
        value = parsed;
        break;
      }
      case 'enum':
        value = enumVal;
        break;
      case 'table':
        try {
          value = JSON.parse(jsonStr);
        } catch {
          toast('error', 'Invalid JSON');
          return;
        }
        break;
    }

    setSaving(true);
    try {
      await createAssumptionRecord({
        key: meta.key,
        value,
        effective_date: effectiveDate,
        note: note.trim() || null,
        scenario_id: scenarioId ?? null,
      });
      await Promise.all([mutateAssumptions(), mutatePlanningComputed()]);
      toast('success', `${meta.label} updated`);
      onDone();
    } catch (err) {
      toast('error', err instanceof Error ? err.message : 'Failed to save');
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
          <LabeledField id={valueId} label="Value (%)">
            <Input
              id={valueId}
              type="number"
              step="0.1"
              value={rateStr}
              onChange={(e) => setRateStr(e.target.value)}
              placeholder={meta.nullable ? 'Blank = none' : undefined}
              className="h-8 w-28 font-mono text-xs"
            />
          </LabeledField>
        )}
        {meta.kind === 'currency' && (
          <LabeledField id={valueId} label="Value ($/yr)">
            <Input
              id={valueId}
              type="number"
              step="1000"
              min="0"
              value={currencyStr}
              onChange={(e) => setCurrencyStr(e.target.value)}
              placeholder={meta.nullable ? 'Blank = use budget' : undefined}
              className="h-8 w-32 font-mono text-xs"
            />
          </LabeledField>
        )}
        {meta.kind === 'enum' && (
          <LabeledField id={valueId} label="Value">
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
          </LabeledField>
        )}

        <LabeledField id={dateId} label="Effective date">
          <Input
            id={dateId}
            type="date"
            value={effectiveDate}
            onChange={(e) => setEffectiveDate(e.target.value)}
            className="h-8 w-36 text-xs"
          />
        </LabeledField>

        <LabeledField id={`assumption-note-${meta.key}`} label="Note (optional)">
          <Input
            id={`assumption-note-${meta.key}`}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Why this change?"
            className="h-8 w-44 text-xs"
          />
        </LabeledField>

        <div className="ml-auto flex gap-1.5">
          <Button size="sm" variant="ghost" onClick={onDone}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>

      {meta.kind === 'table' && (
        <div>
          <label htmlFor={`assumption-json-${meta.key}`} className="text-xs text-muted-foreground">
            Value (JSON) — validated on save
          </label>
          <textarea
            id={`assumption-json-${meta.key}`}
            value={jsonStr}
            onChange={(e) => setJsonStr(e.target.value)}
            rows={Math.min(14, jsonStr.split('\n').length)}
            spellCheck={false}
            className="mt-1 w-full rounded-md border bg-background p-2 font-mono text-xs"
          />
        </div>
      )}
    </div>
  );
}

function LabeledField({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </label>
      <div className="mt-1">{children}</div>
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

  async function handleDelete(id: string) {
    try {
      await deleteAssumptionRecord(id);
      await Promise.all([mutateHistory(), mutateAssumptions(), mutatePlanningComputed()]);
      toast('success', 'Record removed');
    } catch (err) {
      toast('error', err instanceof Error ? err.message : 'Failed to delete');
    }
  }

  if (error)
    return (
      <p className="mt-2 text-xs text-loss">
        {error instanceof Error ? error.message : 'Failed to load history'}
      </p>
    );
  if (!entries) return <Skeleton className="mt-2 h-12 w-full" />;

  return (
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
              size="xs"
              className="ml-auto text-loss"
              onClick={() => handleDelete(entry.id!)}
            >
              Remove
            </Button>
          )}
        </li>
      ))}
    </ul>
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
