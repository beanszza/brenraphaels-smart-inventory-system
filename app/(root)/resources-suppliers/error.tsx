"use client";

import { Button } from "@/components/ui/button";

export default function ResourcesError({ reset }: { reset: () => void }) {
  return (
    <div role="alert" className="space-y-4 p-6 sm:p-8">
      <h1 className="text-xl font-semibold">Unable to load Resources & Suppliers</h1>
      <p className="text-muted-foreground">Please try again.</p>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
