import { Skeleton } from "@/components/ui/skeleton";

export function TransferSkeleton() {
  return <div role="status" aria-label="Loading Stock Transfer" className="space-y-4">
    <div aria-hidden="true" className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {[0, 1, 2].map(key => <Skeleton key={key} className="h-24 rounded-xl" />)}
    </div>
    <div aria-hidden="true" className="space-y-4 rounded-xl border border-border p-4">
      <Skeleton className="h-10 w-full" />
      {[0, 1, 2, 3, 4].map(key => <Skeleton key={key} className="h-12 w-full" />)}
    </div>
  </div>;
}
