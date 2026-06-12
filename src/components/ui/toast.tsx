'use client';

import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { IconCircleCheck, IconInfoCircle, IconX } from '@tabler/icons-react';
import { cn } from '@/lib/utils';

/**
 * Two-channel feedback convention (design principle 2):
 * Toasts confirm completed, NON-critical actions and auto-dismiss.
 * Errors, validation, and anything requiring a decision must use a persistent
 * inline <Alert> instead — so 'error' is intentionally not a ToastType.
 */
export type ToastType = 'success' | 'info';

interface Toast {
  id: number;
  type: ToastType;
  message: string;
}

interface ToastContextValue {
  toast: (type: ToastType, message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const TOAST_DURATION = 5000;
const MAX_TOASTS = 3;

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx.toast;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (type: ToastType, message: string) => {
      const id = nextId.current++;
      setToasts((prev) => [...prev, { id, type, message }].slice(-MAX_TOASTS));
      setTimeout(() => dismiss(id), TOAST_DURATION);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed top-4 right-4 z-50 flex w-full max-w-sm flex-col gap-2"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={cn(
              'pointer-events-auto flex items-start gap-2 rounded-md border px-4 py-3 text-sm shadow-lg backdrop-blur',
              t.type === 'success'
                ? 'border-gain/50 bg-gain/10 text-gain'
                : 'border-info/50 bg-info/10 text-info',
            )}
          >
            {t.type === 'success' ? (
              <IconCircleCheck size={18} className="mt-px shrink-0" />
            ) : (
              <IconInfoCircle size={18} className="mt-px shrink-0" />
            )}
            <span className="flex-1">{t.message}</span>
            <button
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss"
              className="shrink-0 opacity-60 transition-opacity hover:opacity-100"
            >
              <IconX size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
