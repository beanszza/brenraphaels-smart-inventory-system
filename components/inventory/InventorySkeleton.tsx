import { Skeleton } from "@/components/ui/skeleton";

export function InventorySkeleton({ compact = false }: { compact?: boolean }) {
  return <div role="status" aria-label="Loading Inventory" className="min-w-0 space-y-4">
    <span className="sr-only">Loading Inventory...</span>
    {!compact && <><Skeleton className="h-9 w-56" />
      <div className="grid gap-4 md:grid-cols-3">{[0, 1, 2].map(i => <Skeleton key={i} className="h-36 w-full" />)}</div>
      <Skeleton className="h-10 w-full" /></>}
    <div className="space-y-3 rounded-xl border border-border bg-card p-4">
      {Array.from({ length: compact ? 3 : 6 }, (_, i) => <Skeleton key={i} className="h-10 w-full" />)}
    </div>
  </div>;
}
