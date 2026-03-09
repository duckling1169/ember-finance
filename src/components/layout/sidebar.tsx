'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  IconBuildingBank,
  IconChartLine,
  IconUser,
  IconMenu2,
  IconPin,
  IconPinFilled,
} from '@tabler/icons-react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';

const SIDEBAR_KEY = 'ember-sidebar-pinned';

const navItems = [
  { href: '/accounts', label: 'Accounts', icon: IconBuildingBank },
  { href: '/investments', label: 'Investments', icon: IconChartLine },
];

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col">
      <div className="p-6">
        <Link
          href="/"
          onClick={onNavigate}
          className="text-xl font-semibold tracking-tight text-foreground hover:text-primary transition-colors"
        >
          Ember
        </Link>
      </div>

      <nav className="flex-1 px-3 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-muted text-foreground'
                  : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
              )}
            >
              <item.icon size={20} stroke={1.5} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border/50 px-3 py-3">
        <Link
          href="/profile"
          onClick={onNavigate}
          className={cn(
            'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
            pathname === '/profile'
              ? 'bg-muted text-foreground'
              : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
          )}
        >
          <IconUser size={20} stroke={1.5} />
          Profile
        </Link>
      </div>
    </div>
  );
}

export function Sidebar() {
  const [pinned, setPinned] = useState(true);
  const [hovered, setHovered] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem(SIDEBAR_KEY);
    if (stored !== null) {
      setPinned(stored === 'true');
    }
  }, []);

  const togglePin = useCallback(() => {
    setPinned((prev) => {
      const next = !prev;
      localStorage.setItem(SIDEBAR_KEY, String(next));
      return next;
    });
  }, []);

  // Cmd+/ keyboard shortcut
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === '/') {
        e.preventDefault();
        togglePin();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePin]);

  if (!mounted) {
    return <div className="hidden lg:block w-60 shrink-0" />;
  }

  const visible = pinned || hovered;

  return (
    <>
      {/* Desktop sidebar */}
      <div className="hidden lg:block">
        {/* Spacer when pinned */}
        {pinned && <div className="w-60 shrink-0" />}

        {/* Hover trigger zone when unpinned */}
        {!pinned && (
          <div className="fixed inset-y-0 left-0 w-3 z-40" onMouseEnter={() => setHovered(true)} />
        )}

        {/* Sidebar panel */}
        <aside
          className={cn(
            'fixed inset-y-0 left-0 z-40 w-60 bg-card transition-transform duration-200',
            !pinned && 'shadow-md',
            visible ? 'translate-x-0' : '-translate-x-full',
          )}
          onMouseEnter={() => !pinned && setHovered(true)}
          onMouseLeave={() => !pinned && setHovered(false)}
        >
          <div className="absolute top-4 right-3">
            <button
              onClick={togglePin}
              className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-muted"
              title={pinned ? 'Unpin sidebar (Cmd+/)' : 'Pin sidebar (Cmd+/)'}
            >
              {pinned ? <IconPinFilled size={16} /> : <IconPin size={16} />}
            </button>
          </div>
          <SidebarNav />
        </aside>
      </div>

      {/* Mobile sidebar */}
      <div className="lg:hidden">
        <MobileHeader />
      </div>
    </>
  );
}

function MobileHeader() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  const pageTitle =
    pathname === '/' ? 'Home' : navItems.find((n) => pathname.startsWith(n.href))?.label || 'Ember';

  return (
    <div className="sticky top-0 z-30 flex h-14 items-center gap-3 bg-background px-4">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger render={<Button variant="ghost" size="icon" />}>
          <IconMenu2 size={20} stroke={1.5} />
        </SheetTrigger>
        <SheetContent side="left" showCloseButton={false} className="w-60 p-0">
          <SidebarNav onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
      <span className="text-sm font-medium">{pageTitle}</span>
    </div>
  );
}
