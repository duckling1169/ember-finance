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

  // Deduplicate ages (year 0 fractional may floor to same as year 1)
  const hasAge = projection.years[0]?.age != null;
  const seen = new Set<number>();
  const dedupedYears = projection.years.filter((y) => {
    const x = hasAge && y.age != null ? Math.floor(y.age) : y.year;
    if (seen.has(x)) return false;
    seen.add(x);
    return true;
  });

  const nivoData = useMemo(
    () => [
      {
        id: 'Portfolio',
        data: dedupedYears.map((y) => ({
          x: String(hasAge && y.age != null ? Math.floor(y.age) : y.year),
          y: y.ending_portfolio,
        })),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [projection],
  );

  if (!theme || projection.years.length === 0) return null;

  const maxY = Math.max(...projection.years.map((y) => y.ending_portfolio), fireNumber ?? 0);

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
        margin={{ top: 8, right: 12, bottom: 28, left: 52 }}
        xScale={{ type: 'point' }}
        yScale={{ type: 'linear', min: 0, max: maxY * 1.05 }}
        axisBottom={{
          tickSize: 0,
          tickPadding: 8,
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
