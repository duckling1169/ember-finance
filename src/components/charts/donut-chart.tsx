'use client';

import { useMemo, useState, useEffect } from 'react';
import { ResponsivePie } from '@nivo/pie';
import { getNivoTheme, CHART_COLORS } from './theme';
import { fmt } from '@/lib/formatters';

interface DonutChartProps {
  segments: { id: string; label: string; value: number }[];
  total: number;
  /** Size class — defaults to w-28 h-28 */
  className?: string;
}

export function DonutChart({ segments, total, className = 'w-28 h-28' }: DonutChartProps) {
  const [theme, setTheme] = useState<ReturnType<typeof getNivoTheme> | null>(null);

  useEffect(() => {
    setTheme(getNivoTheme());
  }, []);

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
          <div
            style={{
              background: 'var(--popover)',
              color: 'var(--popover-foreground)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              padding: '6px 10px',
              fontSize: 12,
              boxShadow: '0 4px 6px -1px rgb(0 0 0 / .1)',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
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
          </div>
        )}
      />
    </div>
  );
}
