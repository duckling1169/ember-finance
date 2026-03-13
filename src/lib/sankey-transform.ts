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
  /** Override nivo's computed value for labels (used on hub nodes where outflows can exceed inflows) */
  displayValue?: number;
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
 * Column 2: Pre-tax hub, Taxes (cost), Net Income (hub)
 * Column 3: Savings accounts, Expenses (cost), Surplus (when positive)
 *
 * Nodes are ordered so savings items cluster together and costs cluster together.
 * Employer matches route through Gross → Pre-tax hub to reduce visual crossings.
 * Shortfall is omitted (shown in summary cards only); surplus flows out of Net Income.
 * Hub nodes carry a displayValue for correct labels when outflows exceed inflows.
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

  // ── Column 1: Gross Income hub (always present for proper column structure) ──
  hubNodes.push({
    id: 'gross-income',
    label: 'Gross Income',
    category: 'hub',
    displayValue: Math.round(filteredGross),
  });
  for (const src of visibleSources) {
    addLink(links, `inc-${src.income_source_id}`, 'gross-income', src.gross_monthly * 12);
  }
  const incomeOrigin = 'gross-income';

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

  // Employer matches → route through Gross hub to reduce visual crossings
  for (const { item, annual } of matchAmounts) {
    incomeNodes.push({ id: `match-${item.id}`, label: item.name, category: 'savings' });
    addLink(links, `match-${item.id}`, 'gross-income', annual);
  }

  // Create Pre-tax hub if there are any pre-tax deductions or employer matches
  if (totalPreTaxHub > 0) {
    hubNodes.push({ id: 'pre-tax', label: 'Pre-tax', category: 'hub' });
    addLink(links, incomeOrigin, 'pre-tax', totalPreTaxHub);

    // Pre-tax hub → individual account nodes (col 3)
    for (const { item, annual } of deductionAmounts) {
      const targetId = ensureAccountNode(item.destination_account_id!);
      addLink(links, 'pre-tax', targetId, annual);
    }
    for (const { item, annual } of matchAmounts) {
      if (item.destination_account_id) {
        const targetId = ensureAccountNode(item.destination_account_id);
        addLink(links, 'pre-tax', targetId, annual);
      }
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
    hubNodes.push({
      id: 'net-income',
      label: 'Net Income',
      category: 'hub',
      displayValue: Math.round(netIncomeAnnual),
    });
    addLink(links, incomeOrigin, 'net-income', netIncomeAnnual);
  }

  // ── Column 3: Flows out of Net Income ──
  // Collect planned outflows first, then cap to net income if there's a shortfall.

  type PendingOutflow = {
    targetId: string;
    amount: number;
    node?: SankeyNode;
  };
  const pendingOutflows: PendingOutflow[] = [];

  // Post-tax savings → contributions (saving items that are NOT pre-tax)
  const postTaxItems = visibleItems.filter((ci) => ci.bucket === 'savings' && !isPreTaxSaving(ci));
  for (const item of postTaxItems) {
    let annual = resolveAnnual(item, incomeSources);
    if (filterSourceIds && !item.income_source_id) annual *= grossShare;
    if (annual <= 0) continue;
    if (item.destination_account_id) {
      const targetId = ensureAccountNode(item.destination_account_id);
      pendingOutflows.push({ targetId, amount: annual });
    } else {
      const nodeId = `contrib-${item.id}`;
      const node: SankeyNode = { id: nodeId, label: item.name, category: 'savings' };
      pendingOutflows.push({ targetId: nodeId, amount: annual, node });
    }
  }

  // Expenses → cost
  const expenseItems = visibleItems.filter((ci) => ci.bucket === 'expense');
  if (expenseItems.length > 0) {
    for (const item of expenseItems) {
      let annual = resolveAnnual(item, incomeSources);
      if (filterSourceIds && !item.income_source_id) annual *= grossShare;
      if (annual <= 0) continue;
      const nodeId = `exp-${item.id}`;
      const node: SankeyNode = { id: nodeId, label: item.name, category: 'cost' };
      pendingOutflows.push({ targetId: nodeId, amount: annual, node });
    }
  } else if (waterfall.total_expenses_annual > 0) {
    const node: SankeyNode = { id: 'expenses', label: 'Expenses', category: 'cost' };
    pendingOutflows.push({
      targetId: 'expenses',
      amount: waterfall.total_expenses_annual * grossShare,
      node,
    });
  }

  // Surplus (only when positive)
  const residual = waterfall.total_residual_annual * grossShare;
  if (residual > 0) {
    const node: SankeyNode = { id: 'surplus', label: 'Surplus', category: 'hub' };
    pendingOutflows.push({ targetId: 'surplus', amount: residual, node });
  }

  // Cap outflows to net income so the bar height matches the inflow.
  // When there's a shortfall, scale all outflows proportionally.
  const totalPlanned = pendingOutflows.reduce((s, o) => s + o.amount, 0);
  const capRatio =
    netIncomeAnnual > 0 && totalPlanned > netIncomeAnnual ? netIncomeAnnual / totalPlanned : 1;

  for (const outflow of pendingOutflows) {
    if (outflow.node) {
      // When capped, preserve the real planned amount for labels
      if (capRatio < 1) outflow.node.displayValue = Math.round(outflow.amount);
      if (outflow.node.category === 'savings') savingsNodes.push(outflow.node);
      else if (outflow.node.category === 'cost') costNodes.push(outflow.node);
      else savingsNodes.push(outflow.node); // surplus
    }
    addLink(links, 'net-income', outflow.targetId, outflow.amount * capRatio);
  }

  // Sort links by value descending so that each source node's largest outgoing
  // flow gets the top slot (minimises visual crossing between columns).
  links.sort((a, b) => b.value - a.value);

  // Sort nodes within each category by total link value (descending)
  // so that the largest items are positioned at the top of each group.
  const nodeValue = (n: SankeyNode) =>
    links
      .filter((l) => l.source === n.id || l.target === n.id)
      .reduce((sum, l) => sum + l.value, 0);

  const sortDesc = (a: SankeyNode, b: SankeyNode) => nodeValue(b) - nodeValue(a);

  // Category priority: income/savings/hub on top, costs on bottom.
  // Within each group, sort by value descending. Surplus always last.
  const categoryOrder: Record<SankeyNode['category'], number> = {
    income: 0,
    savings: 1,
    hub: 2,
    cost: 3,
  };

  const allNodes = [...incomeNodes, ...savingsNodes, ...hubNodes, ...costNodes];
  const surplusNode = allNodes.find((n) => n.id === 'surplus');
  const sortableNodes = allNodes.filter((n) => n.id !== 'surplus');

  sortableNodes.sort((a, b) => {
    const catDiff = categoryOrder[a.category] - categoryOrder[b.category];
    if (catDiff !== 0) return catDiff;
    return nodeValue(b) - nodeValue(a);
  });

  const nodes = [...sortableNodes, ...(surplusNode ? [surplusNode] : [])];

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
