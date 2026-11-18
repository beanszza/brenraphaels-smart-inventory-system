import { Skeleton } from "@/components/ui/skeleton";

export function ProductionSkeleton() {
  return (
    <div role="status" aria-label="Loading Production & Quality" className="w-full space-y-4 page-container p-6">
      <Skeleton className="h-8 w-56 rounded-control" />
      <Skeleton className="h-10 w-full rounded-control" />
      {Array.from({ length: 5 }, (_, index) => (
        <Skeleton key={index} className="h-12 w-full rounded-control" />
      ))}
    </div>
  );
}
