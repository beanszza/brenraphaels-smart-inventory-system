"use client";
import { Button } from "@/components/ui/button";
export default function TransferError({ reset }: { reset: () => void }) {
  return (
    <div role="alert" className="space-y-4 p-4 sm:p-8">
      <h2 className="type-card-title text-text-primary">Stock Transfer could not be loaded</h2>
      <p className="type-body text-text-muted">Please retry to load the latest data.</p>
      <Button onClick={reset} className="type-button">Retry</Button>
    </div>
  );
}
