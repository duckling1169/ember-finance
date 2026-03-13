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
  /** Total gross annual income — used for computing % of gross labels */
  grossAnnual: number;
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
 * Column 1: Gross Income hub (aggregates all sources)
 * Column 2: Pre-tax deductions (savings), Taxes (cost), Net Income (hub)
 * Column 3: Post-tax contributions (savings), Expenses (cost), Surplus/Deficit
 *
 * Nodes are ordered so savings items cluster together and costs cluster together.
 * Employer matches flow directly to their destination account at col 2.
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

  if (totalGross <= 0) return { nodes: [], links, grossAnnual: 0 };

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
    ci.bucket === 'savings' &&
    ci.destination_account_id != null &&
    accountById.get(ci.destination_account_id)?.tax_treatment === 'pre_tax';

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

  // ── Column 1: Gross Income hub (only when 2+ sources) ──
  // When there's a single source, skip the hub and link directly from the source.
  const useGrossHub = visibleSources.length > 1;
  let incomeOrigin: string;

  if (useGrossHub) {
    hubNodes.push({ id: 'gross-income', label: 'Gross Income', category: 'hub' });
    for (const src of visibleSources) {
      addLink(links, `inc-${src.income_source_id}`, 'gross-income', src.gross_monthly * 12);
    }
    incomeOrigin = 'gross-income';
  } else {
    incomeOrigin = `inc-${visibleSources[0].income_source_id}`;
  }

  // ── Column 2: Pre-tax deductions, Taxes, Net Income hub ──
  // All branch off the Gross Income hub.

  // Helper: get or create a single account node (used by both pre-tax deductions and employer matches)
  const accountNodeIds = new Set<string>();
  function ensureAccountNode(accountId: string): string {
    const nodeId = `acct-${accountId}`;
    if (!accountNodeIds.has(nodeId)) {
      accountNodeIds.add(nodeId);
      const acct = accountById.get(accountId);
      savingsNodes.push({ id: nodeId, label: acct?.name ?? 'Account', category: 'savings' });
    }
    return nodeId;
  }

  // Pre-tax savings → route through a "Pre-tax" hub so account nodes land at col 3
  const deductionItems = visibleItems.filter((ci) => isPreTaxSaving(ci));
  const matchItems = visibleItems.filter((ci) => ci.bucket === 'employer_match');
  let totalPreTaxHub = 0;

  // Accumulate pre-tax deduction amounts
  const deductionAmounts: { item: CashflowItem; annual: number }[] = [];
  for (const item of deductionItems) {
    const annual = resolveAnnual(item, incomeSources);
    if (annual <= 0) continue;
    deductionAmounts.push({ item, annual: annual * grossShare });
    totalPreTaxHub += annual * grossShare;
  }

  // Accumulate employer match amounts
  const matchAmounts: { item: CashflowItem; annual: number }[] = [];
  for (const item of matchItems) {
    const annual = resolveAnnual(item, incomeSources);
    if (annual <= 0) continue;
    matchAmounts.push({ item, annual });
    totalPreTaxHub += annual;
  }

  // Employer matches → directly to destination account (long link from col 0 to col 3)
  for (const { item, annual } of matchAmounts) {
    incomeNodes.push({ id: `match-${item.id}`, label: item.name, category: 'savings' });
    if (item.destination_account_id) {
      const targetId = ensureAccountNode(item.destination_account_id);
      addLink(links, `match-${item.id}`, targetId, annual);
    } else {
      addLink(links, `match-${item.id}`, 'net-income', annual);
    }
  }

  // Create Pre-tax hub if there are any employee pre-tax deductions
  const employeePreTaxTotal = deductionAmounts.reduce((s, d) => s + d.annual, 0);
  if (employeePreTaxTotal > 0) {
    hubNodes.push({ id: 'pre-tax', label: 'Pre-tax', category: 'hub' });
    addLink(links, incomeOrigin, 'pre-tax', employeePreTaxTotal);

    // Pre-tax hub → individual account nodes (col 3)
    for (const { item, annual } of deductionAmounts) {
      const targetId = ensureAccountNode(item.destination_account_id!);
      addLink(links, 'pre-tax', targetId, annual);
    }
  }

  // Taxes → cost (scaled proportionally when filtered)
  const taxAnnual = waterfall.total_tax_monthly * 12 * grossShare;
  if (taxAnnual > 0) {
    costNodes.push({ id: 'taxes', label: 'Taxes', category: 'cost' });
    addLink(links, incomeOrigin, 'taxes', taxAnnual);
  }

  // Net Income hub (scaled proportionally when filtered)
  const netIncomeAnnual = waterfall.total_net_income_monthly * 12 * grossShare;

  if (netIncomeAnnual > 0) {
    hubNodes.push({ id: 'net-income', label: 'Net Income', category: 'hub' });
    addLink(links, incomeOrigin, 'net-income', netIncomeAnnual);
  }

  // ── Column 3: Flows out of Net Income ──

  // Post-tax savings → contributions (saving items that are NOT pre-tax)
  // Merge into the same account node when a destination account is set.
  const postTaxItems = visibleItems.filter((ci) => ci.bucket === 'savings' && !isPreTaxSaving(ci));
  for (const item of postTaxItems) {
    let annual = resolveAnnual(item, incomeSources);
    // Scale unlinked items by gross share when filtered
    if (filterSourceIds && !item.income_source_id) annual *= grossShare;
    if (annual <= 0) continue;
    if (item.destination_account_id) {
      const targetId = ensureAccountNode(item.destination_account_id);
      addLink(links, 'net-income', targetId, annual);
    } else {
      // No destination account — use the item name as the node
      savingsNodes.push({ id: `contrib-${item.id}`, label: item.name, category: 'savings' });
      addLink(links, 'net-income', `contrib-${item.id}`, annual);
    }
  }

  // Expenses → cost
  const expenseItems = visibleItems.filter((ci) => ci.bucket === 'expense');
  if (expenseItems.length > 0) {
    for (const item of expenseItems) {
      let annual = resolveAnnual(item, incomeSources);
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
    savingsNodes.push({ id: 'surplus', label: 'Surplus', category: 'hub' });
    addLink(links, 'net-income', 'surplus', residual);
  } else if (residual < 0) {
    costNodes.push({ id: 'deficit', label: 'Shortfall', category: 'cost' });
    addLink(links, 'net-income', 'deficit', Math.abs(residual));
  }

  // Order: income first, then savings grouped together, hub, then costs grouped together.
  // This makes the Sankey visually cluster savings (teal) on top and costs (red) on bottom.
  const nodes = [...incomeNodes, ...savingsNodes, ...hubNodes, ...costNodes];

  return { nodes, links, grossAnnual: filteredGross };
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

function resolveAnnual(item: CashflowItem, incomeSources: IncomeSource[]): number {
  if (item.amount_type === 'percent' && item.income_source_id) {
    const source = incomeSources.find((s) => s.id === item.income_source_id);
    if (!source) return 0;
    const sourceAnnual = normalizeToAnnual(source.gross_amount, source.frequency);
    return sourceAnnual * (item.amount / 100);
  }
  return normalizeToAnnual(item.amount, item.frequency);
}
