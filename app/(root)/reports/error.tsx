"use client";
import { Button } from "@/components/ui/button";
export default function ProcurementError({ reset }: { reset: () => void }) {
  return <div role="alert" className="space-y-4 p-6">
    <h2 className="text-xl font-semibold">This page could not be loaded</h2>
    <p className="text-muted-foreground">Please retry. If the problem continues, contact your administrator.</p>
    <Button onClick={reset}>Try again</Button>
  </div>;
}
