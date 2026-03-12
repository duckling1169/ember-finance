'use client';

import { useMemo } from 'react';
import { ResponsiveLine } from '@nivo/line';
import { useNivoTheme, CHART_COLORS } from '@/components/charts/theme';
import { ChartTooltip } from '@/components/charts/chart-tooltip';
import { fmt, fmtAxisK } from '@/lib/formatters';
import type { ProjectionResult } from '@shared/types';

interface ProjectionChartProps {
  projection: ProjectionResult;
  fireNumber?: number;
  className?: string;
}

export function ProjectionChart({ projection, fireNumber, className }: ProjectionChartProps) {
  const theme = useNivoTheme();

  const nivoData = useMemo(
    () => [
      {
        id: 'Portfolio',
        data: projection.years.map((y) => ({
          x: y.age != null ? Math.floor(y.age) : y.year,
          y: y.ending_portfolio,
        })),
      },
    ],
    [projection],
  );

  if (!theme || projection.years.length === 0) return null;

  const hasAge = projection.years[0]?.age != null;
  const maxY = Math.max(...projection.years.map((y) => y.ending_portfolio), fireNumber ?? 0);

  // Generate clean x-axis tick values (every 5 years)
  const xValues = projection.years
    .filter((_, i) => i % 5 === 0 || i === projection.years.length - 1)
    .map((y) => (hasAge && y.age != null ? Math.floor(y.age) : y.year));

  return (
    <div
      className={className}
      role="img"
      aria-label="Portfolio projection chart showing projected portfolio growth over time"
    >
      <ResponsiveLine
        data={nivoData}
        theme={theme}
        colors={[CHART_COLORS[0]]}
        margin={{ top: 16, right: 16, bottom: 36, left: 60 }}
        xScale={{ type: 'linear', min: 'auto', max: 'auto' }}
        yScale={{ type: 'linear', min: 0, max: maxY * 1.05 }}
        axisBottom={{
          tickSize: 0,
          tickPadding: 8,
          tickValues: xValues,
          format: (v) => String(Math.round(Number(v))),
          legend: hasAge ? 'Age' : 'Year',
          legendOffset: 28,
          legendPosition: 'middle',
        }}
        axisLeft={{
          tickSize: 0,
          tickPadding: 8,
          tickValues: 5,
          format: fmtAxisK,
        }}
        gridYValues={5}
        enableGridX={false}
        lineWidth={2}
        enablePoints={false}
        useMesh
        enableCrosshair
        crosshairType="x"
        tooltip={({ point }) => (
          <ChartTooltip>
            <span style={{ color: 'var(--muted-foreground)' }}>
              {hasAge ? `Age ${point.data.x}` : `Year ${point.data.x}`}
            </span>
            <span style={{ marginLeft: 8, fontFamily: 'var(--font-mono, monospace)' }}>
              {fmt(point.data.y as number)}
            </span>
          </ChartTooltip>
        )}
        markers={
          fireNumber
            ? [
                {
                  axis: 'y',
                  value: fireNumber,
                  lineStyle: { stroke: CHART_COLORS[11], strokeWidth: 1.5, strokeDasharray: '6 4' },
                  legend: `FI Number ${fmtAxisK(fireNumber)}`,
                  legendPosition: 'top-right',
                  textStyle: { fill: CHART_COLORS[11], fontSize: 11 },
                },
              ]
            : undefined
        }
      />
    </div>
  );
}
