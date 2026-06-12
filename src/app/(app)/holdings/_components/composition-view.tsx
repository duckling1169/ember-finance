'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert } from '@/components/ui/alert';
import { InfoTip } from '@/components/ui/info-tip';
import { IconAlertTriangle } from '@tabler/icons-react';
import { useToast } from '@/components/ui/toast';
import {
  usePortfolioComposition,
  useAssumptions,
  mutatePortfolioComposition,
  mutateAssumptions,
} from '@/lib/swr';
import { createAssumptionRecord } from '@/lib/api';
import { fmt, fmtPct } from '@/lib/formatters';
import { TAX_TREATMENT_LABELS } from '@/lib/constants';
import { cn } from '@/lib/utils';
import {
  ALLOCATION_BUCKETS,
  type AllocationBucket,
  type AllocationTarget,
  type ClassificationSource,
  type PortfolioCompositionResponse,
} from '@shared/types';

const BUCKET_LABELS: Record<AllocationBucket, string> = {
  stock: 'US Stocks',
  bond: 'Bonds',
  intl: 'International',
  cash: 'Cash',
  alt: 'Alternatives',
};

const BUCKET_COLORS: Record<AllocationBucket, string> = {
  stock: 'var(--chart-1)',
  bond: 'var(--chart-2)',
  intl: 'var(--chart-3)',
  cash: 'var(--chart-4)',
  alt: 'var(--chart-5)',
};

const SOURCE_LABELS: Record<ClassificationSource, string> = {
  override: 'Your override',
  intl_heuristic: 'Auto (international fund)',
  asset_class: 'Auto (asset class)',
  fallback: 'Auto (unclassified — defaulted to stocks)',
};

/** Format a signed drift in percentage points, e.g. "+6.2pp". */
function fmtDrift(drift: number): string {
  const pp = drift * 100;
  return `${pp >= 0 ? '+' : ''}${pp.toFixed(1)}pp`;
}

export function AllocationView() {
  const { data, error, isLoading } = usePortfolioComposition();

  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (error)
    return <Alert variant="error">Failed to load composition. {(error as Error).message}</Alert>;
  if (!data) return null;

  if (data.total_value <= 0) {
    return <Alert>No portfolio value yet — add holdings or balances to see your allocation.</Alert>;
  }

  const alerts = data.buckets.filter((b) => b.drift_alert);

  return (
    <div className="space-y-3">
      {/* Allocation bar + drift */}
      <Card size="sm">
        <CardHeader>
          <CardTitle>
            True Allocation
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              across all accounts · as of {data.as_of}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex h-4 gap-0.5 overflow-hidden rounded-full">
            {data.buckets
              .filter((b) => b.value > 0)
              .map((b) => (
                <div
                  key={b.bucket}
                  style={{
                    width: `${b.pct * 100}%`,
                    backgroundColor: BUCKET_COLORS[b.bucket],
                  }}
                  title={`${BUCKET_LABELS[b.bucket]} ${fmtPct(b.pct)}`}
                />
              ))}
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {data.buckets.map((b) => (
              <div key={b.bucket} className="rounded-lg border px-2.5 py-2">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span
                    className="h-2 w-2 shrink-0 rounded-sm"
                    style={{ backgroundColor: BUCKET_COLORS[b.bucket] }}
                  />
                  {BUCKET_LABELS[b.bucket]}
                </div>
                <div className="font-mono text-sm tabular-nums">
                  {fmtPct(b.pct)}{' '}
                  <span className="text-xs text-muted-foreground">{fmt(b.value)}</span>
                </div>
                {b.target_pct != null && (
                  <div
                    className={cn('text-xs', b.drift_alert ? 'text-loss' : 'text-muted-foreground')}
                  >
                    target {fmtPct(b.target_pct)} ± {fmtPct(b.band_pct ?? 0)}
                    {b.drift != null && ` (${fmtDrift(b.drift)})`}
                  </div>
                )}
              </div>
            ))}
          </div>

          {alerts.length > 0 && (
            <div className="space-y-1">
              {alerts.map((b) => (
                <p key={b.bucket} className="flex items-center gap-1.5 text-xs text-loss">
                  <IconAlertTriangle size={14} stroke={1.5} />
                  {BUCKET_LABELS[b.bucket]} is {fmtDrift(b.drift ?? 0)} from its{' '}
                  {fmtPct(b.target_pct ?? 0)} target (band ± {fmtPct(b.band_pct ?? 0)})
                </p>
              ))}
            </div>
          )}

          <TargetsEditor composition={data} />
        </CardContent>
      </Card>

      {/* Positions with classification provenance */}
      <PositionsByBucket composition={data} />
    </div>
  );
}

function TargetsEditor({ composition }: { composition: PortfolioCompositionResponse }) {
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fields, setFields] = useState<Record<AllocationBucket, { target: string; band: string }>>(
    () =>
      Object.fromEntries(
        ALLOCATION_BUCKETS.map((bucket) => {
          const b = composition.buckets.find((x) => x.bucket === bucket);
          return [
            bucket,
            {
              target: b?.target_pct != null ? (b.target_pct * 100).toString() : '',
              band: b?.band_pct != null ? (b.band_pct * 100).toString() : '',
            },
          ];
        }),
      ) as Record<AllocationBucket, { target: string; band: string }>,
  );

  async function handleSave() {
    const targets: AllocationTarget[] = [];
    for (const bucket of ALLOCATION_BUCKETS) {
      const f = fields[bucket];
      if (f.target === '') continue;
      const target = parseFloat(f.target);
      const band = f.band === '' ? 5 : parseFloat(f.band);
      if (Number.isNaN(target) || Number.isNaN(band)) {
        toast('error', `Invalid target for ${BUCKET_LABELS[bucket]}`);
        return;
      }
      targets.push({ bucket, target_pct: target / 100, band_pct: band / 100 });
    }

    setSaving(true);
    try {
      await createAssumptionRecord({ key: 'allocation.targets', value: targets });
      await Promise.all([mutatePortfolioComposition(), mutateAssumptions()]);
      toast('success', 'Target allocation saved');
      setEditing(false);
    } catch (err) {
      toast('error', err instanceof Error ? err.message : 'Failed to save targets');
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Targets are a dated assumption record ({composition.targets_source}
          {composition.targets_effective_date != null &&
            `, effective ${composition.targets_effective_date}`}
          ) — edits keep history.
        </p>
        <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
          Edit targets
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-md bg-muted/40 p-2.5">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-5">
        {ALLOCATION_BUCKETS.map((bucket) => (
          <div key={bucket}>
            <span className="text-xs text-muted-foreground">{BUCKET_LABELS[bucket]}</span>
            <div className="mt-1 flex items-center gap-1">
              <Input
                aria-label={`${BUCKET_LABELS[bucket]} target %`}
                type="number"
                min="0"
                max="100"
                step="1"
                placeholder="—"
                value={fields[bucket].target}
                onChange={(e) =>
                  setFields((p) => ({ ...p, [bucket]: { ...p[bucket], target: e.target.value } }))
                }
                className="h-8 w-16 font-mono text-xs"
              />
              <span className="text-xs text-muted-foreground">±</span>
              <Input
                aria-label={`${BUCKET_LABELS[bucket]} band %`}
                type="number"
                min="0"
                max="100"
                step="1"
                placeholder="5"
                value={fields[bucket].band}
                onChange={(e) =>
                  setFields((p) => ({ ...p, [bucket]: { ...p[bucket], band: e.target.value } }))
                }
                className="h-8 w-14 font-mono text-xs"
              />
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Percent of total portfolio, with an alert band in percentage points. Leave a target blank to
        skip that bucket.
      </p>
      <div className="flex justify-end gap-1.5">
        <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
          Cancel
        </Button>
        <Button size="sm" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save targets'}
        </Button>
      </div>
    </div>
  );
}

function PositionsByBucket({ composition }: { composition: PortfolioCompositionResponse }) {
  const toast = useToast();
  const { data: assumptionsData } = useAssumptions();
  const [savingSymbol, setSavingSymbol] = useState<string | null>(null);

  // Until the current overrides map is loaded, editing is disabled —
  // posting a rebuilt map from partial data would clobber other overrides
  const overrides = assumptionsData
    ? ((assumptionsData.assumptions.find((a) => a.key === 'allocation.symbol_overrides')?.value as
        | Record<string, AllocationBucket>
        | undefined) ?? {})
    : null;

  // Aggregate positions by symbol (they arrive per account)
  const bySymbol = new Map<
    string,
    { symbol: string; name: string | null; value: number; pct: number } & Pick<
      (typeof composition.positions)[number],
      'bucket' | 'classification_source'
    >
  >();
  for (const p of composition.positions) {
    const existing = bySymbol.get(p.symbol);
    if (existing) {
      existing.value += p.value;
      existing.pct += p.pct;
    } else {
      bySymbol.set(p.symbol, { ...p });
    }
  }
  const rows = Array.from(bySymbol.values()).sort((a, b) => b.value - a.value);

  async function handleClassify(symbol: string, choice: string) {
    if (!overrides) return;
    const next: Record<string, AllocationBucket> = { ...overrides };
    if (choice === 'auto') {
      delete next[symbol];
    } else {
      next[symbol] = choice as AllocationBucket;
    }

    setSavingSymbol(symbol);
    try {
      await createAssumptionRecord({
        key: 'allocation.symbol_overrides',
        value: next,
        note: choice === 'auto' ? `${symbol}: back to auto` : `${symbol} → ${choice}`,
      });
      await Promise.all([mutatePortfolioComposition(), mutateAssumptions()]);
      toast('success', `${symbol} classification updated`);
    } catch (err) {
      toast('error', err instanceof Error ? err.message : 'Failed to update classification');
    } finally {
      setSavingSymbol(null);
    }
  }

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>
          Classification
          <InfoTip
            content="Every position shows why it landed in its bucket. Override any symbol — overrides are dated assumption records with history."
            size={13}
          />
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="-mx-4 overflow-x-auto sm:mx-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="px-3 py-2 font-medium">Symbol</th>
                <th className="hidden px-3 py-2 font-medium sm:table-cell">Why</th>
                <th className="px-3 py-2 text-right font-medium">Value</th>
                <th className="px-3 py-2 text-right font-medium">%</th>
                <th className="px-3 py-2 font-medium">Bucket</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.symbol} className="border-b border-border/50">
                  <td className="whitespace-nowrap px-3 py-2">
                    <span className="font-medium">{p.symbol}</span>
                    {p.name && (
                      <span className="ml-1.5 hidden text-xs text-muted-foreground lg:inline">
                        {p.name}
                      </span>
                    )}
                  </td>
                  <td className="hidden whitespace-nowrap px-3 py-2 text-xs text-muted-foreground sm:table-cell">
                    {SOURCE_LABELS[p.classification_source]}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right font-mono tabular-nums">
                    {fmt(p.value)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right font-mono tabular-nums">
                    {fmtPct(p.pct)}
                  </td>
                  <td className="px-3 py-2">
                    <Select
                      aria-label={`Bucket for ${p.symbol}`}
                      value={p.classification_source === 'override' ? p.bucket : 'auto'}
                      disabled={savingSymbol === p.symbol || !overrides}
                      onChange={(e) => handleClassify(p.symbol, e.target.value)}
                      className="h-7 w-32 px-2 text-xs"
                    >
                      <option value="auto">
                        Auto{p.classification_source !== 'override' && ` (${p.bucket})`}
                      </option>
                      {ALLOCATION_BUCKETS.map((b) => (
                        <option key={b} value={b}>
                          {BUCKET_LABELS[b]}
                        </option>
                      ))}
                    </Select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

export function AssetLocationView() {
  const { data, error, isLoading } = usePortfolioComposition();

  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (error)
    return <Alert variant="error">Failed to load composition. {(error as Error).message}</Alert>;
  if (!data) return null;

  if (data.total_value <= 0) {
    return <Alert>No portfolio value yet — add holdings or balances to see asset location.</Alert>;
  }

  const rows = data.asset_location.filter((r) => r.total_value > 0);

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>
          Asset Location
          <InfoTip
            content="Where each asset class sits across tax treatments. Tax-inefficient assets (bonds, REITs) generally belong in pre-tax accounts; high-growth assets benefit most from tax-free (Roth) space."
            size={13}
          />
          <span className="ml-2 text-xs font-normal text-muted-foreground">as of {data.as_of}</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="-mx-4 overflow-x-auto sm:mx-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="px-3 py-2 font-medium">Tax Treatment</th>
                {ALLOCATION_BUCKETS.map((b) => (
                  <th key={b} className="px-3 py-2 text-right font-medium">
                    {BUCKET_LABELS[b]}
                  </th>
                ))}
                <th className="px-3 py-2 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.tax_treatment} className="border-b border-border/50">
                  <td className="whitespace-nowrap px-3 py-2 font-medium">
                    {TAX_TREATMENT_LABELS[row.tax_treatment] ?? row.tax_treatment}
                  </td>
                  {ALLOCATION_BUCKETS.map((b) => (
                    <td
                      key={b}
                      className="whitespace-nowrap px-3 py-2 text-right font-mono tabular-nums"
                    >
                      {row.by_bucket[b] > 0 ? (
                        fmt(row.by_bucket[b])
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  ))}
                  <td className="whitespace-nowrap px-3 py-2 text-right font-mono font-medium tabular-nums">
                    {fmt(row.total_value)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
