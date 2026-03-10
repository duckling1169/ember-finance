'use client';

import { useMemo, useState, useEffect } from 'react';
import { ResponsiveLine } from '@nivo/line';
import { getNivoTheme, CHART_COLORS } from './theme';
import { createAreaGradientLayer } from './gradient-layer';
import { ChartTooltip } from './chart-tooltip';
import { fmt, fmtAxisK } from '@/lib/formatters';

const AreaGradientLayer = createAreaGradientLayer('area-gradient');

interface AreaChartProps {
  data: { date: string; value: number }[];
  className?: string;
}

export function AreaChart({ data, className }: AreaChartProps) {
  const [theme, setTheme] = useState<ReturnType<typeof getNivoTheme> | null>(null);

  useEffect(() => {
    setTheme(getNivoTheme());
  }, []);

  const nivoData = useMemo(
    () => [
      {
        id: 'value',
        data: data.map((d) => ({ x: new Date(d.date), y: d.value })),
      },
    ],
    [data],
  );

  if (!theme || data.length === 0) return null;

  return (
    <div className={className}>
      <ResponsiveLine
        data={nivoData}
        theme={theme}
        colors={[CHART_COLORS[0]]}
        margin={{ top: 8, right: 12, bottom: 28, left: 52 }}
        xScale={{ type: 'time' }}
        yScale={{ type: 'linear', min: 'auto', max: 'auto', stacked: false }}
        xFormat="time:%Y-%m-%d"
        axisBottom={{
          tickSize: 0,
          tickPadding: 8,
          format: (v: Date) => v.toLocaleString('en-US', { month: 'short' }),
          tickValues: 'every 1 month',
        }}
        axisLeft={{
          tickSize: 0,
          tickPadding: 8,
          tickValues: 4,
          format: fmtAxisK,
        }}
        gridYValues={4}
        enableGridX={false}
        lineWidth={2}
        enablePoints={false}
        useMesh
        enableCrosshair
        crosshairType="x"
        tooltip={({ point }) => (
          <ChartTooltip>
            <span style={{ color: 'var(--muted-foreground)' }}>
              {(point.data.x as Date).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </span>
            <span style={{ marginLeft: 8, fontFamily: 'var(--font-mono, monospace)' }}>
              {fmt(point.data.y as number)}
            </span>
          </ChartTooltip>
        )}
        layers={[
          'grid',
          'axes',
          AreaGradientLayer as never,
          'lines',
          'crosshair',
          'points',
          'slices',
          'mesh',
        ]}
      />
    </div>
  );
}
