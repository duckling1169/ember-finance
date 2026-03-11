import type { HouseholdWaterfall, CashflowItem, IncomeSource } from '@shared/types';

export interface SankeyNode {
  id: string;
  label: string;
}

export interface SankeyLink {
  source: string;
  target: string;
  value: number;
}

export interface SankeyData {
  nodes: SankeyNode[];
  links: SankeyLink[];
}

/**
 * Transform a HouseholdWaterfall + raw data into nivo Sankey data.
 *
 * Uses actual income_source_id relationships on cashflow items to build
 * accurate links. Only falls back to proportional distribution for taxes,
 * expenses, and residual (which aren't tied to a specific source).
 */
export function buildSankeyData(
  waterfall: HouseholdWaterfall,
  cashflowItems: CashflowItem[],
  incomeSources: IncomeSource[],
): SankeyData {
  const nodes: SankeyNode[] = [];
  const links: SankeyLink[] = [];
  const totalGross = waterfall.total_gross_annual;

  if (totalGross <= 0) return { nodes, links };

  // Index income sources by id for lookups
  const sourceById = new Map(incomeSources.map((s) => [s.id, s]));

  // All income source summaries from the waterfall (already computed)
  const allWaterfallSources = waterfall.members.flatMap((m) => m.income_sources);

  // ── Left column: income source nodes ──
  for (const src of allWaterfallSources) {
    nodes.push({ id: `inc-${src.income_source_id}`, label: src.name });
  }

  // ── Right column: destination nodes ──

  // Pre-tax deductions and retirement deferrals — linked by income_source_id
  const deductionItems = cashflowItems.filter(
    (ci) => ci.bucket === 'pre_tax_deduction' || ci.bucket === 'retirement_deferral',
  );
  for (const item of deductionItems) {
    const annual = normalizeToAnnual(item.amount, item.frequency);
    if (annual <= 0) continue;
    nodes.push({ id: `ded-${item.id}`, label: item.name });

    if (item.income_source_id && sourceById.has(item.income_source_id)) {
      // Direct link: this deduction comes from a specific income source
      addLink(links, `inc-${item.income_source_id}`, `ded-${item.id}`, annual);
    } else {
      // No source linked — distribute proportionally across all sources
      for (const src of allWaterfallSources) {
        const share = (src.gross_monthly * 12) / totalGross;
        addLink(links, `inc-${src.income_source_id}`, `ded-${item.id}`, annual * share);
      }
    }
  }

  // Employer match items — linked by income_source_id, flow to destination account
  const matchItems = cashflowItems.filter((ci) => ci.bucket === 'employer_match');
  for (const item of matchItems) {
    const annual = normalizeToAnnual(item.amount, item.frequency);
    if (annual <= 0) continue;
    nodes.push({ id: `match-${item.id}`, label: item.name });

    if (item.income_source_id && sourceById.has(item.income_source_id)) {
      addLink(links, `inc-${item.income_source_id}`, `match-${item.id}`, annual);
    } else {
      for (const src of allWaterfallSources) {
        const share = (src.gross_monthly * 12) / totalGross;
        addLink(links, `inc-${src.income_source_id}`, `match-${item.id}`, annual * share);
      }
    }
  }

  // Taxes — distributed proportionally (computed, not user-created)
  const taxAnnual = waterfall.total_tax_monthly * 12;
  if (taxAnnual > 0) {
    nodes.push({ id: 'taxes', label: 'Taxes' });
    for (const src of allWaterfallSources) {
      const share = (src.gross_monthly * 12) / totalGross;
      addLink(links, `inc-${src.income_source_id}`, 'taxes', taxAnnual * share);
    }
  }

  // Post-tax contributions — these come from net income, distributed proportionally
  const postTaxItems = cashflowItems.filter((ci) => ci.bucket === 'post_tax_contribution');
  for (const item of postTaxItems) {
    const annual = normalizeToAnnual(item.amount, item.frequency);
    if (annual <= 0) continue;
    nodes.push({ id: `contrib-${item.id}`, label: item.name });

    for (const src of allWaterfallSources) {
      const share = (src.gross_monthly * 12) / totalGross;
      addLink(links, `inc-${src.income_source_id}`, `contrib-${item.id}`, annual * share);
    }
  }

  // Expenses — individual items if available, otherwise aggregate
  const expenseItems = cashflowItems.filter((ci) => ci.bucket === 'expense');
  if (expenseItems.length > 0) {
    for (const item of expenseItems) {
      const annual = normalizeToAnnual(item.amount, item.frequency);
      if (annual <= 0) continue;
      nodes.push({ id: `exp-${item.id}`, label: item.name });

      for (const src of allWaterfallSources) {
        const share = (src.gross_monthly * 12) / totalGross;
        addLink(links, `inc-${src.income_source_id}`, `exp-${item.id}`, annual * share);
      }
    }
  } else if (waterfall.total_expenses_annual > 0) {
    nodes.push({ id: 'expenses', label: 'Expenses' });
    for (const src of allWaterfallSources) {
      const share = (src.gross_monthly * 12) / totalGross;
      addLink(
        links,
        `inc-${src.income_source_id}`,
        'expenses',
        waterfall.total_expenses_annual * share,
      );
    }
  }

  // Residual — surplus or deficit
  const residual = waterfall.total_residual_annual;
  if (residual > 0) {
    nodes.push({ id: 'surplus', label: 'Surplus' });
    for (const src of allWaterfallSources) {
      const share = (src.gross_monthly * 12) / totalGross;
      addLink(links, `inc-${src.income_source_id}`, 'surplus', residual * share);
    }
  } else if (residual < 0) {
    nodes.push({ id: 'deficit', label: 'Deficit' });
    for (const src of allWaterfallSources) {
      const share = (src.gross_monthly * 12) / totalGross;
      addLink(links, `inc-${src.income_source_id}`, 'deficit', Math.abs(residual) * share);
    }
  }

  return { nodes, links };
}

function addLink(links: SankeyLink[], source: string, target: string, value: number) {
  // Merge duplicate links (same source → target)
  const existing = links.find((l) => l.source === source && l.target === target);
  if (existing) {
    existing.value += Math.round(value);
  } else if (value > 0) {
    links.push({ source, target, value: Math.round(value) });
  }
}

function normalizeToAnnual(amount: number, frequency: string): number {
  switch (frequency) {
    case 'monthly':
      return amount * 12;
    case 'biweekly':
      return amount * 26;
    case 'annual':
      return amount;
    case 'one_time':
      return amount;
    default:
      return amount * 12;
  }
}
