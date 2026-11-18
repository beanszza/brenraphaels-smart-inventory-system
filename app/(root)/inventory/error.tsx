"use client";

import { Button } from "@/components/ui/button";

export default function InventoryError({ reset }: { reset: () => void }) {
  return (
    <div role="alert" className="page-container space-y-4">
      <h2 className="type-card-title text-ink">Inventory could not be loaded</h2>
      <p className="type-body text-ink-muted">Please retry to load the latest inventory.</p>
      <Button onClick={reset}>Retry</Button>
    </div>
  );
}
