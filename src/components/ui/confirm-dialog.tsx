'use client';

import * as React from 'react';
import { Dialog } from '@base-ui/react/dialog';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

/**
 * Confirmation for destructive actions (design principle 8): the confirm button
 * names the consequence ("Delete income source"), the safe option (Cancel) is
 * focused by default, and the two are whitespace-separated.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  onConfirm,
  busy = false,
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: React.ReactNode;
  /** Names the consequence, e.g. "Delete income source" — never just "OK". */
  confirmLabel: string;
  onConfirm: () => void | Promise<void>;
  busy?: boolean;
  className?: string;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/30 duration-100 data-ending-style:opacity-0 data-starting-style:opacity-0 supports-backdrop-filter:backdrop-blur-xs" />
        <Dialog.Popup
          className={cn(
            'fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-popover p-4 text-popover-foreground shadow-lg data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0',
            className,
          )}
        >
          <Dialog.Title className="text-base font-medium">{title}</Dialog.Title>
          {description && (
            <Dialog.Description className="mt-1 text-sm text-muted-foreground">
              {description}
            </Dialog.Description>
          )}
          <div className="mt-4 flex items-center justify-between gap-6">
            <Dialog.Close render={<Button variant="secondary" autoFocus />} disabled={busy}>
              Cancel
            </Dialog.Close>
            <Button variant="danger" onClick={() => void onConfirm()} disabled={busy}>
              {busy ? 'Working…' : confirmLabel}
            </Button>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
