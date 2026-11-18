import { Skeleton } from "@/components/ui/skeleton";

/** Shown while the logs page waits for audit events from the gateway. */
export function AuditLogsSkeleton() {
  return (
    <div role="status" aria-label="Loading audit logs" className="p-5 sm:p-6 space-y-4">
      <Skeleton className="h-8 w-72" />
      <Skeleton className="h-4 w-96 max-w-full" />
      <Skeleton className="h-12 w-full" />
      <div className="space-y-2 rounded-card border border-divider p-2 bg-surface">
        {Array.from({ length: 10 }, (_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    </div>
  );
}
