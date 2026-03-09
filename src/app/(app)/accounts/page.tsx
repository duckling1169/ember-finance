'use client';

import { useState, useEffect, useCallback } from 'react';
import { getHousehold, getAccounts, createAccount } from '@/lib/api';
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
import { IconPlus, IconBuildingBank } from '@tabler/icons-react';

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
  [key: string]: unknown;
}

export default function AccountsPage() {
  return <AccountsContent />;
}

function AccountsContent() {
  const [householdId, setHouseholdId] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<AccountData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadData = useCallback(async () => {
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
    try {
      await createAccount(householdId, {
        name: form.get('name'),
        institution: form.get('institution') || undefined,
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
        <Button onClick={() => setShowForm(!showForm)}>
          <IconPlus size={16} data-icon="inline-start" />
          {showForm ? 'Cancel' : 'Add Account'}
        </Button>
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
                <Input name="name" required placeholder="Chase Checking" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Institution</label>
                <Input name="institution" placeholder="Chase" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Type</label>
                <select
                  name="account_type"
                  required
                  className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
                >
                  {ACCOUNT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t.replace('_', ' ')}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end">
                <Button type="submit" disabled={saving}>
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
                className="text-sm text-primary hover:underline"
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.name}</TableCell>
                    <TableCell>{a.institution || '\u2014'}</TableCell>
                    <TableCell className="capitalize">{a.account_type}</TableCell>
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
