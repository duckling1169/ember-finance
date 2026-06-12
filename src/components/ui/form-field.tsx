'use client';

import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * Form field wrapper (design principle 8): always-visible label (never
 * placeholder-only), inline error below the field. Convention: validate on
 * blur, clear the error the moment the input becomes valid.
 */
export function FormField({
  label,
  htmlFor,
  error,
  required,
  hint,
  className,
  children,
}: {
  label: string;
  htmlFor?: string;
  error?: string | null;
  required?: boolean;
  hint?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-1', className)}>
      <label htmlFor={htmlFor} className="text-xs font-medium text-muted-foreground">
        {label}
        {required && (
          <span aria-hidden="true" className="ml-0.5 text-destructive">
            *
          </span>
        )}
      </label>
      {children}
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : (
        hint && <p className="text-xs text-muted-foreground/70">{hint}</p>
      )}
    </div>
  );
}
