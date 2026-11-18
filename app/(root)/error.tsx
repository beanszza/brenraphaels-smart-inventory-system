"use client";

import { Button } from "@/components/ui/button";

export default function DashboardError({ reset }: { reset: () => void }) {
  return (
    <div role="alert" className="space-y-4 p-6 sm:p-8 text-ink">
      <h2 className="type-card-title text-ink font-semibold">This page could not be loaded</h2>
      <p className="type-body text-ink-secondary">Please retry to load the latest data.</p>
      <Button onClick={reset}>Retry</Button>
    </div>
  );
}
