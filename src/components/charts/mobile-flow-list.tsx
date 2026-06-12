'use client';

import { useState } from 'react';
import { IconChevronRight, IconChevronDown } from '@tabler/icons-react';
import { cn } from '@/lib/utils';
import { fmt } from '@/lib/formatters';
import type { SankeyData, SankeyNode } from '@/lib/sankey-transform';

/**
 * Small-screen replacement for the Sankey diagram (mobile-density guidance):
 * a vertically stacked list of flow nodes grouped by stage, with tap-to-expand
 * inbound/outbound link breakdowns (details on demand) instead of pinch-zoom.
 */

const CATEGORY_ORDER: SankeyNode['category'][] = ['income', 'hub', 'savings', 'cost'];

const CATEGORY_LABELS: Record<SankeyNode['category'], string> = {
  income: 'Income',
  hub: 'Through',
  savings: 'To savings',
  cost: 'Costs',
};

const CATEGORY_TEXT: Record<SankeyNode['category'], string> = {
  income: 'text-info',
  hub: 'text-muted-foreground',
  savings: 'text-gain',
  cost: 'text-loss',
};

export function MobileFlowList({ data }: { data: SankeyData }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const nodeValue = (node: SankeyNode) => {
    if (node.displayValue != null) return node.displayValue;
    const inbound = data.links.filter((l) => l.target === node.id);
    const outbound = data.links.filter((l) => l.source === node.id);
    return Math.max(
      inbound.reduce((s, l) => s + l.value, 0),
      outbound.reduce((s, l) => s + l.value, 0),
    );
  };

  const labelById = new Map(data.nodes.map((n) => [n.id, n.label]));

  return (
    <div className="space-y-4">
      {CATEGORY_ORDER.map((category) => {
        const nodes = data.nodes.filter((n) => n.category === category);
        if (nodes.length === 0) return null;
        return (
          <div key={category}>
            <p className="mb-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {CATEGORY_LABELS[category]}
            </p>
            <div className="divide-y divide-border rounded-md border border-border">
              {nodes.map((node) => {
                const isExpanded = expandedId === node.id;
                const value = nodeValue(node);
                const inbound = data.links.filter((l) => l.target === node.id);
                const outbound = data.links.filter((l) => l.source === node.id);
                const pctOfGross = data.grossAnnual > 0 ? (value / data.grossAnnual) * 100 : 0;
                return (
                  <div key={node.id}>
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : node.id)}
                      aria-expanded={isExpanded}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left"
                    >
                      {isExpanded ? (
                        <IconChevronDown size={14} className="shrink-0 text-muted-foreground" />
                      ) : (
                        <IconChevronRight size={14} className="shrink-0 text-muted-foreground" />
                      )}
                      <span className="min-w-0 flex-1 truncate text-sm">{node.label}</span>
                      <span
                        className={cn(
                          'font-mono text-sm tabular-nums',
                          CATEGORY_TEXT[node.category],
                        )}
                      >
                        {fmt(value)}
                      </span>
                      <span className="w-10 text-right font-mono text-xs tabular-nums text-muted-foreground">
                        {pctOfGross.toFixed(0)}%
                      </span>
                    </button>
                    {isExpanded && (inbound.length > 0 || outbound.length > 0) && (
                      <div className="space-y-1 bg-muted/30 px-3 py-2 pl-9 text-xs">
                        {inbound.map((l, i) => (
                          <div
                            key={`in-${i}`}
                            className="flex items-baseline justify-between gap-2"
                          >
                            <span className="truncate text-muted-foreground">
                              from {labelById.get(String(l.source)) ?? l.source}
                            </span>
                            <span className="font-mono tabular-nums">{fmt(l.value)}</span>
                          </div>
                        ))}
                        {outbound.map((l, i) => (
                          <div
                            key={`out-${i}`}
                            className="flex items-baseline justify-between gap-2"
                          >
                            <span className="truncate text-muted-foreground">
                              to {labelById.get(String(l.target)) ?? l.target}
                            </span>
                            <span className="font-mono tabular-nums">{fmt(l.value)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
