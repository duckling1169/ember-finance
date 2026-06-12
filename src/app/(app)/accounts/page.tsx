'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createAccount } from '@/lib/api';
import { useAccounts, mutateAccounts } from '@/lib/swr';
import type { EnrichedAccount, AccountType, TaxTreatment } from '@shared/types';
import { Card, CardContent } from '@/components/ui/card';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { FormField } from '@/components/ui/form-field';
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useToast } from '@/components/ui/toast';
import { IconPlus, IconBuildingBank, IconPlugConnected } from '@tabler/icons-react';
import { ACCOUNT_TYPES } from '@shared/types';
import { fmt, timeAgo } from '@/lib/formatters';
import { TAX_TREATMENT_OPTIONS } from '@/lib/constants';

type AccountData = EnrichedAccount;

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

const accountColumns: DataTableColumn<AccountData>[] = [
  {
    key: 'name',
    header: 'Name',
    priority: 1,
    sortValue: (a) => a.name.toLowerCase(),
    cell: (a) => a.name,
    cellClassName: 'font-medium',
  },
  {
    key: 'institution',
    header: 'Institution',
    priority: 2,
    sortValue: (a) => (a.institution || '').toLowerCase(),
    cell: (a) => a.institution || '—',
  },
  {
    key: 'account_type',
    header: 'Type',
    priority: 3,
    sortValue: (a) => a.account_type,
    cell: (a) => a.account_type,
    cellClassName: 'capitalize',
  },
  {
    key: 'linked',
    header: 'Status',
    priority: 1,
    sortValue: (a) => (a.linked ? 1 : 0),
    cell: (a) => <LinkedBadge linked={a.linked} />,
  },
  {
    key: 'balance',
    header: 'Balance',
    priority: 1,
    numeric: true,
    sortValue: (a) => a.balance ?? 0,
    cell: (a) => fmt(a.balance ?? 0),
  },
  {
    key: 'last_synced',
    header: 'Last Synced',
    priority: 3,
    align: 'right',
    sortValue: (a) => a.last_synced || '',
    cell: (a) => (a.last_synced ? timeAgo(a.last_synced) : '—'),
    cellClassName: 'text-muted-foreground text-xs',
  },
];

interface FieldErrors {
  name?: string;
  account_type?: string;
  tax_treatment?: string;
}

export default function AccountsPage() {
  return <AccountsContent />;
}

function AccountsContent() {
  const router = useRouter();
  const toast = useToast();
  const {
    data: apiAccounts,
    isLoading: swrLoading,
    householdId,
    error: fetchError,
  } = useAccounts();
  const accounts: AccountData[] = apiAccounts ?? [];
  const loading = swrLoading;

  const [sheetOpen, setSheetOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [name, setName] = useState('');
  const [institution, setInstitution] = useState('');
  const [accountType, setAccountType] = useState('');
  const [taxTreatment, setTaxTreatment] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  function openSheet() {
    setName('');
    setInstitution('');
    setAccountType('');
    setTaxTreatment('');
    setFieldErrors({});
    setSubmitError('');
    setSheetOpen(true);
  }

  function setFieldError(field: keyof FieldErrors, message: string | undefined) {
    setFieldErrors((prev) => ({ ...prev, [field]: message }));
  }

  function validateAll(): FieldErrors {
    return {
      name: name.trim() ? undefined : 'Account name is required',
      account_type: accountType ? undefined : 'Type is required',
      tax_treatment: taxTreatment ? undefined : 'Tax treatment is required',
    };
  }

  async function handleAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!householdId) return;
    const errors = validateAll();
    setFieldErrors(errors);
    if (errors.name || errors.account_type || errors.tax_treatment) return;
    setSaving(true);
    setSubmitError('');

    try {
      await createAccount(householdId, {
        name,
        institution: institution || undefined,
        account_type: accountType as AccountType,
        tax_treatment: (taxTreatment as TaxTreatment) || 'none',
      });
      toast('success', 'Account added');
      setSheetOpen(false);
      await mutateAccounts();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to add account');
    } finally {
      setSaving(false);
    }
  }

  if (fetchError) {
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
        <Button variant="primary" onClick={openSheet}>
          <IconPlus size={16} />
          Add Account
        </Button>
      </div>

      <Card>
        <CardContent>
          <DataTable
            columns={accountColumns}
            rows={accounts}
            rowKey={(a) => a.id}
            density="dense"
            mobile="priority"
            defaultSort={{ key: 'last_synced', dir: 'desc' }}
            loading={loading}
            empty={{
              icon: IconBuildingBank,
              title: 'No accounts yet',
              action: (
                <Button variant="secondary" onClick={openSheet}>
                  <IconPlus size={16} />
                  Add your first account
                </Button>
              ),
            }}
            onRowClick={(a) => router.push(`/accounts/view?id=${a.id}`)}
          />
        </CardContent>
      </Card>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Add account</SheetTitle>
          </SheetHeader>
          <form onSubmit={handleAdd} className="flex flex-1 flex-col gap-4 px-4 pb-4">
            {submitError && <Alert variant="error">{submitError}</Alert>}
            <FormField
              label="Account Name"
              htmlFor="account-name"
              required
              error={fieldErrors.name}
            >
              <Input
                id="account-name"
                name="name"
                placeholder="Fidelity 401(k)"
                value={name}
                aria-invalid={fieldErrors.name ? true : undefined}
                onChange={(e) => {
                  setName(e.target.value);
                  if (e.target.value.trim()) setFieldError('name', undefined);
                }}
                onBlur={() =>
                  setFieldError('name', name.trim() ? undefined : 'Account name is required')
                }
              />
            </FormField>
            <FormField label="Institution" htmlFor="account-institution">
              <Input
                id="account-institution"
                name="institution"
                placeholder="Fidelity, Chase, etc."
                value={institution}
                onChange={(e) => setInstitution(e.target.value)}
              />
            </FormField>
            <FormField
              label="Type"
              htmlFor="account-type"
              required
              error={fieldErrors.account_type}
            >
              <Select
                id="account-type"
                name="account_type"
                className="capitalize"
                value={accountType}
                aria-invalid={fieldErrors.account_type ? true : undefined}
                onChange={(e) => {
                  setAccountType(e.target.value);
                  if (e.target.value) setFieldError('account_type', undefined);
                }}
                onBlur={() =>
                  setFieldError('account_type', accountType ? undefined : 'Type is required')
                }
              >
                <option value="" disabled>
                  Select type
                </option>
                {ACCOUNT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t.charAt(0).toUpperCase() + t.slice(1).replace('_', ' ')}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField
              label="Tax Treatment"
              htmlFor="account-tax-treatment"
              required
              error={fieldErrors.tax_treatment}
            >
              <Select
                id="account-tax-treatment"
                name="tax_treatment"
                value={taxTreatment}
                aria-invalid={fieldErrors.tax_treatment ? true : undefined}
                onChange={(e) => {
                  setTaxTreatment(e.target.value);
                  if (e.target.value) setFieldError('tax_treatment', undefined);
                }}
                onBlur={() =>
                  setFieldError(
                    'tax_treatment',
                    taxTreatment ? undefined : 'Tax treatment is required',
                  )
                }
              >
                <option value="" disabled>
                  Select treatment
                </option>
                {TAX_TREATMENT_OPTIONS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </Select>
            </FormField>
            <div className="mt-auto flex items-center justify-end gap-2 pt-2">
              <SheetClose render={<Button variant="ghost" />} disabled={saving}>
                Cancel
              </SheetClose>
              <Button type="submit" variant="primary" disabled={saving}>
                {saving ? 'Adding…' : 'Add account'}
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}
