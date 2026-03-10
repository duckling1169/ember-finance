import { IconArrowUpRight, IconArrowDownRight } from '@tabler/icons-react';
import { fmt } from '@/lib/formatters';

export function GainCell({ value }: { value: number }) {
  const color = value > 0 ? 'text-gain' : value < 0 ? 'text-loss' : 'text-muted-foreground';
  const prefix = value > 0 ? '+' : '';
  return (
    <span className={`font-mono tabular-nums ${color}`}>
      {prefix}
      {fmt(value)}
    </span>
  );
}

export function PctCell({ value }: { value: number }) {
  if (value === 0)
    return <span className="font-mono tabular-nums text-muted-foreground">&mdash;</span>;
  const color = value > 0 ? 'text-gain' : 'text-loss';
  const prefix = value > 0 ? '+' : '';
  const Icon = value > 0 ? IconArrowUpRight : IconArrowDownRight;
  return (
    <span className={`inline-flex items-center gap-1 font-mono tabular-nums ${color}`}>
      <Icon size={14} />
      {prefix}
      {value.toFixed(1)}%
    </span>
  );
}

export function ChangeIndicator({ value, label }: { value: number; label: string }) {
  const color = value > 0 ? 'text-gain' : value < 0 ? 'text-loss' : 'text-muted-foreground';
  const prefix = value > 0 ? '+' : '';
  const Icon = value > 0 ? IconArrowUpRight : IconArrowDownRight;
  return (
    <span className={`inline-flex items-center gap-1 text-sm font-mono tabular-nums ${color}`}>
      {value !== 0 && <Icon size={14} />}
      {prefix}
      {value.toFixed(1)}% {label}
    </span>
  );
}
