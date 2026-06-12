'use client';

import { ResponsiveSankey } from '@nivo/sankey';
import { useNivoTheme } from './theme';
import { ChartTooltip } from './chart-tooltip';
import { fmt } from '@/lib/formatters';
import { useContainerWidth } from '@/lib/use-container-width';
import type { SankeyData, SankeyNode } from '@/lib/sankey-transform';
import { SANKEY_CATEGORY_COLORS } from '@/lib/sankey-transform';

interface SankeyChartProps {
  data: SankeyData;
  className?: string;
  /** Override auto-calculated height */
  height?: number;
}

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Custom label layer.
 *
 * Desktop: renders name + amount + % of gross outside each node.
 * Compact (narrow containers): renders the name only, anchored inward so
 * labels sit over the diagram instead of requiring wide side margins; the
 * amount stays available in the tooltip.
 */
function makeStackedLabels(grossAnnual: number, compact: boolean) {
  return function StackedLabels({ nodes, width }: { nodes: readonly any[]; width: number }) {
    return (
      <g>
        {nodes.map((node: any) => {
          const midX = (node.x0 + node.x1) / 2;
          const isLeft = midX < width / 2;
          const labelY = (node.y0 + node.y1) / 2;

          if (compact) {
            // Name only, rendered inward over the diagram
            const labelX = isLeft ? node.x1 + 6 : node.x0 - 6;
            const anchor = isLeft ? 'start' : 'end';
            return (
              <g key={node.id} transform={`translate(${labelX}, ${labelY})`}>
                <text
                  textAnchor={anchor}
                  dominantBaseline="central"
                  style={{
                    fill: node.color,
                    fontSize: 10,
                    fontWeight: 500,
                    filter: 'brightness(1.3)',
                  }}
                >
                  {node.label}
                </text>
              </g>
            );
          }

          const labelX = isLeft ? node.x0 - 12 : node.x1 + 12;
          const anchor = isLeft ? 'end' : 'start';

          // Hub nodes may have a displayValue override (correct inflow amount
          // when outflows exceed inflows, e.g. shortfall scenarios).
          const labelValue = node.displayValue ?? node.value;
          const pct = grossAnnual > 0 ? ((labelValue / grossAnnual) * 100).toFixed(1) : null;

          const amountLabel = pct ? `${fmt(labelValue)} (${pct}%)` : fmt(labelValue);

          return (
            <g key={node.id} transform={`translate(${labelX}, ${labelY})`}>
              <text
                textAnchor={anchor}
                dominantBaseline="auto"
                dy={-3}
                style={{
                  fill: node.color,
                  fontSize: 11,
                  fontWeight: 500,
                  filter: 'brightness(1.3)',
                }}
              >
                {node.label}
              </text>
              <text
                textAnchor={anchor}
                dominantBaseline="hanging"
                dy={3}
                style={{
                  fill: node.color,
                  fontSize: 10,
                  fontFamily: 'var(--font-mono, monospace)',
                  opacity: 0.8,
                  filter: 'brightness(1.3)',
                }}
              >
                {amountLabel}
              </text>
            </g>
          );
        })}
      </g>
    );
  };
}

/* eslint-enable @typescript-eslint/no-explicit-any */

export function SankeyChart({ data, className, height }: SankeyChartProps) {
  const theme = useNivoTheme();
  const { ref, width } = useContainerWidth<HTMLDivElement>();

  if (!theme || data.nodes.length === 0) return null;

  // Compact mode below ~640px container width; until measured, render desktop
  const compact = width !== null && width < 640;

  // Build id→label lookup from our data so tooltips always resolve correctly
  const labelById = new Map(data.nodes.map((n) => [n.id, n.label]));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const resolveLabel = (nodeOrId: any): string => {
    if (typeof nodeOrId === 'string') return labelById.get(nodeOrId) || nodeOrId;
    if (!nodeOrId) return '';
    return nodeOrId.label || labelById.get(nodeOrId.id) || nodeOrId.id || '';
  };

  // Dynamic height: scale with node count so items don't get squished
  const autoHeight = compact
    ? Math.min(480, Math.max(360, data.nodes.length * 40))
    : Math.max(550, data.nodes.length * 55);
  const chartHeight = height ?? autoHeight;

  const StackedLabels = makeStackedLabels(data.grossAnnual, compact);

  return (
    <div
      ref={ref}
      className={className}
      style={{ height: chartHeight }}
      role="img"
      aria-label="Sankey diagram showing money flow from income through taxes and deductions to savings and expenses"
    >
      <ResponsiveSankey
        data={data}
        theme={theme}
        colors={(node) => {
          const sankeyNode = node as unknown as SankeyNode;
          return SANKEY_CATEGORY_COLORS[sankeyNode.category] ?? '#8a3ffc';
        }}
        margin={
          compact
            ? { top: 12, right: 12, bottom: 12, left: 12 }
            : { top: 16, right: 140, bottom: 16, left: 140 }
        }
        sort="input"
        align="justify"
        nodeOpacity={1}
        nodeHoverOthersOpacity={0.35}
        nodeThickness={compact ? 14 : 18}
        nodeSpacing={compact ? 8 : 14}
        nodeBorderWidth={0}
        nodeBorderRadius={3}
        linkOpacity={0.3}
        linkHoverOthersOpacity={0.1}
        linkContract={2}
        enableLinkGradient
        label={(node) => (node as unknown as SankeyNode).label ?? node.id}
        enableLabels={false}
        layers={['links', 'nodes', StackedLabels]}
        nodeTooltip={({ node }) => (
          <ChartTooltip>
            <div style={{ fontWeight: 500, whiteSpace: 'nowrap' }}>{resolveLabel(node)}</div>
            <div style={{ fontFamily: 'var(--font-mono, monospace)', opacity: 0.8 }}>
              {fmt(node.value)}
            </div>
          </ChartTooltip>
        )}
        linkTooltip={({ link }) => (
          <ChartTooltip>
            <div style={{ fontWeight: 500, whiteSpace: 'nowrap' }}>
              {resolveLabel(link.source)} → {resolveLabel(link.target)}
            </div>
            <div style={{ fontFamily: 'var(--font-mono, monospace)', opacity: 0.8 }}>
              {fmt(link.value)}
            </div>
          </ChartTooltip>
        )}
      />
    </div>
  );
}
