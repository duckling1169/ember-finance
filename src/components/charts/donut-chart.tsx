'use client';

import { useMemo } from 'react';
import { ResponsivePie } from '@nivo/pie';
import { useNivoTheme, CHART_COLORS } from './theme';
import { ChartTooltip } from './chart-tooltip';

interface DonutChartProps {
  segments: { id: string; label: string; value: number }[];
  total: number;
  /** Size class — defaults to w-28 h-28 */
  className?: string;
}

export function DonutChart({ segments, total, className = 'w-28 h-28' }: DonutChartProps) {
  const theme = useNivoTheme();

  const nivoData = useMemo(
    () =>
      segments.map((s, i) => ({
        id: s.id,
        label: s.label,
        value: s.value,
        color: CHART_COLORS[i % CHART_COLORS.length],
      })),
    [segments],
  );

  if (!theme || segments.length === 0) return null;

  return (
    <div className={`shrink-0 ${className}`}>
      <ResponsivePie
        data={nivoData}
        theme={theme}
        colors={{ datum: 'data.color' }}
        margin={{ top: 4, right: 4, bottom: 4, left: 4 }}
        innerRadius={0.6}
        padAngle={1}
        cornerRadius={2}
        enableArcLabels={false}
        enableArcLinkLabels={false}
        activeOuterRadiusOffset={4}
        tooltip={({ datum }) => (
          <ChartTooltip style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: 2,
                background: datum.color,
                display: 'inline-block',
              }}
            />
            <span>
              {String(datum.label).length > 16
                ? String(datum.label).slice(0, 16) + '...'
                : String(datum.label)}
            </span>
            <span style={{ fontFamily: 'var(--font-mono, monospace)', marginLeft: 4 }}>
              {((datum.value / total) * 100).toFixed(1)}%
            </span>
          </ChartTooltip>
        )}
      />
    </div>
  );
}
