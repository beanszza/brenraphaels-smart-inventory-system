"use client";

import { Button } from "@/components/ui/button";

export default function InventoryError({ reset }: { reset: () => void }) {
  return <div role="alert" className="space-y-4 p-4 sm:p-8">
    <h2 className="text-xl font-semibold">Inventory could not be loaded</h2>
    <p>Please retry to load the latest inventory.</p>
    <Button onClick={reset}>Retry</Button>
  </div>;
}
