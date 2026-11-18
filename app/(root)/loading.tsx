import { DashboardSkeleton } from "@/components/dashboard/DashboardSkeleton";

export default function Loading() {
  return (
    <div className="w-full bg-page">
      <DashboardSkeleton />
    </div>
  );
}
