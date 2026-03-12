'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { useTheme } from '@/lib/theme-context';
import { updateHousehold, updateProfile, removeMember, sendInvite, cancelInvite } from '@/lib/api';
import { fmt } from '@/lib/formatters';
import {
  useHousehold,
  useProfile,
  useMembers,
  useInvites,
  mutateHousehold,
  mutateProfile,
  mutateMembers,
  mutateInvites,
} from '@/lib/swr';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import {
  IconSun,
  IconMoon,
  IconDeviceDesktop,
  IconCheck,
  IconX,
  IconTrash,
  IconSend,
  IconLoader2,
  IconCrown,
  IconUser,
  IconExternalLink,
} from '@tabler/icons-react';

import type {
  Household,
  Member,
  MemberSummary,
  HouseholdInvite,
  TaxFilingStatus,
  EmploymentType,
  RiskTolerance,
  USState,
} from '@shared/types';

const TAX_FILING_OPTIONS: { value: TaxFilingStatus; label: string }[] = [
  { value: 'single', label: 'Single' },
  { value: 'married_jointly', label: 'Married Filing Jointly' },
  { value: 'married_separately', label: 'Married Filing Separately' },
  { value: 'head_of_household', label: 'Head of Household' },
];

const EMPLOYMENT_OPTIONS: { value: EmploymentType; label: string }[] = [
  { value: 'w2', label: 'W-2 Employee' },
  { value: '1099', label: '1099 Contractor' },
  { value: 'mixed', label: 'Mixed' },
];

const RISK_OPTIONS: { value: RiskTolerance; label: string }[] = [
  { value: 'conservative', label: 'Conservative' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'aggressive', label: 'Aggressive' },
];

const themeOptions = [
  { value: 'system' as const, label: 'System', icon: IconDeviceDesktop },
  { value: 'light' as const, label: 'Light', icon: IconSun },
  { value: 'dark' as const, label: 'Dark', icon: IconMoon },
];

function SelectField({
  label,
  value,
  onChange,
  options,
  placeholder = 'Select...',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium">{label}</label>
      <Select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>
    </div>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();

  const { data: hhData, isLoading: hhLoading } = useHousehold();
  const { data: profData, isLoading: profLoading } = useProfile();
  const { data: memsData, isLoading: memsLoading } = useMembers();
  const { data: invsData, isLoading: invsLoading } = useInvites();

  const household = hhData ?? null;
  const profile = profData ?? null;
  const members = memsData || [];
  const invites = (invsData || []) as HouseholdInvite[];
  const loading = hhLoading || profLoading || memsLoading || invsLoading;

  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Household form state
  const [hhName, setHhName] = useState('');
  const [hhTaxStatus, setHhTaxStatus] = useState('');
  const [hhState, setHhState] = useState('');
  const [hhInitialized, setHhInitialized] = useState(false);

  // Profile form state
  const [displayName, setDisplayName] = useState('');
  const [birthday, setBirthday] = useState('');
  const [retirementAge, setRetirementAge] = useState('');
  const [employmentType, setEmploymentType] = useState('');
  const [riskTolerance, setRiskTolerance] = useState('');
  const [profInitialized, setProfInitialized] = useState(false);

  const [inviteEmail, setInviteEmail] = useState('');

  const isOwner = profile?.role === 'owner';

  // Sync SWR data into form state once loaded
  if (household && !hhInitialized) {
    setHhName(household.name || '');
    setHhTaxStatus(household.tax_filing_status || '');
    setHhState(household.state || '');
    setHhInitialized(true);
  }
  if (profile && !profInitialized) {
    setDisplayName(profile.display_name || '');
    setBirthday(profile.birthday || '');
    setRetirementAge(profile.target_retirement_age?.toString() || '');
    setEmploymentType(profile.employment_type || '');
    setRiskTolerance(profile.risk_tolerance || '');
    setProfInitialized(true);
  }

  function flash(msg: string) {
    setSuccess(msg);
    setError('');
    setTimeout(() => setSuccess(''), 3000);
  }

  async function saveProfile() {
    setSaving('profile');
    setError('');
    try {
      await updateProfile({
        displayName,
        birthday: birthday || null,
        targetRetirementAge: retirementAge ? parseInt(retirementAge) : null,
        employmentType: (employmentType as EmploymentType) || null,
        riskTolerance: (riskTolerance as RiskTolerance) || null,
      });
      await mutateProfile();
      flash('Profile updated');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update');
    } finally {
      setSaving(null);
    }
  }

  async function saveHousehold() {
    setSaving('household');
    setError('');
    try {
      await updateHousehold({
        name: hhName,
        taxFilingStatus: (hhTaxStatus as TaxFilingStatus) || null,
        state: (hhState as USState) || null,
      });
      await mutateHousehold();
      flash('Household updated');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update');
    } finally {
      setSaving(null);
    }
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteEmail) return;
    setSaving('invite');
    setError('');
    try {
      await sendInvite({ email: inviteEmail, role: 'viewer' });
      setInviteEmail('');
      await mutateInvites();
      flash('Invite sent');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to send invite');
    } finally {
      setSaving(null);
    }
  }

  async function handleCancelInvite(id: string) {
    try {
      await cancelInvite(id);
      await mutateInvites();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to cancel invite');
    }
  }

  async function handleRemoveMember(id: string) {
    try {
      await removeMember(id);
      await mutateMembers();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to remove member');
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.replace('/login');
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <IconLoader2 size={20} className="animate-spin mr-2" />
        Loading...
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-semibold">Settings</h1>

      {error && <Alert variant="error">{error}</Alert>}
      {success && <Alert variant="success">{success}</Alert>}

      {/* Profile */}
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Your personal information</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium">Display Name</label>
              <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Email</label>
              <Input value={user?.email || ''} disabled className="opacity-60" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Birthday</label>
              <Input type="date" value={birthday} onChange={(e) => setBirthday(e.target.value)} />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Target Retirement Age</label>
              <Input
                type="number"
                value={retirementAge}
                onChange={(e) => setRetirementAge(e.target.value)}
                placeholder="55"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Annual Income</label>
              <div className="flex h-9 items-center justify-between rounded-md border border-input bg-muted/50 px-3 text-sm">
                <span className="font-mono tabular-nums">
                  {profile?.annual_income ? fmt(profile.annual_income) : '—'}
                </span>
                <Link
                  href="/flows"
                  className="text-xs text-muted-foreground hover:text-primary transition-colors inline-flex items-center gap-1"
                >
                  Edit in Flows
                  <IconExternalLink size={12} />
                </Link>
              </div>
            </div>
            <SelectField
              label="Employment Type"
              value={employmentType}
              onChange={setEmploymentType}
              options={EMPLOYMENT_OPTIONS}
            />
            <SelectField
              label="Risk Tolerance"
              value={riskTolerance}
              onChange={setRiskTolerance}
              options={RISK_OPTIONS}
            />
          </div>
          <div className="mt-4 flex justify-end">
            <Button variant="primary-outline" disabled={saving === 'profile'} onClick={saveProfile}>
              {saving === 'profile' ? (
                <IconLoader2 size={14} className="animate-spin" />
              ) : (
                <IconCheck size={14} />
              )}
              Save Profile
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Household — owner only */}
      {isOwner && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Household</CardTitle>
              <CardDescription>Shared household settings</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Household Name</label>
                  <Input value={hhName} onChange={(e) => setHhName(e.target.value)} />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">State</label>
                  <Input
                    value={hhState}
                    onChange={(e) => setHhState(e.target.value.toUpperCase())}
                    placeholder="CA"
                    maxLength={2}
                  />
                </div>
                <SelectField
                  label="Tax Filing Status"
                  value={hhTaxStatus}
                  onChange={setHhTaxStatus}
                  options={TAX_FILING_OPTIONS}
                />
              </div>
              <div className="mt-4 flex justify-end">
                <Button
                  variant="primary-outline"
                  disabled={saving === 'household'}
                  onClick={saveHousehold}
                >
                  {saving === 'household' ? (
                    <IconLoader2 size={14} className="animate-spin" />
                  ) : (
                    <IconCheck size={14} />
                  )}
                  Save Household
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Members */}
          <Card>
            <CardHeader>
              <CardTitle>Members</CardTitle>
              <CardDescription>People in your household</CardDescription>
            </CardHeader>
            <CardContent>
              {members.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">No members found</p>
              ) : (
                <div className="space-y-2">
                  {members.map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center justify-between rounded-md border border-border px-4 py-3"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                          {m.role === 'owner' ? (
                            <IconCrown size={14} className="text-primary" />
                          ) : (
                            <IconUser size={14} className="text-muted-foreground" />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{m.display_name}</p>
                          <p className="text-xs text-muted-foreground capitalize">{m.role}</p>
                        </div>
                      </div>
                      {m.role !== 'owner' && m.id !== profile?.id && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleRemoveMember(m.id)}
                        >
                          <IconTrash size={14} />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {invites.filter((i) => !i.accepted_at).length > 0 && (
                <div className="mt-4">
                  <p className="text-sm font-medium text-muted-foreground mb-2">Pending Invites</p>
                  <div className="space-y-2">
                    {invites
                      .filter((i) => !i.accepted_at)
                      .map((inv) => (
                        <div
                          key={inv.id}
                          className="flex items-center justify-between rounded-md border border-dashed border-border px-4 py-2"
                        >
                          <div>
                            <p className="text-sm">{inv.email}</p>
                            <p className="text-xs text-muted-foreground capitalize">{inv.role}</p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => handleCancelInvite(inv.id)}
                          >
                            <IconX size={14} />
                          </Button>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              <form onSubmit={handleInvite} className="mt-4 flex gap-2">
                <Input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="partner@email.com"
                  className="flex-1"
                />
                <Button
                  type="submit"
                  variant="primary-outline"
                  disabled={saving === 'invite' || !inviteEmail}
                >
                  {saving === 'invite' ? (
                    <IconLoader2 size={14} className="animate-spin" />
                  ) : (
                    <IconSend size={14} />
                  )}
                  Invite
                </Button>
              </form>
            </CardContent>
          </Card>
        </>
      )}

      {/* Appearance */}
      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>Choose your preferred theme</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            {themeOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setTheme(opt.value)}
                className={`flex items-center gap-2 rounded-md px-4 py-2.5 text-sm font-medium transition-colors ${
                  theme === opt.value
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:text-foreground'
                }`}
              >
                <opt.icon size={16} stroke={1.5} />
                {opt.label}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Sign out */}
      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" onClick={handleSignOut}>
            Sign out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
