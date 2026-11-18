"use client";
import { Button } from "@/components/ui/button";

export default function ProductionError({ reset }: { reset: () => void }) {
  return (
    <div role="alert" className="p-6 page-container space-y-4">
      <h2 className="type-section-title font-semibold text-text-primary">Production & Quality could not be loaded</h2>
      <p className="type-body text-text-muted">Please retry to load the latest production data.</p>
      <Button
        onClick={reset}
        className="rounded-control bg-button-primary text-text-inverse px-5 py-2.5 type-body font-semibold hover:bg-button-primary/85 shadow-card"
      >
        Retry
      </Button>
    </div>
  );
}
