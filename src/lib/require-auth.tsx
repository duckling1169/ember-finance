'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from './auth-context';
import { useHousehold } from './swr';

interface RequireAuthProps {
  children: React.ReactNode;
  /** When true (default), redirects to /onboarding if no household.
   *  When false, redirects to / if household already exists (for onboarding page). */
  requireHousehold?: boolean;
}

export function RequireAuth({ children, requireHousehold = true }: RequireAuthProps) {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const { data: household, isLoading: hhLoading, error: hhError } = useHousehold();
  const noHousehold =
    !hhLoading && (!household || hhError?.message?.includes('No household found'));

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user || hhLoading) return;
    if (requireHousehold && noHousehold) {
      router.replace('/onboarding');
    } else if (!requireHousehold && !noHousehold) {
      router.replace('/');
    }
  }, [user, hhLoading, requireHousehold, noHousehold, router]);

  if (authLoading || hhLoading)
    return (
      <div
        aria-busy="true"
        aria-label="Loading"
        className="flex min-h-screen items-center justify-center"
      >
        <div className="w-full max-w-md space-y-3 px-6">
          <div className="h-8 w-48 animate-pulse rounded-md bg-muted" />
          <div className="h-40 w-full animate-pulse rounded-lg bg-muted" />
        </div>
      </div>
    );

  if (!user) return null;
  if (requireHousehold && noHousehold) return null;
  if (!requireHousehold && !noHousehold) return null;

  return <>{children}</>;
}
