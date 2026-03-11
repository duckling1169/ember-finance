'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { Card, CardHeader, CardDescription, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { IconFlame } from '@tabler/icons-react';

export default function LoginPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && user) router.replace('/');
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
    <div className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <div className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground hover:text-primary transition-colors cursor-default">
            Ember
            <IconFlame size={24} className="text-primary" />
          </div>
          <CardDescription>
            {isSignUp ? 'Create an account' : 'Sign in to your account'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium">Email</label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Password</label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>

            {error && (
              <p
                className={`text-sm ${error.includes('Check your email') ? 'text-gain' : 'text-destructive'}`}
              >
                {error}
              </p>
            )}

            <Button
              type="submit"
              variant="outline"
              disabled={loading}
              className="w-full hover:bg-primary hover:text-primary-foreground hover:border-primary"
            >
              {loading ? '...' : isSignUp ? 'Sign Up' : 'Sign In'}
            </Button>
          </form>

          <p className="mt-4 text-center text-sm text-muted-foreground">
            <button
              onClick={() => {
                setIsSignUp(!isSignUp);
                setError('');
              }}
              className="hover:text-primary transition-colors"
            >
              {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
            </button>
          </p>

          {process.env.NODE_ENV === 'development' && (
            <div className="mt-6 rounded-md border border-dashed border-border p-4">
              <p className="mb-2 text-xs text-muted-foreground">Dev only</p>
              <Button
                variant="secondary"
                className="w-full"
                disabled={loading}
                onClick={async () => {
                  setError('');
                  setLoading(true);
                  // Use a stable dev email per browser (stored in localStorage)
                  const storageKey = 'ember-dev-email';
                  let devEmail = localStorage.getItem(storageKey);
                  if (!devEmail) {
                    const id = Math.random().toString(36).slice(2, 8);
                    devEmail = `ember.dev.${id}@mailinator.com`;
                    localStorage.setItem(storageKey, devEmail);
                  }
                  const devPassword = 'devpass123!A';

                  // Try sign in first
                  let { error: signInErr } = await supabase.auth.signInWithPassword({
                    email: devEmail,
                    password: devPassword,
                  });

                  if (signInErr) {
                    // Stale email — generate a fresh one to avoid conflicts
                    const id = Math.random().toString(36).slice(2, 8);
                    devEmail = `ember.dev.${id}@mailinator.com`;
                    localStorage.setItem(storageKey, devEmail);

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
                    // Sign in with the fresh account
                    ({ error: signInErr } = await supabase.auth.signInWithPassword({
                      email: devEmail,
                      password: devPassword,
                    }));
                    if (signInErr) {
                      setError(
                        `Signed up as ${devEmail} but email confirmation may be required. ` +
                          'Disable "Confirm email" in Supabase Dashboard → Auth → Settings to skip.',
                      );
                      setLoading(false);
                      return;
                    }
                  }

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
                  router.push('/');
                }}
              >
                {loading ? '...' : 'Dev Login (auto-generated)'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
