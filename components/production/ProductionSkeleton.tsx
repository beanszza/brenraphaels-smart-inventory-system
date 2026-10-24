import { Skeleton } from "@/components/ui/skeleton";

export function ProductionSkeleton() {
  return <div role="status" aria-label="Loading Production & Quality" className="w-full space-y-4 p-4">
    <Skeleton className="h-8 w-56" />
    <Skeleton className="h-10 w-full" />
    {Array.from({ length: 5 }, (_, index) => <Skeleton key={index} className="h-12 w-full" />)}
  </div>;
}
