'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardAction, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Alert } from '@/components/ui/alert';
import { InfoTip } from '@/components/ui/info-tip';
import { IconChevronDown, IconChevronUp } from '@tabler/icons-react';
import { updateScenario } from '@/lib/api';
import { useFlash } from '@/lib/use-flash';
import { mutateScenarios, mutatePlanningComputed } from '@/lib/swr';

import type { ResolvedScenario, ScenarioAssumptions, ContributionGrowthMode } from '@shared/types';

const FIELD_TIPS: Record<string, string> = {
  gross_return: 'Expected average annual market return before adjusting for inflation (nominal).',
  inflation:
    'Expected average annual inflation rate used to convert nominal returns to real returns.',
  real_return:
    'Gross return minus inflation — the actual purchasing-power growth of your portfolio. Calculated automatically.',
  withdrawal_rate:
    'Percentage of your portfolio withdrawn annually in retirement. The classic "4% rule" is a common starting point.',
  retirement_spend:
    'Override the budget-derived annual spending estimate for retirement. Leave blank to use your actual expense total.',
  contribution_growth:
    'How your contributions change over time: None keeps them flat, Match Inflation adjusts for CPI, Fixed Rate grows by a set percentage.',
  growth_rate: 'Annual percentage increase applied to contributions each year.',
};

interface AssumptionsPanelProps {
  scenario: ResolvedScenario;
  defaultOpen?: boolean;
}

export function AssumptionsPanel({ scenario, defaultOpen = false }: AssumptionsPanelProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [saving, setSaving] = useState(false);
  const { flash, show: showFlash } = useFlash();

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
      showFlash('success', 'Assumptions saved');
    } catch (err) {
      showFlash('error', err instanceof Error ? err.message : 'Failed to save assumptions');
    } finally {
      setSaving(false);
    }
  }

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
              ({scenario.name})
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
        <CardContent id={panelId}>
          {flash && (
            <Alert
              variant={flash.type === 'error' ? 'error' : 'success'}
              size="sm"
              className="mb-3"
            >
              {flash.message}
            </Alert>
          )}
          <div className="flex items-end gap-3">
            <div className="flex min-w-0 flex-1 flex-wrap items-end gap-3">
              <Field
                label="Gross Return (%)"
                tip={FIELD_TIPS.gross_return}
                value={grossReturn}
                onChange={setGrossReturn}
              />
              <Field
                label="Inflation (%)"
                tip={FIELD_TIPS.inflation}
                value={inflation}
                onChange={setInflation}
              />
              <Field
                label="Real Return (%)"
                tip={FIELD_TIPS.real_return}
                value={realReturn}
                onChange={setRealReturn}
              />
              <Field
                label="Withdrawal (%)"
                tip={FIELD_TIPS.withdrawal_rate}
                value={withdrawalRate}
                onChange={setWithdrawalRate}
              />

              <div className="flex-1">
                <label
                  htmlFor="retirement-spend"
                  className="flex items-center gap-1 text-xs text-muted-foreground"
                >
                  Retire Spend
                  <InfoTip content={FIELD_TIPS.retirement_spend} size={13} />
                </label>
                <Input
                  id="retirement-spend"
                  type="number"
                  step="1000"
                  min="0"
                  value={retirementSpend}
                  onChange={(e) => setRetirementSpend(e.target.value)}
                  placeholder="From budget"
                  className="h-7 text-xs font-mono"
                />
              </div>

              <div className="flex-1">
                <label
                  htmlFor="contribution-growth"
                  className="flex items-center gap-1 text-xs text-muted-foreground"
                >
                  Contrib. Growth
                  <InfoTip content={FIELD_TIPS.contribution_growth} size={13} />
                </label>
                <Select
                  id="contribution-growth"
                  value={growthMode}
                  onChange={(e) => setGrowthMode(e.target.value as ContributionGrowthMode)}
                  className="h-7 px-2 text-xs"
                >
                  <option value="none">None</option>
                  <option value="inflation">Match Inflation</option>
                  <option value="fixed_rate">Fixed Rate</option>
                </Select>
              </div>

              {growthMode === 'fixed_rate' && (
                <Field
                  label="Growth Rate (%)"
                  tip={FIELD_TIPS.growth_rate}
                  value={growthRate}
                  onChange={setGrowthRate}
                />
              )}
            </div>

            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

let fieldCounter = 0;

function Field({
  label,
  tip,
  value,
  onChange,
}: {
  label: string;
  tip?: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const [id] = useState(() => `assumption-field-${++fieldCounter}`);

  return (
    <div className="flex-1">
      <label htmlFor={id} className="flex items-center gap-1 text-xs text-muted-foreground">
        {label}
        {tip && <InfoTip content={tip} size={13} />}
      </label>
      <Input
        id={id}
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
