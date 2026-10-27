import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function DashboardSkeleton() {
  return (
    <div role="status" aria-label="Loading Dashboard" className="min-w-0 w-full space-y-5 p-4 sm:px-8 sm:py-7">
      <span className="sr-only">Loading Dashboard...</span>
      <div aria-hidden="true" className="space-y-2">
        <Skeleton className="h-8 w-36" />
        <Skeleton className="h-5 w-full max-w-64" />
      </div>
      <div aria-hidden="true" className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <Card key={index} className="min-w-0 shadow-none">
            <CardHeader className="p-5">
              <Skeleton className="h-6 w-full max-w-48" />
            </CardHeader>
            <CardContent className="space-y-4 px-5 pb-5">
              {[0, 1].map((row) => (
                <div key={row} className="flex items-center justify-between gap-4">
                  <Skeleton className="h-5 w-36 max-w-full" />
                  <Skeleton className="h-8 w-10 shrink-0" />
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
