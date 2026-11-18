"use client";
import { Button } from "@/components/ui/button";
export default function ReceivingError({ reset }: { reset: () => void }) {
  return (
    <div role="alert" className="space-y-4 p-4 sm:p-8">
      <h1 className="type-card-title text-text-primary">Goods Receiving could not be loaded</h1>
      <p className="type-body text-text-muted">Please try again. If this continues, contact your administrator.</p>
      <Button onClick={reset} className="rounded-control bg-button-primary text-text-inverse hover:bg-button-primary-hover type-label-button">Try again</Button>
    </div>
  );
}
