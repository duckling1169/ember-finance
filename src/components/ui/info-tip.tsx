'use client';

import { useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { IconInfoCircle } from '@tabler/icons-react';
import { cn } from '@/lib/utils';

interface InfoTipProps {
  /** Tooltip text to display on hover/focus */
  content: string;
  /** Size of the info icon in px */
  size?: number;
  className?: string;
}

/**
 * Small info icon that reveals a tooltip on hover or focus.
 * Renders via portal so it escapes overflow:hidden containers.
 */
export function InfoTip({ content, size = 14, className }: InfoTipProps) {
  const [pos, setPos] = useState<{ top: number; left: number; above: boolean } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const show = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const above = rect.top > 140;
    setPos({
      top: above ? rect.top + window.scrollY : rect.bottom + window.scrollY,
      left: rect.left + rect.width / 2 + window.scrollX,
      above,
    });
  }, []);

  const hide = useCallback(() => setPos(null), []);

  return (
    <span className={cn('relative inline-flex', className)}>
      <button
        ref={triggerRef}
        type="button"
        className="inline-flex cursor-help items-center text-muted-foreground/60 transition-colors hover:text-muted-foreground focus-visible:text-muted-foreground focus-visible:outline-none"
        aria-label="More info"
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
      >
        <IconInfoCircle size={size} stroke={1.5} />
      </button>

      {pos &&
        createPortal(
          <div
            role="tooltip"
            className="fixed z-50 w-56 -translate-x-1/2 rounded-md border border-border bg-popover px-3 py-2 text-xs leading-relaxed text-popover-foreground shadow-md"
            style={{
              left: pos.left,
              ...(pos.above
                ? { top: pos.top, transform: 'translate(-50%, -100%) translateY(-6px)' }
                : { top: pos.top, transform: 'translate(-50%, 0) translateY(6px)' }),
            }}
          >
            {content}
          </div>,
          document.body,
        )}
    </span>
  );
}
