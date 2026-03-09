'use client';

import { Card, CardContent } from '@/components/ui/card';
import { IconChartLine } from '@tabler/icons-react';

export default function InvestmentsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Investments</h1>

      <Card>
        <CardContent>
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <IconChartLine size={32} className="text-muted-foreground" stroke={1.5} />
            <p className="text-sm text-muted-foreground">
              Holdings, performance, and allocation views coming soon.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
