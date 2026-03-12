'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardAction, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { fmt } from '@/lib/formatters';
import type { ProjectionResult } from '@shared/types';

interface ProjectionTableProps {
  projection: ProjectionResult;
}

export function ProjectionTable({ projection }: ProjectionTableProps) {
  const [showAll, setShowAll] = useState(false);

  const years = showAll
    ? projection.years
    : projection.years.filter((_, i) => i % 5 === 0 || i === projection.years.length - 1);

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>Year-by-Year Projection</CardTitle>
        <CardAction>
          <Button variant="ghost" size="xs" onClick={() => setShowAll(!showAll)}>
            {showAll ? 'Summary' : 'All years'}
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="-mx-4 overflow-x-auto sm:mx-0">
        <table className="w-full text-sm" aria-label="Portfolio projection by year">
          <thead>
            <tr className="border-b border-border/50 text-xs text-muted-foreground">
              <th scope="col" className="px-3 py-2 text-left font-medium">
                Year
              </th>
              <th scope="col" className="px-3 py-2 text-left font-medium">
                Age
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                Starting Portfolio
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                Contributions
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                Growth
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                Ending Portfolio
              </th>
            </tr>
          </thead>
          <tbody>
            {years.map((y) => (
              <tr key={y.year} className="border-b border-border/30 hover:bg-muted/30">
                <td className="px-3 py-1.5 font-mono tabular-nums">{y.year}</td>
                <td className="px-3 py-1.5 text-muted-foreground">
                  {y.age != null ? Math.floor(y.age) : '--'}
                </td>
                <td className="px-3 py-1.5 text-right font-mono tabular-nums">
                  {fmt(y.starting_portfolio)}
                </td>
                <td className="px-3 py-1.5 text-right font-mono tabular-nums">
                  {fmt(y.contributions)}
                </td>
                <td className="px-3 py-1.5 text-right font-mono tabular-nums text-gain">
                  {fmt(y.growth)}
                </td>
                <td className="px-3 py-1.5 text-right font-mono tabular-nums font-medium">
                  {fmt(y.ending_portfolio)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-border text-xs font-medium text-muted-foreground">
              <td colSpan={3} className="px-3 py-2">
                Totals
              </td>
              <td className="px-3 py-2 text-right font-mono tabular-nums">
                {fmt(projection.total_contributions)}
              </td>
              <td className="px-3 py-2 text-right font-mono tabular-nums text-gain">
                {fmt(projection.total_growth)}
              </td>
              <td className="px-3 py-2 text-right font-mono tabular-nums font-medium">
                {fmt(projection.final_portfolio)}
              </td>
            </tr>
          </tfoot>
        </table>
      </CardContent>
    </Card>
  );
}
