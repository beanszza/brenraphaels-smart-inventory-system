import { Skeleton } from "@/components/ui/skeleton";

/** The skeleton shown while moving between IMS pages, used by every route's loading file. */
export function PageLoading() {
  return (
    <div role="status" aria-label="Loading page" className="p-5 sm:p-6 space-y-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-10 w-full max-w-md" />
      <div className="space-y-2">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    </div>
  );
}
