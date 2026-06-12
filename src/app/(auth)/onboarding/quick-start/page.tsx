'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  getProfile,
  updateProfile,
  createIncomeSource,
  createCashflowItem,
  createAccount,
  ingestManual,
  getMetrics,
} from '@/lib/api';
import { RequireAuth } from '@/lib/require-auth';
import { useHousehold } from '@/lib/swr';
import { Card, CardHeader, CardDescription, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { IconFlame } from '@tabler/icons-react';
import { fmt, fmtPct, fmtYears } from '@/lib/formatters';
import type { MetricsResponse } from '@shared/types';

export default function QuickStartPage() {
  return (
    <RequireAuth>
      <QuickStartContent />
    </RequireAuth>
  );
}

const ON_TRACK_LABELS: Record<string, string> = {
  ahead: 'Ahead of plan',
  on_track: 'On track',
  behind: 'Behind plan',
  unreachable: 'Not reachable at current pace',
};

function QuickStartContent() {
  const router = useRouter();
  const { data: household } = useHousehold();

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<MetricsResponse | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!household) return;
    setError('');
    setLoading(true);

    const form = new FormData(e.currentTarget);
    const annualIncome = parseFloat(form.get('annualIncome') as string);
    const monthlySpend = parseFloat(form.get('monthlySpend') as string);
    const invested = parseFloat((form.get('invested') as string) || '0');
    const targetAgeRaw = form.get('targetAge') as string;
    const today = new Date().toISOString().slice(0, 10);

    try {
      const profile = await getProfile();

      // Seed real records — the headline number comes from the same
      // engine and data the full app uses, not a throwaway calculator.
      await createIncomeSource({
        member_id: profile.id,
        name: 'Primary income',
        type: 'employment',
        gross_amount: annualIncome,
        frequency: 'annual',
      });

      await createCashflowItem({
        member_id: profile.id,
        name: 'Living expenses',
        direction: 'outflow',
        bucket: 'expense',
        amount: monthlySpend,
        frequency: 'monthly',
        start_date: today,
      });

      if (invested > 0) {
        const account = await createAccount(household.id, {
          name: 'Investment portfolio',
          account_type: 'brokerage',
        });
        await ingestManual(household.id, account.id, {
          balances: [{ date: today, balance: invested }],
        });
      }

      if (targetAgeRaw) {
        await updateProfile({ targetRetirementAge: parseInt(targetAgeRaw, 10) });
      }

      setResult(await getMetrics());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  if (result) {
    const { metrics, savings_rates } = result;
    return (
      <Shell description="Your first look at financial independence">
        <div className="space-y-4">
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 text-center">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Your FI number
            </div>
            <div className="font-mono text-3xl font-semibold tabular-nums">
              {fmt(metrics.fire_number)}
            </div>
            <div className="mt-1 text-sm text-muted-foreground">
              {fmtPct(metrics.progress_pct)} of the way there
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-3 text-sm">
            <ResultStat label="Years to FI" value={fmtYears(metrics.years_to_fire)} />
            <ResultStat
              label="Projected retirement age"
              value={
                metrics.projected_retirement_age != null
                  ? metrics.projected_retirement_age.toFixed(0)
                  : '--'
              }
            />
            <ResultStat label="Savings rate" value={fmtPct(savings_rates.total_savings_rate)} />
            <ResultStat label="Status" value={ON_TRACK_LABELS[metrics.on_track] ?? '--'} />
          </dl>

          <p className="text-xs text-muted-foreground">
            Computed from what you just entered, using a{' '}
            {fmtPct(result.scenario.assumptions.withdrawal_rate)} withdrawal rate and{' '}
            {fmtPct(result.scenario.assumptions.real_return_rate)} real returns. Every assumption
            behind this number is visible and editable — nothing is hidden math.
          </p>

          <div className="flex flex-col gap-2">
            <Button className="w-full" onClick={() => router.push('/planning')}>
              Refine your plan
            </Button>
            <Button variant="outline" className="w-full" onClick={() => router.push('/')}>
              Go to dashboard
            </Button>
          </div>
        </div>
      </Shell>
    );
  }

  return (
    <Shell description="Three numbers gets you a financial independence estimate. You can refine everything later.">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="qs-income" className="mb-1.5 block text-sm font-medium">
            Annual gross income
          </label>
          <Input
            id="qs-income"
            name="annualIncome"
            type="number"
            min="1"
            step="1000"
            required
            placeholder="120,000"
            className="font-mono"
          />
        </div>
        <div>
          <label htmlFor="qs-spend" className="mb-1.5 block text-sm font-medium">
            Monthly spending
          </label>
          <Input
            id="qs-spend"
            name="monthlySpend"
            type="number"
            min="1"
            step="100"
            required
            placeholder="4,000"
            className="font-mono"
          />
        </div>
        <div>
          <label htmlFor="qs-invested" className="mb-1.5 block text-sm font-medium">
            Invested so far
          </label>
          <Input
            id="qs-invested"
            name="invested"
            type="number"
            min="0"
            step="1000"
            placeholder="50,000 (0 is fine)"
            className="font-mono"
          />
        </div>
        <div>
          <label htmlFor="qs-age" className="mb-1.5 block text-sm font-medium">
            Target retirement age{' '}
            <span className="font-normal text-muted-foreground">(optional)</span>
          </label>
          <Input id="qs-age" name="targetAge" type="number" min="18" max="100" placeholder="65" />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button type="submit" variant="primary-outline" disabled={loading} className="w-full">
          {loading ? 'Computing…' : 'Show my FI number'}
        </Button>
        <Button type="button" variant="ghost" className="w-full" onClick={() => router.push('/')}>
          Skip for now
        </Button>
      </form>
    </Shell>
  );
}

function Shell({ description, children }: { description: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center p-4 sm:p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <div className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground">
            Ember
            <IconFlame size={24} className="text-primary" />
          </div>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    </div>
  );
}

function ResultStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-mono text-base font-medium tabular-nums">{value}</dd>
    </div>
  );
}
