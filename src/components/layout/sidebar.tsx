'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  IconBuildingBank,
  IconWallet,
  IconArrowsExchange,
  IconArrowsSplit,
  IconReceipt,
  IconTargetArrow,
  IconSettings,
  IconMenu2,
  IconPin,
  IconPinFilled,
  IconFlame,
} from '@tabler/icons-react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';

const SIDEBAR_KEY = 'ember-sidebar-pinned';
const COLLAPSED_WIDTH = 'w-14';
const EXPANDED_WIDTH = 'w-60';

const navItems = [
  { href: '/accounts', label: 'Accounts', icon: IconBuildingBank },
  { href: '/holdings', label: 'Holdings', icon: IconWallet },
  { href: '/activity', label: 'Activity', icon: IconArrowsExchange },
  { href: '/flows', label: 'Flows', icon: IconArrowsSplit },
  { href: '/budget', label: 'Budget', icon: IconReceipt },
  { href: '/planning', label: 'Planning', icon: IconTargetArrow },
];

function SidebarNav({
  collapsed = false,
  onNavigate,
}: {
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col">
      <div className={cn('p-6', collapsed && 'px-4 py-6')}>
        <Link
          href="/"
          onClick={onNavigate}
          className={cn(
            'flex items-center gap-2 text-xl font-semibold tracking-tight text-foreground hover:text-primary transition-colors',
            collapsed && 'justify-center',
          )}
        >
          {collapsed ? (
            <IconFlame size={22} className="text-primary" />
          ) : (
            <>
              Ember
              <IconFlame size={22} className="text-primary" />
            </>
          )}
        </Link>
      </div>

      <nav className={cn('flex-1 px-3 space-y-1', collapsed && 'px-2')}>
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              title={collapsed ? item.label : undefined}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                collapsed && 'justify-center px-0',
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
              )}
            >
              <item.icon size={20} stroke={1.5} />
              {!collapsed && item.label}
            </Link>
          );
        })}
      </nav>

      <div className={cn('border-t border-border/50 px-3 py-3', collapsed && 'px-2')}>
        <Link
          href="/settings"
          onClick={onNavigate}
          title={collapsed ? 'Settings' : undefined}
          className={cn(
            'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
            collapsed && 'justify-center px-0',
            pathname === '/settings'
              ? 'bg-primary/10 text-primary'
              : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
          )}
        >
          <IconSettings size={20} stroke={1.5} />
          {!collapsed && 'Settings'}
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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration-safe localStorage init
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

  const expanded = mounted ? pinned || hovered : true;

  return (
    <>
      {/* Desktop sidebar */}
      <div className="hidden lg:block">
        {/* Spacer to push content over */}
        <div
          className={cn(
            'shrink-0 transition-[width] duration-200',
            expanded ? EXPANDED_WIDTH : COLLAPSED_WIDTH,
          )}
        />

        {/* Sidebar panel */}
        <aside
          className={cn(
            'fixed inset-y-0 left-0 z-40 bg-card transition-[width] duration-200 overflow-hidden',
            expanded ? EXPANDED_WIDTH : COLLAPSED_WIDTH,
            !pinned && hovered && 'shadow-md',
          )}
          onMouseEnter={() => mounted && !pinned && setHovered(true)}
          onMouseLeave={() => mounted && !pinned && setHovered(false)}
        >
          {expanded && (
            <div className="absolute top-4 right-3">
              <button
                onClick={togglePin}
                className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-muted"
                title={pinned ? 'Unpin sidebar (Cmd+/)' : 'Pin sidebar (Cmd+/)'}
              >
                {pinned ? <IconPinFilled size={16} /> : <IconPin size={16} />}
              </button>
            </div>
          )}
          <SidebarNav collapsed={!expanded} />
        </aside>
      </div>

      {/* Mobile sidebar */}
      <div className="sticky top-0 z-30 lg:hidden">{mounted && <MobileHeader />}</div>
    </>
  );
}

function MobileHeader() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  const pageTitle =
    pathname === '/' ? 'Home' : navItems.find((n) => pathname.startsWith(n.href))?.label || 'Ember';

  return (
    <div className="flex h-14 items-center gap-3 bg-background px-4">
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
