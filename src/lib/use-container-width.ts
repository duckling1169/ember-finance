'use client';

import { useEffect, useState } from 'react';

/**
 * Observes an element's width via ResizeObserver.
 *
 * Returns a callback ref to attach to the element and the current width
 * (null until first measurement, e.g. during SSR / before mount).
 */
export function useContainerWidth<T extends HTMLElement>() {
  const [element, setElement] = useState<T | null>(null);
  const [width, setWidth] = useState<number | null>(null);

  useEffect(() => {
    if (!element) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setWidth(entry.contentRect.width);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [element]);

  return { ref: setElement, width };
}
