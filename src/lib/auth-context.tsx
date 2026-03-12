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

const mockUser: User = {
  id: 'dev-mock-user',
  email: 'dev@ember.local',
  aud: 'authenticated',
  role: 'authenticated',
  app_metadata: {},
  user_metadata: { display_name: 'Dev User' },
  created_at: '2025-01-01T00:00:00.000Z',
  updated_at: '',
  is_anonymous: false,
};

/** SSR-safe initial state — always starts as loading to match server render. */
const SSR_INITIAL: AuthState = devBypass
  ? { user: mockUser, session: null, loading: false }
  : { user: null, session: null, loading: true };

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>(SSR_INITIAL);

  useEffect(() => {
    if (devBypass) return;

    // Check localStorage first to reduce loading flash
    try {
      const key = Object.keys(localStorage).find(
        (k) => k.startsWith('sb-') && k.endsWith('-auth-token'),
      );
      if (key) {
        const stored = JSON.parse(localStorage.getItem(key) || '');
        if (stored?.user) {
          setState({ user: stored.user, session: stored, loading: false });
        }
      }
    } catch {
      // Fall through to async check
    }

    // Get authoritative session (corrects stale localStorage read)
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
