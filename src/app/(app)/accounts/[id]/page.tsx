'use client';

import { use, useState, useRef } from 'react';
import Link from 'next/link';
import {
  devBypass,
  enrichAccounts,
  mockAccountHistory,
  mockBalanceHistory,
  type AccountHistoryEvent,
} from '@/lib/mock-data';
import type { AccountDetailResponse } from '@shared/types';
import {
  useAccountDetail,
  useAccounts,
  useProfile,
  mutateAccountDetail,
  mutateAccounts,
} from '@/lib/swr';
import { AccountFlows } from './_components/account-flows';
import { ingestManual, ingestCsv } from '@/lib/api';
import { fmt, fmtDateTime } from '@/lib/formatters';
import { TAX_BUCKET_LABELS, API_PROVIDERS } from '@/lib/constants';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { BalanceChart } from '@/components/charts';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import {
  IconArrowLeft,
  IconPlugConnected,
  IconUpload,
  IconPlus,
  IconCheck,
  IconX,
  IconLink,
  IconLinkOff,
  IconRefresh,
  IconFileUpload,
  IconPencil,
  IconCirclePlus,
  IconPlayerPlay,
} from '@tabler/icons-react';

type Tab = 'overview' | 'history';

interface AccountView {
  id: string;
  name: string;
  institution: string | null;
  account_type: string;
  balance: number;
  linked: boolean;
  last_updated: string | null;
  tax_bucket: string;
  notes: string;
}

function mapApiDetail(
  id: string,
  detail: AccountDetailResponse,
): {
  account: AccountView;
  history: AccountHistoryEvent[];
  balanceHistory: { date: string; balance: number }[];
} {
  const {
    account: acct,
    balance: bal,
    sources,
    history: rawHistory,
    balance_history: rawBalHistory,
  } = detail;
  const meta = acct?.meta || {};

  const linked = sources.some((s) => API_PROVIDERS.includes(s.provider) && s.is_active);
  const lastSynced =
    sources
      .map((s) => s.last_synced)
      .filter(Boolean)
      .sort()
      .reverse()[0] || null;

  const account: AccountView = {
    id,
    name: acct?.name || '',
    institution: acct?.institution || null,
    account_type: acct?.account_type || 'other',
    balance: bal?.balance ?? 0,
    linked,
    last_updated: lastSynced,
    tax_bucket: (meta.tax_bucket as string) || 'none',
    notes: (meta.notes as string) || '',
  };

  const history: AccountHistoryEvent[] = rawHistory.map((h) => {
    const hDetail = h.detail || {};
    const eventType = h.event_type || 'account_created';
    return {
      id: h.id,
      date: h.created_at,
      type: eventType as AccountHistoryEvent['type'],
      description: (hDetail.description as string) || eventType.replace(/_/g, ' '),
      detail: hDetail.filename as string | undefined,
      balance_after: hDetail.balance_after as number | undefined,
      records: hDetail.records as number | undefined,
    };
  });

  const balanceHistory = rawBalHistory.map((b) => ({
    date: b.date,
    balance: b.balance,
  }));

  return { account, history, balanceHistory };
}

export default function AccountDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  const { householdId } = useAccounts();
  const { data: apiDetail, isLoading, error } = useAccountDetail(devBypass ? undefined : id);

  let account: AccountView | null = null;
  let history: AccountHistoryEvent[] = [];
  let balanceHistory: { date: string; balance: number }[] = [];

  if (devBypass) {
    const enriched = enrichAccounts().find((a) => a.id === id);
    if (enriched) {
      account = {
        id: enriched.id,
        name: enriched.name,
        institution: enriched.institution,
        account_type: enriched.account_type,
        balance: enriched.balance,
        linked: enriched.linked,
        last_updated: enriched.last_synced,
        tax_bucket: enriched.tax_bucket,
        notes: (enriched.meta?.notes as string) || '',
      };
      history = mockAccountHistory[id] || [];
      balanceHistory = mockBalanceHistory[id] || [];
    }
  } else if (apiDetail) {
    const mapped = mapApiDetail(id, apiDetail);
    account = mapped.account;
    history = mapped.history;
    balanceHistory = mapped.balanceHistory;
  }

  if (!devBypass && isLoading) {
    return <div className="py-10 text-muted-foreground">Loading...</div>;
  }

  if (!devBypass && error) {
    return (
      <div className="space-y-3">
        <Link
          href="/accounts"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <IconArrowLeft size={16} />
          Back to Accounts
        </Link>
        <Alert variant="error">
          Failed to load account. {error.message || 'Please try again later.'}
        </Alert>
      </div>
    );
  }

  if (!account) {
    return (
      <div className="space-y-3">
        <Link
          href="/accounts"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <IconArrowLeft size={16} />
          Back to Accounts
        </Link>
        <p className="text-muted-foreground">Account not found.</p>
      </div>
    );
  }

  const linkConfig = account.linked
    ? { icon: IconPlugConnected, label: 'Linked', className: 'text-gain' }
    : { icon: IconLinkOff, label: 'Not Linked', className: 'text-muted-foreground' };

  const LinkIcon = linkConfig.icon;

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'history', label: 'History', count: history.length },
  ];

  return (
    <div className="space-y-3">
      {/* Back link */}
      <Link
        href="/accounts"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <IconArrowLeft size={16} />
        Accounts
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{account.name}</h1>
          <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
            {account.institution && <span>{account.institution}</span>}
            <span className="capitalize">{account.account_type}</span>
            {account.tax_bucket && account.tax_bucket !== 'none' && (
              <>
                <span>&middot;</span>
                <span>{TAX_BUCKET_LABELS[account.tax_bucket] || account.tax_bucket}</span>
              </>
            )}
          </div>
        </div>
        <div className="text-right">
          <p className="text-2xl font-semibold font-mono tabular-nums">{fmt(account.balance)}</p>
          <div className="mt-1 flex items-center justify-end gap-2 text-sm">
            <span className={`inline-flex items-center gap-1 ${linkConfig.className}`}>
              <LinkIcon size={14} />
              {linkConfig.label}
            </span>
            {account.last_updated && (
              <>
                <span className="text-muted-foreground">&middot;</span>
                <span className="text-muted-foreground">{fmtDateTime(account.last_updated)}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab.key
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span className="ml-1.5 text-xs text-muted-foreground">({tab.count})</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'overview' && (
        <OverviewTab account={account} balanceHistory={balanceHistory} accountId={id} />
      )}
      {activeTab === 'history' && (
        <HistoryTab history={history} accountId={id} householdId={householdId} />
      )}
    </div>
  );
}

// -- Overview Tab --

function OverviewTab({
  account,
  balanceHistory,
  accountId,
}: {
  account: AccountView;
  balanceHistory: { date: string; balance: number }[];
  accountId: string;
}) {
  const { data: profile } = useProfile();

  return (
    <div className="space-y-3">
      {/* Balance over time chart */}
      {balanceHistory.length > 1 && (
        <Card size="sm">
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">Balance Over Time</p>
            <BalanceChart data={balanceHistory} />
          </CardContent>
        </Card>
      )}

      {/* Flows into/out of this account */}
      <AccountFlows
        accountId={accountId}
        taxTreatment={account.tax_bucket}
        memberId={profile?.id}
      />

      {/* Account details */}
      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
            <div>
              <dt className="text-muted-foreground">Institution</dt>
              <dd className="font-medium">{account.institution || '\u2014'}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Type</dt>
              <dd className="font-medium capitalize">{account.account_type}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Tax Bucket</dt>
              <dd className="font-medium">
                {TAX_BUCKET_LABELS[account.tax_bucket] || account.tax_bucket}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Linked</dt>
              <dd className="font-medium">{account.linked ? 'Yes' : 'No'}</dd>
            </div>
            {account.notes && (
              <div className="col-span-2">
                <dt className="text-muted-foreground">Notes</dt>
                <dd className="font-medium">{account.notes}</dd>
              </div>
            )}
          </dl>
        </CardContent>
      </Card>

      {/* Connection management */}
      <Card>
        <CardHeader>
          <CardTitle>Connection</CardTitle>
        </CardHeader>
        <CardContent>
          {account.linked ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gain/10">
                  <IconPlugConnected size={20} className="text-gain" />
                </div>
                <div>
                  <p className="text-sm font-medium">Connected via API</p>
                  <p className="text-xs text-muted-foreground">
                    Last synced {account.last_updated ? fmtDateTime(account.last_updated) : 'never'}
                  </p>
                </div>
              </div>
              <Button variant="outline" size="sm">
                <IconLinkOff size={14} />
                Disconnect
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                  <IconLink size={20} className="text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium">Not linked</p>
                  <p className="text-xs text-muted-foreground">
                    Connect to automatically sync balances and transactions
                  </p>
                </div>
              </div>
              <Button variant="primary-outline" size="sm">
                <IconLink size={14} />
                Link Account
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// -- History Tab --

const EVENT_CONFIG: Record<
  AccountHistoryEvent['type'],
  { icon: typeof IconRefresh; label: string; className: string }
> = {
  api_sync: { icon: IconRefresh, label: 'API Sync', className: 'text-gain bg-gain/10' },
  file_import: {
    icon: IconFileUpload,
    label: 'File Import',
    className: 'text-chart-2 bg-chart-2/10',
  },
  manual_override: {
    icon: IconPencil,
    label: 'Manual Override',
    className: 'text-chart-4 bg-chart-4/10',
  },
  manual_delta: {
    icon: IconCirclePlus,
    label: 'Manual Delta',
    className: 'text-chart-3 bg-chart-3/10',
  },
  link_connected: { icon: IconLink, label: 'Linked', className: 'text-gain bg-gain/10' },
  link_disconnected: {
    icon: IconLinkOff,
    label: 'Unlinked',
    className: 'text-destructive bg-destructive/10',
  },
  account_created: {
    icon: IconPlayerPlay,
    label: 'Created',
    className: 'text-muted-foreground bg-muted',
  },
};

function HistoryTab({
  history: initialHistory,
  accountId,
  householdId,
}: {
  history: AccountHistoryEvent[];
  accountId: string;
  householdId: string | undefined;
}) {
  const [history, setHistory] = useState(initialHistory);
  const [showManualForm, setShowManualForm] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  async function handleManualEntry(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const entryType = form.get('entry_type') as 'current' | 'delta';
    const amount = parseFloat(form.get('amount') as string);
    const description = form.get('description') as string;
    const today = new Date().toISOString().slice(0, 10);

    if (!devBypass && householdId) {
      try {
        setSubmitting(true);
        setFormError('');
        const payload =
          entryType === 'current'
            ? { balances: [{ date: today, balance: amount }] }
            : {
                transactions: [
                  {
                    date: today,
                    amount,
                    description: description || 'Manual entry',
                    category: 'manual_adjustment',
                  },
                ],
              };
        await ingestManual(householdId, accountId, payload);
        await Promise.all([mutateAccountDetail(accountId), mutateAccounts()]);
        setShowManualForm(false);
      } catch (err) {
        setFormError(err instanceof Error ? err.message : 'Manual entry failed');
      } finally {
        setSubmitting(false);
      }
      return;
    }

    const newEvent: AccountHistoryEvent = {
      id: `h-${Date.now()}`,
      date: new Date().toISOString(),
      type: entryType === 'current' ? 'manual_override' : 'manual_delta',
      description:
        entryType === 'current'
          ? `Balance set to ${fmt(amount)}`
          : description || (amount >= 0 ? 'Deposit' : 'Withdrawal'),
      detail: entryType === 'delta' ? `${amount >= 0 ? '+' : ''}${fmt(amount)}` : undefined,
      balance_after: entryType === 'current' ? amount : undefined,
    };
    setHistory((prev) => [newEvent, ...prev]);
    setShowManualForm(false);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFileDrop(file);
  }

  async function handleFileDrop(file: File) {
    if (!devBypass && householdId) {
      try {
        setSubmitting(true);
        setFormError('');
        await ingestCsv(householdId, accountId, file);
        await Promise.all([mutateAccountDetail(accountId), mutateAccounts()]);
        setShowUpload(false);
      } catch (err) {
        setFormError(err instanceof Error ? err.message : 'File upload failed');
      } finally {
        setSubmitting(false);
      }
      return;
    }

    const newEvent: AccountHistoryEvent = {
      id: `h-${Date.now()}`,
      date: new Date().toISOString(),
      type: 'file_import',
      description: `Uploaded ${file.name}`,
      detail: file.name,
      records: 0,
    };
    setHistory((prev) => [newEvent, ...prev]);
    setShowUpload(false);
  }

  return (
    <div className="space-y-3">
      {formError && <Alert variant="error">{formError}</Alert>}

      {/* Action buttons */}
      <div className="flex justify-end gap-2">
        {showManualForm || showUpload ? (
          <Button
            variant="ghost"
            onClick={() => {
              setShowManualForm(false);
              setShowUpload(false);
              setFormError('');
            }}
          >
            <IconX size={16} />
            Cancel
          </Button>
        ) : (
          <>
            <Button
              variant="primary-outline"
              onClick={() => {
                setShowUpload(true);
                setShowManualForm(false);
              }}
            >
              <IconUpload size={16} />
              Upload File
            </Button>
            <Button
              variant="primary-outline"
              onClick={() => {
                setShowManualForm(true);
                setShowUpload(false);
              }}
            >
              <IconPlus size={16} />
              Manual Entry
            </Button>
          </>
        )}
      </div>

      {/* Upload zone */}
      {showUpload && (
        <Card>
          <CardContent>
            <div
              className={`flex flex-col items-center gap-3 rounded-lg border-2 border-dashed py-8 transition-colors ${
                dragOver ? 'border-primary bg-primary/5' : 'border-border'
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                const file = e.dataTransfer.files[0];
                if (file) handleFileDrop(file);
              }}
            >
              <IconUpload size={28} className="text-muted-foreground" stroke={1.5} />
              <div className="text-center">
                <p className="text-sm font-medium">Drop a CSV or PDF here</p>
                <p className="text-xs text-muted-foreground mt-1">or click to browse</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={submitting}
                onClick={() => fileInputRef.current?.click()}
              >
                {submitting ? 'Uploading...' : 'Choose File'}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.pdf"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Manual entry form */}
      {showManualForm && (
        <Card>
          <CardContent>
            <form onSubmit={handleManualEntry} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Type</label>
                  <Select name="entry_type" required>
                    <option value="current">Current Balance (override)</option>
                    <option value="delta">Delta (add/subtract)</option>
                  </Select>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Amount</label>
                  <Input name="amount" type="number" step="0.01" required placeholder="50000.00" />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Description (optional)</label>
                <Input name="description" placeholder="Deposit, adjustment, etc." />
              </div>
              <div className="flex justify-end">
                <Button type="submit" variant="primary-outline" disabled={submitting}>
                  <IconCheck size={16} />
                  {submitting ? 'Saving...' : 'Save Entry'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Timeline */}
      <Card>
        <CardHeader>
          <CardTitle>Account History</CardTitle>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No history yet</p>
          ) : (
            <div className="space-y-0">
              {history.map((event, i) => {
                const config = EVENT_CONFIG[event.type] || EVENT_CONFIG.account_created;
                const Icon = config.icon;
                const isLast = i === history.length - 1;

                return (
                  <div key={event.id} className="flex gap-4">
                    {/* Timeline line + dot */}
                    <div className="flex flex-col items-center">
                      <div
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${config.className}`}
                      >
                        <Icon size={14} />
                      </div>
                      {!isLast && <div className="w-px flex-1 bg-border" />}
                    </div>

                    {/* Content */}
                    <div className="flex-1 pb-6">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm font-medium">{event.description}</p>
                          <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                            <span>{fmtDateTime(event.date)}</span>
                            {event.records !== undefined && event.records > 0 && (
                              <>
                                <span>&middot;</span>
                                <span>{event.records} records</span>
                              </>
                            )}
                          </div>
                        </div>
                        {event.balance_after !== undefined && (
                          <span className="text-sm font-mono tabular-nums font-medium">
                            {fmt(event.balance_after)}
                          </span>
                        )}
                        {event.detail && event.balance_after === undefined && (
                          <span className="text-sm font-mono tabular-nums text-muted-foreground">
                            {event.detail}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
