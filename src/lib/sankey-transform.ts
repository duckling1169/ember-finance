import type {
  HouseholdWaterfall,
  CashflowItem,
  IncomeSource,
  EnrichedAccount,
} from '@shared/types';

export interface SankeyNode {
  id: string;
  label: string;
  category: 'income' | 'savings' | 'cost' | 'hub';
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

/** Semantic color palette for node categories */
export const SANKEY_CATEGORY_COLORS: Record<SankeyNode['category'], string> = {
  income: '#4589ff', // blue
  savings: '#08bdba', // teal / green
  cost: '#fa4d56', // red
  hub: '#a0a0a0', // neutral gray — pass-through node
};

/**
 * Transform a HouseholdWaterfall + raw data into a multi-layer nivo Sankey.
 *
 * Column 0: Income Sources, Employer Matches
 * Column 1: Pre-tax deductions (savings), Taxes (cost), Net Income (hub)
 * Column 2: Post-tax contributions (savings), Expenses (cost), Surplus/Deficit
 *
 * Nodes are ordered so savings items cluster together and costs cluster together.
 * Employer matches flow separately as additional income.
 */
export function buildSankeyData(
  waterfall: HouseholdWaterfall,
  cashflowItems: CashflowItem[],
  incomeSources: IncomeSource[],
  accounts?: EnrichedAccount[],
  /** When set, only show these income sources and scale shared totals proportionally */
  filterSourceIds?: Set<string>,
): SankeyData {
  // Collect nodes by category so we can order them for visual grouping
  const incomeNodes: SankeyNode[] = [];
  const savingsNodes: SankeyNode[] = [];
  const costNodes: SankeyNode[] = [];
  const hubNodes: SankeyNode[] = [];
  const links: SankeyLink[] = [];
  const totalGross = waterfall.total_gross_annual;

  if (totalGross <= 0) return { nodes: [], links };

  const sourceById = new Map(incomeSources.map((s) => [s.id, s]));
  const accountById = new Map((accounts ?? []).map((a) => [a.id, a]));
  const allWaterfallSources = waterfall.members.flatMap((m) => m.income_sources);

  // Apply income source filter: only include matching sources, compute their share of gross
  const visibleSources = filterSourceIds
    ? allWaterfallSources.filter((s) => filterSourceIds.has(s.income_source_id))
    : allWaterfallSources;
  const filteredGross = visibleSources.reduce((sum, s) => sum + s.gross_monthly * 12, 0);
  const grossShare = totalGross > 0 ? filteredGross / totalGross : 0;

  const isPreTaxSaving = (ci: CashflowItem) =>
    ci.bucket === 'saving' &&
    ci.destination_account_id != null &&
    accountById.get(ci.destination_account_id)?.tax_bucket === 'pre_tax';

  // Filter cashflow items when viewing a single source
  const visibleItems = filterSourceIds
    ? cashflowItems.filter(
        (ci) =>
          // Items linked to the selected source
          (ci.income_source_id && filterSourceIds.has(ci.income_source_id)) ||
          // Unlinked items get included proportionally (links are scaled below)
          !ci.income_source_id,
      )
    : cashflowItems;

  // ── Column 0: Income source nodes ──
  for (const src of visibleSources) {
    incomeNodes.push({ id: `inc-${src.income_source_id}`, label: src.name, category: 'income' });
  }

  // ── Column 1: Pre-tax deductions, Taxes, Net Income hub ──

  // Pre-tax savings → deductions
  const deductionItems = visibleItems.filter((ci) => isPreTaxSaving(ci));
  for (const item of deductionItems) {
    const annual = normalizeToAnnual(item.amount, item.frequency);
    if (annual <= 0) continue;
    savingsNodes.push({ id: `ded-${item.id}`, label: item.name, category: 'savings' });

    if (item.income_source_id && sourceById.has(item.income_source_id)) {
      addLink(links, `inc-${item.income_source_id}`, `ded-${item.id}`, annual);
    } else {
      // Unlinked: spread across visible sources proportionally
      for (const src of visibleSources) {
        const share = filteredGross > 0 ? (src.gross_monthly * 12) / filteredGross : 0;
        addLink(
          links,
          `inc-${src.income_source_id}`,
          `ded-${item.id}`,
          annual * grossShare * share,
        );
      }
    }
  }

  // Taxes → cost (scaled proportionally when filtered)
  const taxAnnual = waterfall.total_tax_monthly * 12 * grossShare;
  if (taxAnnual > 0) {
    costNodes.push({ id: 'taxes', label: 'Taxes', category: 'cost' });
    for (const src of visibleSources) {
      const share = filteredGross > 0 ? (src.gross_monthly * 12) / filteredGross : 0;
      addLink(links, `inc-${src.income_source_id}`, 'taxes', taxAnnual * share);
    }
  }

  // Net Income hub (scaled proportionally when filtered)
  const netIncomeAnnual = waterfall.total_net_income_monthly * 12 * grossShare;

  // Employer matches → free money, shown as separate source flowing into Net Income
  const matchItems = visibleItems.filter((ci) => ci.bucket === 'employer_match');
  for (const item of matchItems) {
    const annual = normalizeToAnnual(item.amount, item.frequency);
    if (annual <= 0) continue;
    incomeNodes.push({ id: `match-${item.id}`, label: item.name, category: 'savings' });
    if (netIncomeAnnual > 0) {
      addLink(links, `match-${item.id}`, 'net-income', annual);
    }
  }
  if (netIncomeAnnual > 0) {
    hubNodes.push({ id: 'net-income', label: 'Net Income', category: 'hub' });
    for (const src of visibleSources) {
      const share = filteredGross > 0 ? (src.gross_monthly * 12) / filteredGross : 0;
      addLink(links, `inc-${src.income_source_id}`, 'net-income', netIncomeAnnual * share);
    }
  }

  // ── Column 2: Flows out of Net Income ──

  // Post-tax savings → contributions (saving items that are NOT pre-tax)
  const postTaxItems = visibleItems.filter((ci) => ci.bucket === 'saving' && !isPreTaxSaving(ci));
  for (const item of postTaxItems) {
    let annual = normalizeToAnnual(item.amount, item.frequency);
    // Scale unlinked items by gross share when filtered
    if (filterSourceIds && !item.income_source_id) annual *= grossShare;
    if (annual <= 0) continue;
    savingsNodes.push({ id: `contrib-${item.id}`, label: item.name, category: 'savings' });
    addLink(links, 'net-income', `contrib-${item.id}`, annual);
  }

  // Expenses → cost
  const expenseItems = visibleItems.filter((ci) => ci.bucket === 'expense');
  if (expenseItems.length > 0) {
    for (const item of expenseItems) {
      let annual = normalizeToAnnual(item.amount, item.frequency);
      // Scale unlinked expenses by gross share when filtered
      if (filterSourceIds && !item.income_source_id) annual *= grossShare;
      if (annual <= 0) continue;
      costNodes.push({ id: `exp-${item.id}`, label: item.name, category: 'cost' });
      addLink(links, 'net-income', `exp-${item.id}`, annual);
    }
  } else if (waterfall.total_expenses_annual > 0) {
    costNodes.push({ id: 'expenses', label: 'Expenses', category: 'cost' });
    addLink(links, 'net-income', 'expenses', waterfall.total_expenses_annual * grossShare);
  }

  // Residual (scaled proportionally when filtered)
  const residual = waterfall.total_residual_annual * grossShare;
  if (residual > 0) {
    savingsNodes.push({ id: 'surplus', label: 'Unallocated', category: 'hub' });
    addLink(links, 'net-income', 'surplus', residual);
  } else if (residual < 0) {
    costNodes.push({ id: 'deficit', label: 'Deficit', category: 'cost' });
    addLink(links, 'net-income', 'deficit', Math.abs(residual));
  }

  // Order: income first, then savings grouped together, hub, then costs grouped together.
  // This makes the Sankey visually cluster savings (teal) on top and costs (red) on bottom.
  const nodes = [...incomeNodes, ...savingsNodes, ...hubNodes, ...costNodes];

  return { nodes, links };
}

function addLink(links: SankeyLink[], source: string, target: string, value: number) {
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
