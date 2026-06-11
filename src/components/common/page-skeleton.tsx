import { Skeleton } from '@/components/ui/skeleton';

/** Generic page-level loading state: title bar + content blocks. */
export function PageSkeleton({ rows = 2 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      <Skeleton className="h-8 w-48" />
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-48 w-full rounded-lg" />
      ))}
    </div>
  );
}
