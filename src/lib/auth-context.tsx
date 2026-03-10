'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { devBypass } from './constants';

interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
}

const AuthContext = createContext<AuthState>({
  user: null,
  session: null,
  loading: true,
});

export function useAuth() {
  return useContext(AuthContext);
}

const mockUser = {
  id: 'dev-mock-user',
  email: 'dev@ember.local',
  aud: 'authenticated',
  role: 'authenticated',
  app_metadata: {},
  user_metadata: { display_name: 'Dev User' },
  created_at: '2025-01-01T00:00:00.000Z',
} as unknown as User;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>(
    devBypass
      ? { user: mockUser, session: null, loading: false }
      : { user: null, session: null, loading: true },
  );

  useEffect(() => {
    if (devBypass) return;

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setState({ user: session?.user ?? null, session, loading: false });
    });

    // Listen for auth changes (sign in, sign out, token refresh, expiry)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setState({ user: session?.user ?? null, session, loading: false });
    });

    return () => subscription.unsubscribe();
  }, []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}
