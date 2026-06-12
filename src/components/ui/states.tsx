'use client';

import * as React from 'react';
import { IconAlertCircle, IconInbox, type Icon } from '@tabler/icons-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Standardized empty / loading / error templates (design principle 8).
 * Every list/table/page uses these — no ad-hoc "Loading..." text.
 */

export function EmptyState({
  icon: IconCmp = IconInbox,
  title,
  description,
  action,
  className,
}: {
  icon?: Icon;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center gap-2 py-10 text-center', className)}>
      <IconCmp size={28} stroke={1.5} className="text-muted-foreground/60" />
      <p className="text-sm font-medium">{title}</p>
      {description && <p className="max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function ErrorState({
  title = 'Something went wrong',
  message,
  retry,
  className,
}: {
  title?: string;
  message?: string;
  retry?: () => void;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 px-4 py-8 text-center',
        className,
      )}
    >
      <IconAlertCircle size={24} className="text-destructive" />
      <p className="text-sm font-medium text-destructive">{title}</p>
      {message && <p className="max-w-md text-sm text-destructive/80">{message}</p>}
      {retry && (
        <Button variant="secondary" size="sm" className="mt-2" onClick={retry}>
          Try again
        </Button>
      )}
    </div>
  );
}

/** Generic block-level loading placeholder; tables get column-shaped skeletons from DataTable. */
export function LoadingState({ rows = 3, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn('space-y-2', className)} aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-8 w-full" />
      ))}
    </div>
  );
}
