'use client';

import { useEffect, useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getHousehold, getAccounts } from '@/lib/api';
import { devBypass, mockAccounts, mockNetWorthHistory } from '@/lib/mock-data';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { IconBuildingBank, IconArrowUpRight, IconArrowDownRight } from '@tabler/icons-react';

interface AccountData {
  id: string;
  name: string;
  institution: string | null;
  account_type: string;
  balance?: number;
  change_pct?: number;
  [key: string]: unknown;
}

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}

function ChangeCell({ value }: { value: number }) {
  if (value === 0)
    return <span className="font-mono tabular-nums text-muted-foreground">&mdash;</span>;
  const color = value > 0 ? 'text-gain' : 'text-loss';
  const prefix = value > 0 ? '+' : '';
  const Icon = value > 0 ? IconArrowUpRight : IconArrowDownRight;
  return (
    <span className={`inline-flex items-center gap-1 font-mono tabular-nums ${color}`}>
      <Icon size={14} />
      {prefix}
      {value.toFixed(1)}%
    </span>
  );
}

export default function HomePage() {
  return <HomeContent />;
}

function HomeContent() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<AccountData[]>(devBypass ? mockAccounts : []);
  const [loading, setLoading] = useState(!devBypass);

  const loadData = useCallback(async () => {
    if (devBypass) return;
    try {
      const h = (await getHousehold()) as { id: string } | null;
      if (!h) {
        router.replace('/onboarding');
        return;
      }
      const accts = await getAccounts(h.id);
      setAccounts(accts as AccountData[]);
    } catch {
      // Household not set up
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return <div className="py-10 text-muted-foreground">Loading...</div>;
  }

  const netWorth = accounts.reduce((sum, a) => sum + (a.balance ?? 0), 0);
  const prevMonth = mockNetWorthHistory[mockNetWorthHistory.length - 2]?.value ?? netWorth;
  const monthChange = netWorth - prevMonth;
  const monthChangePct = prevMonth ? (monthChange / prevMonth) * 100 : 0;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Home</h1>

      {/* Net worth */}
      <Card>
        <CardHeader>
          <CardTitle>Net Worth</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <p className="text-3xl font-semibold font-mono tabular-nums">{fmt(netWorth)}</p>
              <p
                className={`mt-1 text-sm font-mono tabular-nums ${monthChange >= 0 ? 'text-gain' : 'text-loss'}`}
              >
                {monthChange >= 0 ? '+' : ''}
                {fmt(monthChange)} ({monthChange >= 0 ? '+' : ''}
                {monthChangePct.toFixed(1)}%) this month
              </p>
            </div>
            {/* Sparkline-style bar chart */}
            {devBypass && (
              <div className="flex items-end gap-1 h-32">
                {mockNetWorthHistory.map((point) => {
                  const min = Math.min(...mockNetWorthHistory.map((p) => p.value));
                  const max = Math.max(...mockNetWorthHistory.map((p) => p.value));
                  const range = max - min || 1;
                  const height = ((point.value - min) / range) * 100;
                  const isLast = point === mockNetWorthHistory[mockNetWorthHistory.length - 1];
                  return (
                    <div key={point.date} className="flex-1 flex flex-col items-center gap-1">
                      <div
                        className={`w-full rounded-sm transition-colors ${isLast ? 'bg-primary' : 'bg-muted-foreground/20 hover:bg-muted-foreground/40'}`}
                        style={{ height: `${Math.max(height, 4)}%` }}
                        title={`${point.date}: ${fmt(point.value)}`}
                      />
                      <span className="text-[10px] text-muted-foreground">
                        {point.date.split('-')[1]}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Accounts table */}
      <Card>
        <CardHeader>
          <CardTitle>Accounts</CardTitle>
        </CardHeader>
        <CardContent>
          {accounts.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <IconBuildingBank size={32} className="text-muted-foreground" stroke={1.5} />
              <p className="text-sm text-muted-foreground">No accounts yet</p>
              <button
                onClick={() => router.push('/accounts')}
                className="text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                Add your first account
              </button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Institution</TableHead>
                  <TableHead>Type</TableHead>
                  {devBypass && <TableHead className="text-right">Balance</TableHead>}
                  {devBypass && <TableHead className="text-right">Change</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.name}</TableCell>
                    <TableCell>{a.institution || '\u2014'}</TableCell>
                    <TableCell className="capitalize">{a.account_type}</TableCell>
                    {devBypass && (
                      <TableCell className="text-right font-mono tabular-nums">
                        {fmt(a.balance ?? 0)}
                      </TableCell>
                    )}
                    {devBypass && (
                      <TableCell className="text-right">
                        <ChangeCell value={a.change_pct ?? 0} />
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
