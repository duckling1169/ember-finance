'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { useTheme } from '@/lib/theme-context';
import { updateHousehold, updateProfile, removeMember, sendInvite, cancelInvite } from '@/lib/api';
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
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { LoadingState } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
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
} from '@tabler/icons-react';

import type {
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
  const toast = useToast();

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

  // Card-level error state (persistent Alerts, design principle 2)
  const [profileError, setProfileError] = useState<string | null>(null);
  const [householdError, setHouseholdError] = useState<string | null>(null);
  const [membersError, setMembersError] = useState<string | null>(null);

  // Destructive-action confirmation state
  const [memberToRemove, setMemberToRemove] = useState<{ id: string; name: string } | null>(null);
  const [inviteToCancel, setInviteToCancel] = useState<{ id: string; email: string } | null>(null);

  // Household form state
  const [hhName, setHhName] = useState('');
  const [hhTaxStatus, setHhTaxStatus] = useState('');
  const [hhInitialized, setHhInitialized] = useState(false);

  // Profile form state
  const [displayName, setDisplayName] = useState('');
  const [birthday, setBirthday] = useState('');
  const [retirementAge, setRetirementAge] = useState('');
  const [employmentType, setEmploymentType] = useState('');
  const [riskTolerance, setRiskTolerance] = useState('');
  const [memberState, setMemberState] = useState('');
  const [profInitialized, setProfInitialized] = useState(false);

  const [inviteEmail, setInviteEmail] = useState('');

  const isOwner = profile?.role === 'owner';

  // Sync SWR data into form state once loaded
  if (household && !hhInitialized) {
    setHhName(household.name || '');
    setHhTaxStatus(household.tax_filing_status || '');
    setHhInitialized(true);
  }
  if (profile && !profInitialized) {
    setDisplayName(profile.display_name || '');
    setBirthday(profile.birthday || '');
    setRetirementAge(profile.target_retirement_age?.toString() || '');
    setEmploymentType(profile.employment_type || '');
    setRiskTolerance(profile.risk_tolerance || '');
    setMemberState(profile.state || '');
    setProfInitialized(true);
  }

  async function saveProfile() {
    setSaving('profile');
    setProfileError(null);
    try {
      await updateProfile({
        displayName,
        birthday: birthday || null,
        targetRetirementAge: retirementAge ? parseInt(retirementAge) : null,
        employmentType: (employmentType as EmploymentType) || null,
        riskTolerance: (riskTolerance as RiskTolerance) || null,
        state: (memberState as USState) || null,
      });
      await mutateProfile();
      toast('success', 'Profile updated');
    } catch (e) {
      setProfileError(e instanceof Error ? e.message : 'Failed to update');
    } finally {
      setSaving(null);
    }
  }

  async function saveHousehold() {
    setSaving('household');
    setHouseholdError(null);
    try {
      await updateHousehold({
        name: hhName,
        taxFilingStatus: (hhTaxStatus as TaxFilingStatus) || null,
      });
      await mutateHousehold();
      toast('success', 'Household updated');
    } catch (e) {
      setHouseholdError(e instanceof Error ? e.message : 'Failed to update');
    } finally {
      setSaving(null);
    }
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteEmail) return;
    setSaving('invite');
    setMembersError(null);
    try {
      await sendInvite({ email: inviteEmail, role: 'viewer' });
      setInviteEmail('');
      await mutateInvites();
      toast('success', 'Invite sent');
    } catch (e) {
      setMembersError(e instanceof Error ? e.message : 'Failed to send invite');
    } finally {
      setSaving(null);
    }
  }

  async function confirmCancelInvite() {
    if (!inviteToCancel) return;
    setSaving('cancel-invite');
    setMembersError(null);
    try {
      await cancelInvite(inviteToCancel.id);
      await mutateInvites();
    } catch (e) {
      setMembersError(e instanceof Error ? e.message : 'Failed to cancel invite');
    } finally {
      setSaving(null);
      setInviteToCancel(null);
    }
  }

  async function confirmRemoveMember() {
    if (!memberToRemove) return;
    setSaving('remove-member');
    setMembersError(null);
    try {
      await removeMember(memberToRemove.id);
      await mutateMembers();
    } catch (e) {
      setMembersError(e instanceof Error ? e.message : 'Failed to remove member');
    } finally {
      setSaving(null);
      setMemberToRemove(null);
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.replace('/login');
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold">Settings</h1>
        <LoadingState rows={6} />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-semibold">Settings</h1>

      {/* Profile */}
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Your personal information</CardDescription>
        </CardHeader>
        <CardContent>
          {profileError && (
            <Alert variant="error" className="mb-4" onDismiss={() => setProfileError(null)}>
              {profileError}
            </Alert>
          )}
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
              <p className="mt-1 text-xs text-muted-foreground">
                Planning assumptions (returns, taxes, limits) live in{' '}
                <Link
                  href="/assumptions"
                  className="underline underline-offset-2 hover:text-foreground"
                >
                  Assumptions
                </Link>
                .
              </p>
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
            <div>
              <label className="mb-1.5 block text-sm font-medium">State</label>
              <Input
                value={memberState}
                onChange={(e) => setMemberState(e.target.value.toUpperCase())}
                placeholder="CA"
                maxLength={2}
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <Button variant="primary" disabled={saving === 'profile'} onClick={saveProfile}>
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
              {householdError && (
                <Alert variant="error" className="mb-4" onDismiss={() => setHouseholdError(null)}>
                  {householdError}
                </Alert>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Household Name</label>
                  <Input value={hhName} onChange={(e) => setHhName(e.target.value)} />
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
                  variant="secondary"
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
              {membersError && (
                <Alert variant="error" className="mb-4" onDismiss={() => setMembersError(null)}>
                  {membersError}
                </Alert>
              )}
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
                          size="icon-sm"
                          aria-label={`Remove ${m.display_name} from household`}
                          className="text-destructive hover:text-destructive"
                          onClick={() => setMemberToRemove({ id: m.id, name: m.display_name })}
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
                            size="icon-sm"
                            aria-label={`Cancel invite to ${inv.email}`}
                            className="text-destructive hover:text-destructive"
                            onClick={() => setInviteToCancel({ id: inv.id, email: inv.email })}
                          >
                            <IconX size={14} />
                          </Button>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              <form onSubmit={handleInvite} className="mt-4">
                <label htmlFor="invite-email" className="mb-1.5 block text-sm font-medium">
                  Invite by Email
                </label>
                <div className="flex gap-2">
                  <Input
                    id="invite-email"
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="partner@email.com"
                    className="flex-1"
                  />
                  <Button
                    type="submit"
                    variant="secondary"
                    disabled={saving === 'invite' || !inviteEmail}
                  >
                    {saving === 'invite' ? (
                      <IconLoader2 size={14} className="animate-spin" />
                    ) : (
                      <IconSend size={14} />
                    )}
                    Invite
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <ConfirmDialog
            open={memberToRemove !== null}
            onOpenChange={(open) => {
              if (!open) setMemberToRemove(null);
            }}
            title={`Remove ${memberToRemove?.name ?? 'member'} from household?`}
            description="They will lose access to this household's accounts, holdings, and plans. You can invite them again later."
            confirmLabel="Remove member"
            busy={saving === 'remove-member'}
            onConfirm={confirmRemoveMember}
          />

          <ConfirmDialog
            open={inviteToCancel !== null}
            onOpenChange={(open) => {
              if (!open) setInviteToCancel(null);
            }}
            title={`Cancel invite to ${inviteToCancel?.email ?? 'this address'}?`}
            description="The invite will be withdrawn and its link will stop working. You can send a new invite at any time."
            confirmLabel="Cancel invite"
            busy={saving === 'cancel-invite'}
            onConfirm={confirmCancelInvite}
          />
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
          <Button variant="danger" onClick={handleSignOut}>
            Sign out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
