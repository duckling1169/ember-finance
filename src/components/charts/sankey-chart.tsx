'use client';

import { useState, useEffect } from 'react';
import { ResponsiveSankey } from '@nivo/sankey';
import { getNivoTheme, CHART_COLORS } from './theme';
import { ChartTooltip } from './chart-tooltip';
import { fmt } from '@/lib/formatters';
import type { SankeyData, SankeyNode } from '@/lib/sankey-transform';

interface SankeyChartProps {
  data: SankeyData;
  className?: string;
}

export function SankeyChart({ data, className }: SankeyChartProps) {
  const [theme, setTheme] = useState<ReturnType<typeof getNivoTheme> | null>(null);

  useEffect(() => {
    setTheme(getNivoTheme());
  }, []);

  if (!theme || data.nodes.length === 0) return null;

  return (
    <div className={className}>
      <ResponsiveSankey
        data={data}
        theme={theme}
        colors={CHART_COLORS}
        margin={{ top: 16, right: 100, bottom: 16, left: 100 }}
        label={(node) => (node as unknown as SankeyNode).label ?? node.id}
        align="justify"
        nodeOpacity={1}
        nodeHoverOthersOpacity={0.35}
        nodeThickness={18}
        nodeSpacing={14}
        nodeBorderWidth={0}
        nodeBorderRadius={3}
        linkOpacity={0.3}
        linkHoverOthersOpacity={0.1}
        linkContract={2}
        enableLinkGradient
        labelPosition="outside"
        labelOrientation="horizontal"
        labelPadding={12}
        labelTextColor={{ from: 'color', modifiers: [['brighter', 0.8]] }}
        nodeTooltip={({ node }) => (
          <ChartTooltip>
            <span style={{ fontWeight: 500 }}>{node.label}</span>
            <span style={{ marginLeft: 8, fontFamily: 'var(--font-mono, monospace)' }}>
              {fmt(node.value)}
            </span>
          </ChartTooltip>
        )}
        linkTooltip={({ link }) => (
          <ChartTooltip>
            <span>
              {link.source.label} → {link.target.label}
            </span>
            <span style={{ marginLeft: 8, fontFamily: 'var(--font-mono, monospace)' }}>
              {fmt(link.value)}
            </span>
          </ChartTooltip>
        )}
      />
    </div>
  );
}
