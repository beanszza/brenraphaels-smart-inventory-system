import { Skeleton } from "@/components/ui/skeleton";

export function ReceivingSkeleton() {
  return <div role="status" aria-label="Loading Goods Receiving" className="min-w-0 space-y-4 rounded-xl border border-border bg-card p-4">
    <span className="sr-only">Loading Goods Receiving...</span>
    <div className="flex flex-wrap gap-3"><Skeleton className="h-10 w-48" /><Skeleton className="h-10 w-32" /></div>
    {Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className="h-12 w-full" />)}
  </div>;
}
