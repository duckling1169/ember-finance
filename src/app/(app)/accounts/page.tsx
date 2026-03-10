'use client';

import { useState, useEffect, useCallback } from 'react';
import { getHousehold, getAccounts, createAccount } from '@/lib/api';
import { devBypass, mockAccounts } from '@/lib/mock-data';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  IconPlus,
  IconX,
  IconBuildingBank,
  IconArrowUpRight,
  IconArrowDownRight,
} from '@tabler/icons-react';

const ACCOUNT_TYPES = [
  'checking',
  'savings',
  'credit',
  'brokerage',
  'retirement',
  'hsa',
  'loan',
  'mortgage',
  'property',
  'vehicle',
  'other',
];

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

export default function AccountsPage() {
  return <AccountsContent />;
}

function AccountsContent() {
  const [householdId, setHouseholdId] = useState<string | null>(
    devBypass ? 'mock-household' : null,
  );
  const [accounts, setAccounts] = useState<AccountData[]>(devBypass ? mockAccounts : []);
  const [loading, setLoading] = useState(!devBypass);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadData = useCallback(async () => {
    if (devBypass) return;
    try {
      const h = (await getHousehold()) as { id: string };
      setHouseholdId(h.id);
      const accts = await getAccounts(h.id);
      setAccounts(accts as AccountData[]);
    } catch {
      // no household
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!householdId) return;
    setSaving(true);
    setError('');
    const form = new FormData(e.currentTarget);

    if (devBypass) {
      // Add to local state in dev mode
      const newAccount: AccountData = {
        id: `mock-${Date.now()}`,
        name: form.get('name') as string,
        institution: null,
        account_type: form.get('account_type') as string,
        balance: 0,
        change_pct: 0,
      };
      setAccounts((prev) => [...prev, newAccount]);
      setShowForm(false);
      setSaving(false);
      return;
    }

    try {
      await createAccount(householdId, {
        name: form.get('name'),
        account_type: form.get('account_type'),
      });
      setShowForm(false);
      const accts = await getAccounts(householdId);
      setAccounts(accts as AccountData[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add account');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="py-10 text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Accounts</h1>
        {showForm ? (
          <Button variant="ghost" onClick={() => setShowForm(false)}>
            <IconX size={16} />
            Cancel
          </Button>
        ) : (
          <Button
            variant="outline"
            className="hover:bg-primary hover:text-primary-foreground hover:border-primary"
            onClick={() => setShowForm(true)}
          >
            <IconPlus size={16} />
            Add Account
          </Button>
        )}
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
      )}

      {showForm && (
        <Card>
          <CardContent>
            <form onSubmit={handleAdd} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium">Account Name</label>
                <Input name="name" required placeholder="Fidelity 401(k)" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Type</label>
                <select
                  name="account_type"
                  required
                  className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm capitalize outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
                >
                  {ACCOUNT_TYPES.map((t) => (
                    <option key={t} value={t} className="capitalize">
                      {t.charAt(0).toUpperCase() + t.slice(1).replace('_', ' ')}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end">
                <Button
                  type="submit"
                  variant="outline"
                  disabled={saving}
                  className="hover:bg-primary hover:text-primary-foreground hover:border-primary"
                >
                  {saving ? 'Adding...' : 'Add Account'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent>
          {accounts.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <IconBuildingBank size={32} className="text-muted-foreground" stroke={1.5} />
              <p className="text-sm text-muted-foreground">No accounts yet</p>
              <button
                onClick={() => setShowForm(true)}
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
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead className="text-right">Change</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.name}</TableCell>
                    <TableCell>{a.institution || '\u2014'}</TableCell>
                    <TableCell className="capitalize">{a.account_type}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      {fmt(a.balance ?? 0)}
                    </TableCell>
                    <TableCell className="text-right">
                      <ChangeCell value={a.change_pct ?? 0} />
                    </TableCell>
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
