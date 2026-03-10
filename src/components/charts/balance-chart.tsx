'use client';

import { useMemo, useState, useEffect } from 'react';
import { ResponsiveLine } from '@nivo/line';
import { getNivoTheme, CHART_COLORS } from './theme';
import { fmt, fmtAxisK } from '@/lib/formatters';

function AreaGradientLayer(props: Record<string, unknown>) {
  const { series, xScale, yScale, innerHeight } = props as {
    series: { data: { data: { x: Date; y: number } }[] }[];
    xScale: (v: Date) => number;
    yScale: (v: number) => number;
    innerHeight: number;
  };
  if (!series?.[0]?.data?.length) return null;
  const id = 'balance-gradient';
  const points = series[0].data;
  const path = points
    .map((p, i) => {
      const x = xScale(p.data.x);
      const y = yScale(p.data.y);
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    })
    .join(' ');

  const lastX = xScale(points[points.length - 1].data.x);
  const firstX = xScale(points[0].data.x);
  const areaPath = `${path} L ${lastX} ${innerHeight} L ${firstX} ${innerHeight} Z`;

  return (
    <>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={CHART_COLORS[0]} stopOpacity={0.4} />
          <stop offset="100%" stopColor={CHART_COLORS[0]} stopOpacity={0.02} />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${id})`} />
    </>
  );
}

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
