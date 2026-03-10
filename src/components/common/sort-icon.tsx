import { IconArrowsSort, IconSortAscending, IconSortDescending } from '@tabler/icons-react';

export type SortDir = 'asc' | 'desc';

export function SortIcon<T extends string>({
  field,
  sortKey,
  sortDir,
}: {
  field: T;
  sortKey: T | null;
  sortDir: SortDir;
}) {
  if (sortKey !== field) return <IconArrowsSort size={14} className="text-muted-foreground/50" />;
  return sortDir === 'asc' ? <IconSortAscending size={14} /> : <IconSortDescending size={14} />;
}
