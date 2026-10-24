"use client";
import { useState } from "react";
import { uploadProductionImage } from "@/lib/production/image-client";

export function BatchProofField({ batchId, label, onChange }: { batchId: number; label: string; onChange: (id: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return <label className="block space-y-2 text-xs font-semibold">
    <span>{label}</span>
    <input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} className="block w-full text-xs"
      onChange={async event => {
        const file = event.target.files?.[0];
        onChange("");
        if (!file) return;
        setBusy(true); setError("");
        try { onChange(await uploadProductionImage("batch", batchId, file)); }
        catch (error) { setError(error instanceof Error ? error.message : "Upload failed. Please try again."); }
        finally { setBusy(false); }
      }} />
    {busy && <span role="status">Uploading photo…</span>}
    {error && <span role="alert" className="text-destructive">{error}</span>}
  </label>;
}
