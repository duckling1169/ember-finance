'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardAction, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import { TableRow, TableCell } from '@/components/ui/table';
import { GainCell } from '@/components/common/financial-cells';
import { fmt } from '@/lib/formatters';
import type { ProjectionResult, ProjectionYear } from '@shared/types';

interface ProjectionTableProps {
  projection: ProjectionResult;
}

const COLUMNS: DataTableColumn<ProjectionYear>[] = [
  {
    key: 'year',
    header: 'Year',
    cellClassName: 'font-mono tabular-nums',
    cell: (y) => (y.year === 0 ? 'Today' : y.year),
  },
  {
    key: 'age',
    header: 'Age',
    cellClassName: 'text-muted-foreground',
    cell: (y) =>
      y.age != null ? (y.year === 0 ? Number(y.age).toFixed(1) : Math.floor(y.age)) : '--',
  },
  {
    key: 'starting_portfolio',
    header: 'Starting Portfolio',
    numeric: true,
    cell: (y) => fmt(y.starting_portfolio),
  },
  {
    key: 'contributions',
    header: 'Contributions',
    numeric: true,
    cell: (y) => fmt(y.contributions),
  },
  {
    key: 'growth',
    header: 'Growth',
    numeric: true,
    cell: (y) => <GainCell value={y.growth} />,
  },
  {
    key: 'ending_portfolio',
    header: 'Ending Portfolio',
    numeric: true,
    cellClassName: 'font-medium',
    cell: (y) => fmt(y.ending_portfolio),
  },
];

export function ProjectionTable({ projection }: ProjectionTableProps) {
  // Overview first (every 5th year); full detail on demand (principle 7)
  const [showAll, setShowAll] = useState(false);

  const years = showAll
    ? projection.years
    : projection.years.filter((_, i) => i % 5 === 0 || i === projection.years.length - 1);

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>Year-by-Year Projection</CardTitle>
        <CardAction>
          <Button variant="ghost" size="sm" onClick={() => setShowAll(!showAll)}>
            {showAll ? 'Summary' : 'All years'}
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <DataTable
          density="compact"
          mobile="scroll"
          columns={COLUMNS}
          rows={years}
          rowKey={(y) => String(y.year)}
          footer={
            <TableRow className="text-xs text-muted-foreground even:bg-transparent hover:bg-transparent">
              <TableCell colSpan={3} className="py-2">
                Totals
              </TableCell>
              <TableCell className="py-2 text-right font-mono tabular-nums">
                {fmt(projection.total_contributions)}
              </TableCell>
              <TableCell className="py-2 text-right font-mono tabular-nums">
                <GainCell value={projection.total_growth} />
              </TableCell>
              <TableCell className="py-2 text-right font-mono tabular-nums font-medium">
                {fmt(projection.final_portfolio)}
              </TableCell>
            </TableRow>
          }
        />
      </CardContent>
    </Card>
  );
}
