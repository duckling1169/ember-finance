'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import {
  IconAlertCircle,
  IconAlertTriangle,
  IconInfoCircle,
  IconCircleCheck,
  IconX,
} from '@tabler/icons-react';

import { cn } from '@/lib/utils';

/**
 * Persistent inline banner — the channel for errors, validation, sync failures,
 * stale state, and anything requiring a decision (design principle 2).
 * Persists until resolved or manually dismissed; never auto-dismisses.
 */
const alertVariants = cva('flex items-start gap-2 rounded-md border', {
  variants: {
    variant: {
      error: 'border-destructive/50 bg-destructive/10 text-destructive',
      warning: 'border-warning/50 bg-warning/10 text-warning',
      info: 'border-info/50 bg-info/10 text-info',
      success: 'border-gain/50 bg-gain/10 text-gain',
    },
    size: {
      default: 'px-4 py-2 text-sm',
      sm: 'px-3 py-1.5 text-xs',
    },
  },
  defaultVariants: {
    variant: 'error',
    size: 'default',
  },
});

const ALERT_ICONS = {
  error: IconAlertCircle,
  warning: IconAlertTriangle,
  info: IconInfoCircle,
  success: IconCircleCheck,
} as const;

function Alert({
  className,
  variant = 'error',
  size,
  title,
  onDismiss,
  children,
  ...props
}: React.ComponentProps<'div'> &
  VariantProps<typeof alertVariants> & {
    title?: string;
    onDismiss?: () => void;
  }) {
  const Icon = ALERT_ICONS[variant ?? 'error'];
  return (
    <div
      data-slot="alert"
      role={variant === 'error' || variant === 'warning' ? 'alert' : 'status'}
      className={cn(alertVariants({ variant, size, className }))}
      {...props}
    >
      <Icon size={size === 'sm' ? 14 : 16} className="mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">
        {title && <p className="font-medium">{title}</p>}
        {children}
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          aria-label="Dismiss"
          className="shrink-0 opacity-60 transition-opacity hover:opacity-100"
        >
          <IconX size={size === 'sm' ? 14 : 16} />
        </button>
      )}
    </div>
  );
}

export { Alert, alertVariants };
