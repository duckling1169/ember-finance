import { useState, useCallback, useRef } from 'react';

export type FlashType = 'success' | 'error';

export interface Flash {
  type: FlashType;
  message: string;
}

/**
 * Simple flash message hook — auto-clears after a timeout.
 * Matches the existing settings page pattern (success/error with auto-dismiss).
 */
export function useFlash(timeout = 3000) {
  const [flash, setFlash] = useState<Flash | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(
    (type: FlashType, message: string) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      setFlash({ type, message });
      timerRef.current = setTimeout(() => setFlash(null), timeout);
    },
    [timeout],
  );

  const clear = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setFlash(null);
  }, []);

  return { flash, show, clear };
}
