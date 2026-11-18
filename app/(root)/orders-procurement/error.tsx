"use client";
import { Button } from "@/components/ui/button";
export default function ProcurementError({ reset }: { reset: () => void }) {
  return (
    <div role="alert" className="space-y-4 p-6">
      <h2 className="type-card-title font-semibold text-text-primary">This page could not be loaded</h2>
      <p className="type-body text-text-muted">Please retry. If the problem continues, contact your administrator.</p>
      <Button onClick={reset} className="rounded-control type-label-button bg-button-primary text-text-inverse hover:bg-button-primary-hover">Try again</Button>
    </div>
  );
}
