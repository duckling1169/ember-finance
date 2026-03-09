'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';

export default function LoginPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Redirect if already logged in
  useEffect(() => {
    if (!authLoading && user) router.replace('/dashboard');
  }, [user, authLoading, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { error: authError } = isSignUp
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);

    if (authError) {
      setError(authError.message);
      return;
    }

    if (isSignUp) {
      setError('Check your email to confirm your account, then log in.');
      setIsSignUp(false);
      return;
    }

    router.push('/');
  }

  return (
    <div style={{ maxWidth: 400, margin: '80px auto', padding: 20 }}>
      <h1 style={{ fontSize: 24, marginBottom: 4 }}>FIRE App</h1>
      <p style={{ color: '#666', marginBottom: 24 }}>
        {isSignUp ? 'Create an account' : 'Sign in to your account'}
      </p>

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', marginBottom: 4 }}>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{
              width: '100%',
              padding: 8,
              border: '1px solid #ccc',
              borderRadius: 4,
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', marginBottom: 4 }}>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            style={{
              width: '100%',
              padding: 8,
              border: '1px solid #ccc',
              borderRadius: 4,
              boxSizing: 'border-box',
            }}
          />
        </div>

        {error && (
          <p
            style={{
              color: error.includes('Check your email') ? 'green' : 'red',
              marginBottom: 12,
            }}
          >
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%',
            padding: 10,
            background: '#000',
            color: '#fff',
            border: 'none',
            borderRadius: 4,
            cursor: loading ? 'wait' : 'pointer',
          }}
        >
          {loading ? '...' : isSignUp ? 'Sign Up' : 'Sign In'}
        </button>
      </form>

      <p style={{ marginTop: 16, textAlign: 'center' }}>
        <button
          onClick={() => {
            setIsSignUp(!isSignUp);
            setError('');
          }}
          style={{ background: 'none', border: 'none', color: '#0070f3', cursor: 'pointer' }}
        >
          {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
        </button>
      </p>

      {process.env.NODE_ENV === 'development' && (
        <div style={{ marginTop: 32, padding: 16, border: '1px dashed #ccc', borderRadius: 4 }}>
          <p style={{ color: '#999', fontSize: 13, marginBottom: 8 }}>Dev only</p>
          <button
            onClick={async () => {
              setError('');
              setLoading(true);
              const devEmail = 'dev@fireapp.local';
              const devPassword = 'devpass123';

              // Try sign in first, if that fails, sign up then sign in
              let { error: signInErr } = await supabase.auth.signInWithPassword({
                email: devEmail,
                password: devPassword,
              });

              if (signInErr) {
                const { error: signUpErr } = await supabase.auth.signUp({
                  email: devEmail,
                  password: devPassword,
                  options: { data: { dev: true } },
                });
                if (signUpErr) {
                  setError(signUpErr.message);
                  setLoading(false);
                  return;
                }
                // Try sign in again after signup
                ({ error: signInErr } = await supabase.auth.signInWithPassword({
                  email: devEmail,
                  password: devPassword,
                }));
                if (signInErr) {
                  setError(signInErr.message);
                  setLoading(false);
                  return;
                }
              }

              // Ensure dev user has a household
              const {
                data: { session },
              } = await supabase.auth.getSession();
              if (session) {
                const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
                const headers = {
                  Authorization: `Bearer ${session.access_token}`,
                  'Content-Type': 'application/json',
                };
                const hhRes = await fetch(`${API}/api/settings/household`, { headers });
                if (!hhRes.ok) {
                  // Create household + profile for dev user
                  await fetch(`${API}/api/onboarding`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                      householdName: 'Dev Household',
                      displayName: 'Dev User',
                      birthday: '1990-01-01',
                      targetRetirementAge: 55,
                    }),
                  });
                }
              }

              setLoading(false);
              router.push('/dashboard');
            }}
            disabled={loading}
            style={{
              width: '100%',
              padding: 10,
              background: '#666',
              color: '#fff',
              border: 'none',
              borderRadius: 4,
              cursor: loading ? 'wait' : 'pointer',
            }}
          >
            {loading ? '...' : 'Dev Login (dev@fireapp.local)'}
          </button>
        </div>
      )}
    </div>
  );
}
