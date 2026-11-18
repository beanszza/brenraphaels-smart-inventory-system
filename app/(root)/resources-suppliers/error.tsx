"use client";

import { Button } from "@/components/ui/button";

export default function ResourcesError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div role="alert" className="page-container space-y-4">
      <h1 className="type-card-title text-ink">Unable to load Resources & Suppliers</h1>
      <p className="type-body text-ink-muted">{error?.message || "Please try again."}</p>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
