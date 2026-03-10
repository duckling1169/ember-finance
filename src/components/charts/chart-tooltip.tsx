import type { ReactNode } from 'react';

const baseStyle: React.CSSProperties = {
  background: 'var(--popover)',
  color: 'var(--popover-foreground)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  padding: '6px 10px',
  fontSize: 12,
  boxShadow: '0 4px 6px -1px rgb(0 0 0 / .1)',
};

export function ChartTooltip({
  children,
  style,
}: {
  children: ReactNode;
  style?: React.CSSProperties;
}) {
  return <div style={{ ...baseStyle, ...style }}>{children}</div>;
}
