"use client";
import { Button } from "@/components/ui/button";

export default function ProductionError({ reset }: { reset: () => void }) {
  return <div role="alert" className="space-y-4 p-4 sm:p-8">
    <h2 className="text-lg font-semibold">Production & Quality could not be loaded</h2>
    <p>Please retry to load the latest production data.</p>
    <Button onClick={reset}>Retry</Button>
  </div>;
}
