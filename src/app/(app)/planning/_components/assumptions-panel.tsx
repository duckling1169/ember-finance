'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardAction, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { IconChevronDown, IconChevronUp } from '@tabler/icons-react';
import { updateScenario } from '@/lib/api';
import { mutateScenarios, mutatePlanningComputed } from '@/lib/swr';
import { cn } from '@/lib/utils';
import type { ResolvedScenario, ScenarioAssumptions, ContributionGrowthMode } from '@shared/types';

interface AssumptionsPanelProps {
  scenario: ResolvedScenario;
}

export function AssumptionsPanel({ scenario }: AssumptionsPanelProps) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const a = scenario.assumptions;
  const [grossReturn, setGrossReturn] = useState('');
  const [inflation, setInflation] = useState('');
  const [realReturn, setRealReturn] = useState('');
  const [withdrawalRate, setWithdrawalRate] = useState('');
  const [retirementSpend, setRetirementSpend] = useState('');
  const [growthMode, setGrowthMode] = useState<ContributionGrowthMode>('none');
  const [growthRate, setGrowthRate] = useState('');

  useEffect(() => {
    setGrossReturn(pctStr(a.gross_return_rate));
    setInflation(pctStr(a.inflation_rate));
    setRealReturn(pctStr(a.real_return_rate));
    setWithdrawalRate(pctStr(a.withdrawal_rate));
    setRetirementSpend(a.retirement_annual_spend_override?.toString() ?? '');
    setGrowthMode(a.contribution_growth_mode ?? 'none');
    setGrowthRate(a.contribution_growth_rate != null ? pctStr(a.contribution_growth_rate) : '');
  }, [a]);

  async function handleSave() {
    setSaving(true);
    try {
      const assumptions: ScenarioAssumptions = {
        gross_return_rate: pctVal(grossReturn),
        inflation_rate: pctVal(inflation),
        real_return_rate: pctVal(realReturn),
        withdrawal_rate: pctVal(withdrawalRate),
        retirement_annual_spend_override: retirementSpend ? parseFloat(retirementSpend) : null,
        contribution_growth_mode: growthMode,
        contribution_growth_rate: growthMode === 'fixed_rate' ? pctVal(growthRate) : null,
      };
      await updateScenario(scenario.id, { assumptions });
      await Promise.all([mutateScenarios(), mutatePlanningComputed()]);
    } catch {
      /* toast */
    } finally {
      setSaving(false);
    }
  }

  const selectCn = cn(
    'flex h-7 w-full rounded-md border border-input bg-card px-2 text-xs',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
  );

  return (
    <Card size="sm">
      <CardHeader className="cursor-pointer" onClick={() => setOpen(!open)}>
        <CardTitle>
          Assumptions
          <span className="ml-2 text-xs font-normal text-muted-foreground">({scenario.name})</span>
        </CardTitle>
        <CardAction>
          {open ? (
            <IconChevronUp size={16} stroke={1.5} />
          ) : (
            <IconChevronDown size={16} stroke={1.5} />
          )}
        </CardAction>
      </CardHeader>

      {open && (
        <CardContent>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            <Field label="Gross Return (%)" value={grossReturn} onChange={setGrossReturn} />
            <Field label="Inflation (%)" value={inflation} onChange={setInflation} />
            <Field label="Real Return (%)" value={realReturn} onChange={setRealReturn} />
            <Field
              label="Withdrawal Rate (%)"
              value={withdrawalRate}
              onChange={setWithdrawalRate}
            />

            <div>
              <label className="text-[10px] text-muted-foreground">Retirement Spend Override</label>
              <Input
                type="number"
                step="1000"
                min="0"
                value={retirementSpend}
                onChange={(e) => setRetirementSpend(e.target.value)}
                placeholder="From budget"
                className="h-7 text-xs font-mono"
              />
            </div>

            <div>
              <label className="text-[10px] text-muted-foreground">Contribution Growth</label>
              <select
                value={growthMode}
                onChange={(e) => setGrowthMode(e.target.value as ContributionGrowthMode)}
                className={selectCn}
              >
                <option value="none">None</option>
                <option value="inflation">Match Inflation</option>
                <option value="fixed_rate">Fixed Rate</option>
              </select>
            </div>

            {growthMode === 'fixed_rate' && (
              <Field label="Growth Rate (%)" value={growthRate} onChange={setGrowthRate} />
            )}
          </div>

          <div className="mt-3 flex justify-end">
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save assumptions'}
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="text-[10px] text-muted-foreground">{label}</label>
      <Input
        type="number"
        step="0.1"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-7 text-xs font-mono"
      />
    </div>
  );
}

function pctStr(n: number): string {
  return (n * 100).toFixed(1);
}

function pctVal(s: string): number {
  return parseFloat(s) / 100;
}
