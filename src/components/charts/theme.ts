import { useSyncExternalStore } from 'react';
import type { PartialTheme } from '@nivo/theming';

// Hard-coded chart palette (same in light & dark mode)
export const CHART_COLORS = [
  '#8a3ffc',
  '#33b1ff',
  '#007d79',
  '#ff7eb6',
  '#4589ff',
  '#d12771',
  '#d2a106',
  '#08bdba',
  '#bae6ff',
  '#ba4e00',
  '#d4bbff',
  '#fa4d56',
  '#6fdc8c',
  '#fff1f1',
];

/**
 * Build a nivo theme that reads from CSS custom properties at call time.
 * Cached so useSyncExternalStore gets a stable reference.
 */
let cachedTheme: PartialTheme | null = null;

const serverSnapshot = () => null as PartialTheme | null;
const clientSnapshot = () => {
  if (!cachedTheme) cachedTheme = getNivoTheme();
  return cachedTheme;
};

const subscribe = (cb: () => void) => {
  // Invalidate cache when color scheme changes
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  const handler = () => {
    cachedTheme = null;
    cb();
  };
  mq.addEventListener('change', handler);
  return () => mq.removeEventListener('change', handler);
};

/**
 * Hook that safely provides the Nivo theme on the client.
 * Returns null during SSR; resolves after hydration.
 */
export function useNivoTheme(): PartialTheme | null {
  return useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot);
}

export function getNivoTheme(): PartialTheme {
  const s = getComputedStyle(document.documentElement);
  const fg = s.getPropertyValue('--foreground').trim();
  const muted = s.getPropertyValue('--muted-foreground').trim();
  const border = s.getPropertyValue('--border').trim();

  return {
    text: { fill: muted, fontSize: 11 },
    axis: {
      ticks: { text: { fill: muted, fontSize: 11 }, line: { stroke: border } },
      legend: { text: { fill: fg, fontSize: 12 } },
    },
    grid: { line: { stroke: border, strokeWidth: 0.5 } },
    crosshair: { line: { stroke: muted, strokeDasharray: '4 2' } },
    tooltip: {
      container: {
        background: 'var(--popover)',
        color: 'var(--popover-foreground)',
        borderRadius: '6px',
        border: '1px solid var(--border)',
        boxShadow: '0 4px 6px -1px rgb(0 0 0 / .1)',
        fontSize: '12px',
        padding: '6px 10px',
      },
    },
  };
}
