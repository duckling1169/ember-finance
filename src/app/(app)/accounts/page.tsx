'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createAccount } from '@/lib/api';
import { useAccounts, mutateAccounts } from '@/lib/swr';
import { devBypass, enrichAccounts } from '@/lib/mock-data';
import type { EnrichedAccount, AccountType, TaxBucket } from '@shared/types';
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
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { IconPlus, IconX, IconBuildingBank, IconPlugConnected } from '@tabler/icons-react';
import { ACCOUNT_TYPES } from '@shared/types';
import { fmt, timeAgo } from '@/lib/formatters';
import { TAX_BUCKET_OPTIONS } from '@/lib/constants';
import { SortIcon, type SortDir } from '@/components/common/sort-icon';

type AccountData = EnrichedAccount;

type SortKey = 'name' | 'institution' | 'account_type' | 'linked' | 'balance' | 'last_synced';

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

export default function AccountsPage() {
  return <AccountsContent />;
}

function AccountsContent() {
  const router = useRouter();
  const {
    data: apiAccounts,
    isLoading: swrLoading,
    householdId,
    error: fetchError,
  } = useAccounts();
  const [mockAccts, setMockAccts] = useState<AccountData[]>(devBypass ? enrichAccounts() : []);
  const accounts: AccountData[] = devBypass ? mockAccts : (apiAccounts ?? []);
  const loading = !devBypass && swrLoading;

  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('last_synced');
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
        household_id: 'mock-household',
        member_id: null,
        name: form.get('name') as string,
        institution: (form.get('institution') as string) || null,
        account_type: form.get('account_type') as AccountType,
        currency: 'USD',
        meta: {
          tax_bucket: form.get('tax_bucket') as string,
        },
        is_active: true,
        is_liability: ['credit', 'loan', 'mortgage'].includes(form.get('account_type') as string),
        include_in_fi_portfolio: ['brokerage', 'retirement', 'hsa'].includes(
          form.get('account_type') as string,
        ),
        created_at: new Date().toISOString(),
        balance: 0,
        balance_date: null,
        linked: false,
        last_synced: null,
        tax_bucket: (form.get('tax_bucket') as TaxBucket) ?? 'after_tax',
      };
      setMockAccts((prev) => [...prev, newAccount]);
      setShowForm(false);
      setSaving(false);
      return;
    }

    try {
      await createAccount(householdId, {
        name: form.get('name') as string,
        institution: (form.get('institution') as string) || undefined,
        account_type: form.get('account_type') as AccountType,
        meta: { tax_bucket: form.get('tax_bucket') as string },
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
    return <div className="py-10 text-center text-muted-foreground">Loading...</div>;
  }

  if (!devBypass && fetchError) {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold">Accounts</h1>
        <Alert variant="error">
          Failed to load accounts. {fetchError.message || 'Please try again later.'}
        </Alert>
      </div>
    );
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
            <Button variant="primary-outline" onClick={() => setShowForm(true)}>
              <IconPlus size={16} />
              Add Account
            </Button>
          )}
        </div>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

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
                  <Select name="account_type" required className="capitalize">
                    {ACCOUNT_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t.charAt(0).toUpperCase() + t.slice(1).replace('_', ' ')}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Tax Bucket</label>
                  <Select name="tax_bucket" required>
                    {TAX_BUCKET_OPTIONS.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
              <div className="flex justify-end">
                <Button type="submit" variant="primary-outline" disabled={saving}>
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
  { key: 'last_synced', label: 'Last Synced', align: 'right' },
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
      case 'last_synced':
        aVal = a.last_synced || '';
        bVal = b.last_synced || '';
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
              {a.last_synced ? timeAgo(a.last_synced) : '\u2014'}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
