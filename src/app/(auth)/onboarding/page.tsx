'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createHousehold, acceptInvite } from '@/lib/api';
import { RequireAuth } from '@/lib/require-auth';
import { Card, CardHeader, CardDescription, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { IconFlame } from '@tabler/icons-react';
import type { TaxFilingStatus, USState } from '@shared/types';

const TAX_FILING_OPTIONS: { value: TaxFilingStatus; label: string }[] = [
  { value: 'single', label: 'Single' },
  { value: 'married_jointly', label: 'Married Filing Jointly' },
  { value: 'married_separately', label: 'Married Filing Separately' },
  { value: 'head_of_household', label: 'Head of Household' },
];

export default function OnboardingPage() {
  return (
    <RequireAuth requireHousehold={false}>
      <OnboardingContent />
    </RequireAuth>
  );
}

function OnboardingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteId = searchParams.get('inviteId');

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const form = new FormData(e.currentTarget);

    try {
      if (inviteId) {
        await acceptInvite({
          inviteId,
          displayName: form.get('displayName') as string,
          birthday: (form.get('birthday') as string) || null,
        });
      } else {
        await createHousehold({
          householdName: form.get('householdName') as string,
          displayName: form.get('displayName') as string,
          birthday: (form.get('birthday') as string) || null,
          taxFilingStatus: (form.get('taxFilingStatus') as TaxFilingStatus) || null,
          state: (form.get('state') as USState) || null,
        });
      }
      router.push('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <div className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground hover:text-primary transition-colors cursor-default">
            Ember
            <IconFlame size={24} className="text-primary" />
          </div>
          <CardDescription>
            {inviteId ? 'Set up your profile to join' : 'Set up your household and profile'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {!inviteId && (
              <div>
                <label className="mb-1.5 block text-sm font-medium">Household Name</label>
                <Input name="householdName" required placeholder="Smith Family" />
              </div>
            )}
            <div>
              <label className="mb-1.5 block text-sm font-medium">Your Name</label>
              <Input name="displayName" required placeholder="Adam" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Your Birthday</label>
              <Input name="birthday" type="date" required />
            </div>

            {!inviteId && (
              <>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Tax Filing Status</label>
                  <Select name="taxFilingStatus">
                    <option value="">Select...</option>
                    {TAX_FILING_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">State</label>
                  <Input
                    name="state"
                    placeholder="CA"
                    maxLength={2}
                    onChange={(e) => {
                      e.target.value = e.target.value.toUpperCase();
                    }}
                  />
                </div>
              </>
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button type="submit" variant="primary-outline" disabled={loading} className="w-full">
              {loading ? '...' : inviteId ? 'Join Household' : 'Get Started'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
