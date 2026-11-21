import { Skeleton } from "@/components/ui/skeleton";

export function DashboardSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading Dashboard"
      className="page-container px-4 sm:px-8 min-w-0 w-full space-y-5"
    >
      <span className="sr-only">Loading Dashboard...</span>

      <div aria-hidden="true" className="flex items-center justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-4 w-64 max-w-full" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-36 rounded-control" />
          <Skeleton className="h-8 w-20 rounded-control" />
        </div>
      </div>

      <div aria-hidden="true" className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        {Array.from({ length: 4 }, (_, idx) => (
          <div
            key={idx}
            className="rounded-card border border-border bg-surface px-5 py-4 space-y-2"
          >
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-7 w-16" />
            <Skeleton className="h-3.5 w-32" />
          </div>
        ))}
      </div>

      <div aria-hidden="true" className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        <div className="xl:col-span-7 rounded-card border border-border bg-surface p-5 space-y-4">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-5 w-64" />
          <Skeleton className="h-48 w-full rounded-inner" />
        </div>
        <div className="xl:col-span-5 rounded-card border border-border bg-surface p-5 space-y-4">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-5 w-56" />
          <div className="space-y-3">
            {[0, 1, 2, 3].map((row) => (
              <Skeleton key={row} className="h-10 w-full rounded-control" />
            ))}
          </div>
        </div>
      </div>

      <div aria-hidden="true" className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {[0, 1, 2].map((col) => (
          <div
            key={col}
            className="rounded-card border border-border bg-surface p-5 space-y-3"
          >
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-5 w-52" />
            {[0, 1, 2].map((row) => (
              <Skeleton key={row} className="h-6 w-full rounded-control" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
