'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { IconChevronRight } from '@tabler/icons-react';
import { cn } from '@/lib/utils';
import { useScenario } from '@/lib/scenario-context';
import { useAccounts } from '@/lib/swr';
import { ScenarioChip } from '@/components/layout/scenario-chip';

const SECTION_LABELS: Record<string, string> = {
  accounts: 'Accounts',
  holdings: 'Holdings',
  activity: 'Activity',
  flows: 'Flows',
  budget: 'Budget',
  planning: 'Planning',
  assumptions: 'Assumptions',
  settings: 'Settings',
  onboarding: 'Onboarding',
};

function Crumb({ href, label, last }: { href?: string; label: string; last: boolean }) {
  if (last || !href) {
    return (
      <span aria-current={last ? 'page' : undefined} className="text-foreground">
        {label}
      </span>
    );
  }
  return (
    <Link href={href} className="text-muted-foreground transition-colors hover:text-foreground">
      {label}
    </Link>
  );
}

export function Breadcrumbs({ className }: { className?: string }) {
  return (
    <Suspense fallback={null}>
      <BreadcrumbsInner className={className} />
    </Suspense>
  );
}

function BreadcrumbsInner({ className }: { className?: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { data: accounts } = useAccounts();

  const segments = pathname.split('/').filter(Boolean);
  const crumbs: { href?: string; label: string }[] = [{ href: '/', label: 'Home' }];

  if (segments[0]) {
    const section = SECTION_LABELS[segments[0]] ?? segments[0];
    crumbs.push({ href: `/${segments[0]}`, label: section });
    if (segments[0] === 'accounts' && segments[1] === 'view') {
      const id = searchParams.get('id');
      const name = accounts?.find((a) => a.id === id)?.name;
      crumbs.push({ label: name ?? 'Account detail' });
    }
  }

  return (
    <nav aria-label="Breadcrumb" className={cn('flex items-center gap-1.5 text-sm', className)}>
      {crumbs.map((c, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <IconChevronRight size={13} className="text-muted-foreground/50" />}
          <Crumb href={c.href} label={c.label} last={i === crumbs.length - 1} />
        </span>
      ))}
    </nav>
  );
}

/**
 * Global top chrome: breadcrumbs (wayfinding, principle 8) + the persistent
 * active-scenario indicator (principle 4). When a non-base scenario is active
 * the bar carries a violet band so scenario output is never mistaken for
 * baseline.
 */
export function TopBar() {
  const { activeScenarioName } = useScenario();
  return (
    <header
      className={cn(
        'sticky top-0 z-30 hidden h-12 items-center justify-between gap-3 border-b bg-background/95 px-6 backdrop-blur lg:flex',
        activeScenarioName ? 'border-b-2 border-scenario' : 'border-border/50',
      )}
    >
      <Breadcrumbs />
      <ScenarioChip />
    </header>
  );
}
