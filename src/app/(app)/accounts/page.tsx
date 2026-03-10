'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createAccount } from '@/lib/api';
import { useAccounts, mutateAccounts } from '@/lib/swr';
import { devBypass, enrichAccounts, type EnrichedAccount } from '@/lib/mock-data';
import { Card, CardContent } from '@/components/ui/card';
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
  IconLink,
  IconPlugConnected,
  IconArrowsSort,
  IconSortAscending,
  IconSortDescending,
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

const TAX_BUCKETS = [
  { value: 'taxable', label: 'Taxable' },
  { value: 'traditional', label: 'Traditional (pre-tax)' },
  { value: 'roth', label: 'Roth (after-tax)' },
  { value: 'hsa', label: 'HSA' },
  { value: 'none', label: 'N/A' },
];

type AccountData = EnrichedAccount;

type SortKey = 'name' | 'institution' | 'account_type' | 'linked' | 'balance' | 'last_updated';
type SortDir = 'asc' | 'desc';

function SortIcon({
  field,
  sortKey,
  sortDir,
}: {
  field: SortKey;
  sortKey: SortKey;
  sortDir: SortDir;
}) {
  if (sortKey !== field) return <IconArrowsSort size={14} className="text-muted-foreground/50" />;
  return sortDir === 'asc' ? <IconSortAscending size={14} /> : <IconSortDescending size={14} />;
}

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}

function LinkedBadge({ linked }: { linked?: boolean }) {
  if (linked) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium text-gain bg-gain/10">
        <IconPlugConnected size={12} />
        Linked
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium text-muted-foreground bg-muted">
      Not Linked
    </span>
  );
}

function timeAgo(dateStr: string) {
  const now = new Date();
  const then = new Date(dateStr);
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return then.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function AccountsPage() {
  return <AccountsContent />;
}

function AccountsContent() {
  const router = useRouter();
  const { data: apiAccounts, isLoading: swrLoading, householdId } = useAccounts();
  const [mockAccts, setMockAccts] = useState<AccountData[]>(devBypass ? enrichAccounts() : []);
  const accounts: AccountData[] = devBypass
    ? mockAccts
    : ((apiAccounts as unknown as AccountData[]) ?? []);
  const loading = !devBypass && swrLoading;

  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('last_updated');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(
        key === 'name' || key === 'institution' || key === 'account_type' ? 'asc' : 'desc',
      );
    }
  }

  async function handleAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!householdId) return;
    setSaving(true);
    setError('');
    const form = new FormData(e.currentTarget);

    if (devBypass) {
      const newAccount: AccountData = {
        id: `mock-${Date.now()}`,
        name: form.get('name') as string,
        institution: (form.get('institution') as string) || null,
        account_type: form.get('account_type') as string,
        currency: 'USD',
        meta: {
          tax_bucket: form.get('tax_bucket') as string,
          notes: '',
        },
        is_active: true,
        is_liability: ['credit', 'loan', 'mortgage'].includes(form.get('account_type') as string),
        created_at: new Date().toISOString(),
        balance: 0,
        linked: false,
        last_updated: new Date().toISOString(),
        tax_bucket: form.get('tax_bucket') as string,
        notes: '',
      };
      setMockAccts((prev) => [...prev, newAccount]);
      setShowForm(false);
      setSaving(false);
      return;
    }

    try {
      await createAccount(householdId, {
        name: form.get('name'),
        institution: form.get('institution'),
        account_type: form.get('account_type'),
        tax_bucket: form.get('tax_bucket'),
      });
      setShowForm(false);
      await mutateAccounts();
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
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Accounts</h1>
        <div className="flex items-center gap-2">
          {showForm ? (
            <Button variant="ghost" onClick={() => setShowForm(false)}>
              <IconX size={16} />
              Cancel
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                className="hover:bg-primary hover:text-primary-foreground hover:border-primary"
                onClick={() => {
                  /* TODO: Teller/Snap link flow */
                }}
              >
                <IconLink size={16} />
                Link Account
              </Button>
              <Button
                variant="outline"
                className="hover:bg-primary hover:text-primary-foreground hover:border-primary"
                onClick={() => setShowForm(true)}
              >
                <IconPlus size={16} />
                Add Manual
              </Button>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
      )}

      {showForm && (
        <Card>
          <CardContent>
            <form onSubmit={handleAdd} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Account Name</label>
                  <Input name="name" required placeholder="Fidelity 401(k)" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Institution</label>
                  <Input name="institution" placeholder="Fidelity, Chase, etc." />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Type</label>
                  <select
                    name="account_type"
                    required
                    className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm capitalize outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
                  >
                    {ACCOUNT_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t.charAt(0).toUpperCase() + t.slice(1).replace('_', ' ')}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Tax Bucket</label>
                  <select
                    name="tax_bucket"
                    required
                    className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
                  >
                    {TAX_BUCKETS.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
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
            <AccountsTable
              accounts={accounts}
              sortKey={sortKey}
              sortDir={sortDir}
              onSort={toggleSort}
              onRowClick={(id) => router.push(`/accounts/${id}`)}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Sortable Accounts Table ──

const columns: { key: SortKey; label: string; align?: 'right' }[] = [
  { key: 'name', label: 'Name' },
  { key: 'institution', label: 'Institution' },
  { key: 'account_type', label: 'Type' },
  { key: 'linked', label: 'Status' },
  { key: 'balance', label: 'Balance', align: 'right' },
  { key: 'last_updated', label: 'Updated', align: 'right' },
];

function AccountsTable({
  accounts,
  sortKey,
  sortDir,
  onSort,
  onRowClick,
}: {
  accounts: AccountData[];
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (key: SortKey) => void;
  onRowClick: (id: string) => void;
}) {
  const sorted = [...accounts].sort((a, b) => {
    let aVal: string | number | boolean | undefined;
    let bVal: string | number | boolean | undefined;

    switch (sortKey) {
      case 'name':
        aVal = a.name.toLowerCase();
        bVal = b.name.toLowerCase();
        break;
      case 'institution':
        aVal = (a.institution || '').toLowerCase();
        bVal = (b.institution || '').toLowerCase();
        break;
      case 'account_type':
        aVal = a.account_type;
        bVal = b.account_type;
        break;
      case 'linked':
        aVal = a.linked ? 1 : 0;
        bVal = b.linked ? 1 : 0;
        break;
      case 'balance':
        aVal = a.balance ?? 0;
        bVal = b.balance ?? 0;
        break;
      case 'last_updated':
        aVal = a.last_updated || '';
        bVal = b.last_updated || '';
        break;
    }

    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    }
    const aNum = Number(aVal);
    const bNum = Number(bVal);
    return sortDir === 'asc' ? aNum - bNum : bNum - aNum;
  });

  return (
    <Table>
      <TableHeader>
        <TableRow>
          {columns.map((col) => (
            <TableHead
              key={col.key}
              className={`cursor-pointer select-none hover:text-foreground transition-colors ${col.align === 'right' ? 'text-right' : ''}`}
              onClick={() => onSort(col.key)}
            >
              <span className="inline-flex items-center gap-1">
                {col.label}
                <SortIcon field={col.key} sortKey={sortKey} sortDir={sortDir} />
              </span>
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {sorted.map((a) => (
          <TableRow key={a.id} className="cursor-pointer" onClick={() => onRowClick(a.id)}>
            <TableCell className="font-medium">{a.name}</TableCell>
            <TableCell>{a.institution || '\u2014'}</TableCell>
            <TableCell className="capitalize">{a.account_type}</TableCell>
            <TableCell>
              <LinkedBadge linked={a.linked} />
            </TableCell>
            <TableCell className="text-right font-mono tabular-nums">
              {fmt(a.balance ?? 0)}
            </TableCell>
            <TableCell className="text-right text-muted-foreground text-xs">
              {a.last_updated ? timeAgo(a.last_updated) : '\u2014'}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
