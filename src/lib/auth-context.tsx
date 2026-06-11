'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from './supabase';

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

/** SSR-safe initial state — always starts as loading to match server render. */
const SSR_INITIAL: AuthState = { user: null, session: null, loading: true };

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>(SSR_INITIAL);

  useEffect(() => {
    // Check localStorage first to reduce loading flash
    try {
      const key = Object.keys(localStorage).find(
        (k) => k.startsWith('sb-') && k.endsWith('-auth-token'),
      );
      if (key) {
        const stored = JSON.parse(localStorage.getItem(key) || '');
        if (stored?.user) {
          // eslint-disable-next-line react-hooks/set-state-in-effect -- reduce auth loading flash
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
