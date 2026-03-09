'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { RequireAuth } from '@/lib/require-auth';
import {
  getHousehold,
  getProfile,
  getAccounts,
  createAccount,
  ingestManual,
  ingestCsv,
} from '@/lib/api';

interface HouseholdData {
  id: string;
  name: string;
  [key: string]: unknown;
}

interface AccountData {
  id: string;
  name: string;
  institution: string | null;
  account_type: string;
  is_liability: boolean;
  [key: string]: unknown;
}

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

const BANKING_TYPES = ['checking', 'savings', 'credit'];
const INVESTMENT_TYPES = ['brokerage', 'retirement', 'hsa'];

const CSV_FORMATS_BANKING = [
  { value: 'chase_checking', label: 'Chase Checking' },
  { value: 'chase_credit', label: 'Chase Credit Card' },
  { value: 'generic_banking', label: 'Generic (Date, Description, Amount)' },
];

const CSV_FORMATS_BROKERAGE = [
  { value: 'fidelity_transactions', label: 'Fidelity — Transactions' },
  { value: 'fidelity_positions', label: 'Fidelity — Positions' },
  { value: 'vanguard_transactions', label: 'Vanguard — Transactions' },
  { value: 'vanguard_positions', label: 'Vanguard — Positions' },
  { value: 'schwab_transactions', label: 'Schwab — Transactions' },
  { value: 'schwab_positions', label: 'Schwab — Positions' },
  { value: 'generic_brokerage', label: 'Generic Brokerage' },
];

const btnStyle = {
  padding: '4px 8px',
  background: 'none',
  border: '1px solid #ccc',
  borderRadius: 4,
  cursor: 'pointer',
  fontSize: 13,
};

export default function DashboardPage() {
  return (
    <RequireAuth>
      <DashboardContent />
    </RequireAuth>
  );
}

function DashboardContent() {
  const router = useRouter();
  const { user } = useAuth();
  const [household, setHousehold] = useState<HouseholdData | null>(null);
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null);
  const [accounts, setAccounts] = useState<AccountData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Add account
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [addingAccount, setAddingAccount] = useState(false);

  // Add transaction
  const [txAccountId, setTxAccountId] = useState('');
  const [showAddTx, setShowAddTx] = useState(false);
  const [addingTx, setAddingTx] = useState(false);

  // CSV upload
  const [csvAccountId, setCsvAccountId] = useState('');
  const [csvAccountType, setCsvAccountType] = useState('');
  const [showCsvUpload, setShowCsvUpload] = useState(false);
  const [uploadingCsv, setUploadingCsv] = useState(false);
  const [showFormatPicker, setShowFormatPicker] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadData = useCallback(async () => {
    try {
      const [h, p] = await Promise.all([getHousehold(), getProfile()]);
      setHousehold(h as HouseholdData);
      setProfile(p);
      const accts = await getAccounts((h as HouseholdData).id);
      setAccounts(accts as AccountData[]);
    } catch {
      setHousehold(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleAddAccount(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setAddingAccount(true);
    setError('');
    const form = new FormData(e.currentTarget);
    try {
      await createAccount(household!.id, {
        name: form.get('name'),
        institution: form.get('institution') || undefined,
        account_type: form.get('account_type'),
      });
      setShowAddAccount(false);
      const accts = await getAccounts(household!.id);
      setAccounts(accts as AccountData[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add account');
    } finally {
      setAddingAccount(false);
    }
  }

  async function handleAddTransaction(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setAddingTx(true);
    setError('');
    const form = new FormData(e.currentTarget);
    try {
      await ingestManual(household!.id, txAccountId, {
        transactions: [
          {
            date: form.get('date'),
            amount: Number(form.get('amount')),
            description: form.get('description'),
            category: form.get('category') || undefined,
          },
        ],
      });
      setShowAddTx(false);
      setSuccess('Transaction added.');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add transaction');
    } finally {
      setAddingTx(false);
    }
  }

  async function handleCsvUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setUploadingCsv(true);
    setError('');
    const form = new FormData(e.currentTarget);
    const file = form.get('file') as File;
    const format = (form.get('format') as string) || undefined;

    if (!file || file.size === 0) {
      setError('Please select a file');
      setUploadingCsv(false);
      return;
    }

    try {
      const result = (await ingestCsv(household!.id, csvAccountId, file, format)) as Record<
        string,
        unknown
      >;
      setShowCsvUpload(false);
      if (fileRef.current) fileRef.current.value = '';
      setSuccess(`Imported ${result.recordCount} records.`);
      setTimeout(() => setSuccess(''), 5000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'CSV upload failed';
      if (msg.includes('auto-detect')) {
        setError(msg + ' Use the format dropdown below.');
        setShowFormatPicker(true);
      } else {
        setError(msg);
      }
    } finally {
      setUploadingCsv(false);
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.replace('/login');
  }

  if (loading) return <div style={{ padding: 40 }}>Loading...</div>;

  const inputStyle = {
    width: '100%',
    padding: 8,
    border: '1px solid #ccc',
    borderRadius: 4,
    boxSizing: 'border-box' as const,
  };

  if (!household) {
    return (
      <div style={{ maxWidth: 800, margin: '0 auto', padding: 20 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 32,
          }}
        >
          <h1 style={{ fontSize: 24, margin: 0 }}>FIRE App</h1>
          <button
            onClick={handleSignOut}
            style={{
              padding: '8px 16px',
              background: 'none',
              border: '1px solid #ccc',
              borderRadius: 4,
              cursor: 'pointer',
            }}
          >
            Sign Out
          </button>
        </div>
        <p>No household set up yet.</p>
        <a href="/onboarding" style={{ color: '#0070f3' }}>
          Set up your household
        </a>
      </div>
    );
  }

  function getCsvFormats(accountType: string) {
    if (BANKING_TYPES.includes(accountType)) return CSV_FORMATS_BANKING;
    if (INVESTMENT_TYPES.includes(accountType)) return CSV_FORMATS_BROKERAGE;
    return [...CSV_FORMATS_BANKING, ...CSV_FORMATS_BROKERAGE];
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: 20 }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 32,
        }}
      >
        <div>
          <h1 style={{ fontSize: 24, margin: 0 }}>{household?.name}</h1>
          <p style={{ color: '#666', margin: 0 }}>
            Welcome, {(profile?.display_name as string) || 'User'}
          </p>
        </div>
        <button
          onClick={handleSignOut}
          style={{
            padding: '8px 16px',
            background: 'none',
            border: '1px solid #ccc',
            borderRadius: 4,
            cursor: 'pointer',
          }}
        >
          Sign Out
        </button>
      </div>

      {error && (
        <p
          style={{
            color: 'red',
            marginBottom: 16,
            padding: 8,
            background: '#fee',
            borderRadius: 4,
          }}
        >
          {error}
        </p>
      )}
      {success && (
        <p
          style={{
            color: 'green',
            marginBottom: 16,
            padding: 8,
            background: '#efe',
            borderRadius: 4,
          }}
        >
          {success}
        </p>
      )}

      {/* Accounts */}
      <section style={{ marginBottom: 32 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 12,
          }}
        >
          <h2 style={{ fontSize: 18, margin: 0 }}>Accounts</h2>
          <button
            onClick={() => setShowAddAccount(!showAddAccount)}
            style={{
              padding: '6px 12px',
              background: '#000',
              color: '#fff',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
            }}
          >
            {showAddAccount ? 'Cancel' : '+ Add Account'}
          </button>
        </div>

        {showAddAccount && (
          <form
            onSubmit={handleAddAccount}
            style={{
              padding: 16,
              border: '1px solid #ddd',
              borderRadius: 4,
              marginBottom: 16,
            }}
          >
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', marginBottom: 4 }}>Account Name *</label>
              <input name="name" required placeholder="Chase Checking" style={inputStyle} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', marginBottom: 4 }}>Institution</label>
              <input name="institution" placeholder="Chase" style={inputStyle} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', marginBottom: 4 }}>Type *</label>
              <select name="account_type" required style={inputStyle}>
                {ACCOUNT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t.replace('_', ' ')}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              disabled={addingAccount}
              style={{
                padding: '8px 16px',
                background: '#000',
                color: '#fff',
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer',
              }}
            >
              {addingAccount ? 'Adding...' : 'Add Account'}
            </button>
          </form>
        )}

        {accounts.length === 0 ? (
          <p style={{ color: '#999' }}>No accounts yet. Add one to get started.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #eee', textAlign: 'left' }}>
                <th style={{ padding: 8 }}>Name</th>
                <th style={{ padding: 8 }}>Institution</th>
                <th style={{ padding: 8 }}>Type</th>
                <th style={{ padding: 8 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((a) => (
                <tr key={a.id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: 8 }}>{a.name}</td>
                  <td style={{ padding: 8 }}>{a.institution || '—'}</td>
                  <td style={{ padding: 8 }}>{a.account_type}</td>
                  <td style={{ padding: 8, display: 'flex', gap: 6 }}>
                    <button
                      onClick={() => {
                        setTxAccountId(a.id);
                        setShowAddTx(true);
                        setShowCsvUpload(false);
                      }}
                      style={btnStyle}
                    >
                      + Transaction
                    </button>
                    <button
                      onClick={() => {
                        setCsvAccountId(a.id);
                        setCsvAccountType(a.account_type);
                        setShowCsvUpload(true);
                        setShowAddTx(false);
                        setShowFormatPicker(false);
                      }}
                      style={btnStyle}
                    >
                      Upload CSV
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Add Transaction */}
      {showAddTx && (
        <section
          style={{
            padding: 16,
            border: '1px solid #ddd',
            borderRadius: 4,
            marginBottom: 32,
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 12,
            }}
          >
            <h3 style={{ margin: 0 }}>
              Add Transaction — {accounts.find((a) => a.id === txAccountId)?.name}
            </h3>
            <button
              onClick={() => setShowAddTx(false)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18 }}
            >
              x
            </button>
          </div>

          <form onSubmit={handleAddTransaction}>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', marginBottom: 4 }}>Date *</label>
              <input name="date" type="date" required style={inputStyle} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', marginBottom: 4 }}>
                Amount * (positive = income, negative = expense)
              </label>
              <input
                name="amount"
                type="number"
                step="0.01"
                required
                placeholder="-25.00"
                style={inputStyle}
              />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', marginBottom: 4 }}>Description *</label>
              <input name="description" required placeholder="Grocery store" style={inputStyle} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', marginBottom: 4 }}>Category</label>
              <input name="category" placeholder="Groceries" style={inputStyle} />
            </div>
            <button
              type="submit"
              disabled={addingTx}
              style={{
                padding: '8px 16px',
                background: '#000',
                color: '#fff',
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer',
              }}
            >
              {addingTx ? 'Saving...' : 'Add Transaction'}
            </button>
          </form>
        </section>
      )}

      {/* CSV Upload */}
      {showCsvUpload && (
        <section
          style={{
            padding: 16,
            border: '1px solid #ddd',
            borderRadius: 4,
            marginBottom: 32,
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 12,
            }}
          >
            <h3 style={{ margin: 0 }}>
              Upload CSV — {accounts.find((a) => a.id === csvAccountId)?.name}
            </h3>
            <button
              onClick={() => setShowCsvUpload(false)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18 }}
            >
              x
            </button>
          </div>

          <form onSubmit={handleCsvUpload}>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', marginBottom: 4 }}>CSV File *</label>
              <input
                name="file"
                type="file"
                accept=".csv"
                required
                ref={fileRef}
                style={inputStyle}
              />
              <p style={{ color: '#999', fontSize: 13, margin: '4px 0 0' }}>
                Format is auto-detected from headers (Chase, Fidelity, Vanguard, Schwab, generic).
              </p>
            </div>
            {showFormatPicker && (
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', marginBottom: 4 }}>
                  Format (auto-detect failed)
                </label>
                <select name="format" style={inputStyle}>
                  <option value="">Auto-detect</option>
                  {getCsvFormats(csvAccountType).map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <button
              type="submit"
              disabled={uploadingCsv}
              style={{
                padding: '8px 16px',
                background: '#000',
                color: '#fff',
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer',
              }}
            >
              {uploadingCsv ? 'Uploading...' : 'Upload & Import'}
            </button>
          </form>
        </section>
      )}
    </div>
  );
}
