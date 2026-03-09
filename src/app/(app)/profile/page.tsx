'use client';

import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { useTheme } from '@/lib/theme-context';
import { RequireAuth } from '@/lib/require-auth';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { IconUser, IconSun, IconMoon, IconDeviceDesktop } from '@tabler/icons-react';

const themeOptions = [
  { value: 'system' as const, label: 'System', icon: IconDeviceDesktop },
  { value: 'light' as const, label: 'Light', icon: IconSun },
  { value: 'dark' as const, label: 'Dark', icon: IconMoon },
];

export default function ProfilePage() {
  return (
    <RequireAuth>
      <ProfileContent />
    </RequireAuth>
  );
}

function ProfileContent() {
  const router = useRouter();
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.replace('/login');
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Profile</h1>

      <Card>
        <CardHeader>
          <CardTitle>Personal</CardTitle>
          <CardDescription>Your account details</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <IconUser size={32} className="text-muted-foreground" stroke={1.5} />
            <p className="text-sm text-muted-foreground">
              Personal info, household, members, and data management coming soon.
            </p>
            {user?.email && <p className="text-xs text-muted-foreground">{user.email}</p>}
          </div>
        </CardContent>
      </Card>

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

      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" onClick={handleSignOut}>
            Sign out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
