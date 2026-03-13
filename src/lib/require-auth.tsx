'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from './auth-context';
import { useHousehold } from './swr';
import { devBypass } from './mock-data';

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const { data: household, isLoading: hhLoading, error: hhError } = useHousehold();
  const noHousehold =
    !devBypass && !hhLoading && (!household || hhError?.message?.includes('No household found'));

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user && noHousehold) {
      router.replace('/onboarding');
    }
  }, [user, noHousehold, router]);

  if (authLoading || hhLoading)
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Loading...
      </div>
    );
  if (!user || noHousehold) return null;

  return <>{children}</>;
}
