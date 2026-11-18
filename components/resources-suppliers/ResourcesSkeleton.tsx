import { Skeleton } from "@/components/ui/skeleton";

export default function ResourcesSkeleton() {
  return (
    <div role="status" aria-label="Loading resources" className="page-container w-full bg-page space-y-6">
      <span className="sr-only">Loading resources…</span>
      <Skeleton className="h-8 w-64 max-w-full rounded-control" />
      <Skeleton className="h-5 w-96 max-w-full rounded-control" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[0, 1, 2].map(i => <Skeleton key={i} className="h-24 rounded-card" />)}
      </div>
      <Skeleton className="h-12 w-full rounded-control" />
      {[0, 1, 2, 3, 4].map(i => <Skeleton key={i} className="h-12 w-full rounded-control" />)}
    </div>
  );
}
