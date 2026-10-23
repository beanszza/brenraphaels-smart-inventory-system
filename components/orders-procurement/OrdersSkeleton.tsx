import { Skeleton } from "@/components/ui/skeleton";
export function OrdersSkeleton() {
  return <div role="status" aria-label="Loading procurement" className="space-y-5 p-4 sm:p-8">
    <span className="sr-only">Loading?</span>
    <Skeleton className="h-8 w-64" /><Skeleton className="h-4 w-3/4" />
    <div className="flex gap-3">{[1,2,3].map(i => <Skeleton key={i} className="h-10 w-32" />)}</div>
    <div className="space-y-3 rounded-xl border border-border p-4">{[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
  </div>;
}
