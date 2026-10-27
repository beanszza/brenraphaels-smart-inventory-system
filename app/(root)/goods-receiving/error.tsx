"use client";
import { Button } from "@/components/ui/button";
export default function ReceivingError({ reset }: { reset: () => void }) {
  return <div role="alert" className="space-y-4 p-4 sm:p-8">
    <h1 className="text-xl font-semibold">Goods Receiving could not be loaded</h1>
    <p className="text-muted-foreground">Please try again. If this continues, contact your administrator.</p>
    <Button onClick={reset}>Try again</Button>
  </div>;
}
