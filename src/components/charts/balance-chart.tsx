'use client';

import { useMemo, useState, useEffect } from 'react';
import { ResponsiveLine } from '@nivo/line';
import { getNivoTheme, CHART_COLORS } from './theme';
import { createAreaGradientLayer } from './gradient-layer';
import { fmt, fmtAxisK } from '@/lib/formatters';

const AreaGradientLayer = createAreaGradientLayer('balance-gradient');

interface BalanceChartProps {
  data: { date: string; balance: number }[];
}

export function BalanceChart({ data }: BalanceChartProps) {
  const [theme, setTheme] = useState<ReturnType<typeof getNivoTheme> | null>(null);

  useEffect(() => {
    setTheme(getNivoTheme());
  }, []);

  const nivoData = useMemo(
    () => [
      {
        id: 'balance',
        data: data.map((d) => ({ x: new Date(d.date), y: d.balance })),
      },
    ],
    [data],
  );

  if (!theme || data.length < 2) return null;

  return (
    <div className="h-[200px]">
      <ResponsiveLine
        data={nivoData}
        theme={theme}
        colors={[CHART_COLORS[0]]}
        margin={{ top: 12, right: 16, bottom: 28, left: 64 }}
        xScale={{ type: 'time' }}
        yScale={{ type: 'linear', min: 'auto', max: 'auto' }}
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
        lineWidth={2.5}
        enablePoints
        pointSize={6}
        pointColor={CHART_COLORS[0]}
        pointBorderWidth={2}
        pointBorderColor="var(--background)"
        useMesh
        enableCrosshair
        crosshairType="x"
        tooltip={({ point }) => (
          <div
            style={{
              background: 'var(--popover)',
              color: 'var(--popover-foreground)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              padding: '6px 10px',
              fontSize: 12,
              boxShadow: '0 4px 6px -1px rgb(0 0 0 / .1)',
            }}
          >
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
          </div>
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
