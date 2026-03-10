'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createHousehold, acceptInvite } from '@/lib/api';
import { RequireAuth } from '@/lib/require-auth';
import { Card, CardHeader, CardDescription, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { IconFlame } from '@tabler/icons-react';

export default function OnboardingPage() {
  return (
    <RequireAuth>
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
          displayName: form.get('displayName'),
          birthday: form.get('birthday'),
        });
      } else {
        await createHousehold({
          householdName: form.get('householdName'),
          displayName: form.get('displayName'),
          birthday: form.get('birthday'),
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

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button
              type="submit"
              variant="outline"
              disabled={loading}
              className="w-full hover:bg-primary hover:text-primary-foreground hover:border-primary"
            >
              {loading ? '...' : inviteId ? 'Join Household' : 'Get Started'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
