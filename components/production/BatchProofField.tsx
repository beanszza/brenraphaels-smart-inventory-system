"use client";

import { useState } from "react";
import { Upload, Trash2, Loader2, AlertCircle } from "lucide-react";
import { uploadProductionImage } from "@/lib/production/image-client";

export function BatchProofField({
  batchId,
  label,
  onChange,
}: {
  batchId: number;
  label: string;
  onChange: (id: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [fileName, setFileName] = useState<string>("");

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check size limit: 8MB
    if (file.size > 8 * 1024 * 1024) {
      setError("File size exceeds 8MB limit.");
      return;
    }

    setBusy(true);
    setError("");
    const localPreview = URL.createObjectURL(file);
    setPreviewUrl(localPreview);
    setFileName(file.name);

    try {
      const fileId = await uploadProductionImage("batch", batchId, file);
      onChange(fileId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed. Please try again.");
      setPreviewUrl("");
      setFileName("");
      onChange("");
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = () => {
    setPreviewUrl("");
    setFileName("");
    setError("");
    onChange("");
  };

  return (
    <div className="space-y-1.5">
      <span className="text-xs font-semibold text-foreground">{label}</span>
      <div className="border-2 border-dashed border-border rounded-xl p-4 bg-muted/10 transition-colors">
        {busy ? (
          <div className="flex flex-col items-center justify-center py-6 text-muted-foreground gap-2">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
            <span className="text-xs font-medium text-foreground">Uploading proof photo...</span>
            <span className="text-[11px] text-muted-foreground">Please wait while the image is being confirmed.</span>
          </div>
        ) : previewUrl ? (
          <div className="space-y-3">
            <div className="flex flex-col items-center justify-center p-2 bg-card rounded-lg border border-border">
              <img
                src={previewUrl}
                alt="Proof of packaging"
                className="max-h-56 rounded-lg object-contain border border-border shadow-xs"
              />
              <p className="mt-2 text-[11px] font-mono text-muted-foreground truncate max-w-xs text-center">
                {fileName || "packaging-proof.jpg"}
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <label className="cursor-pointer text-xs font-semibold px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-muted text-foreground transition-colors flex items-center gap-1.5">
                <Upload className="w-3.5 h-3.5" />
                Change File
                <input
                  type="file"
                  accept="image/*"
                  onClick={(e) => { (e.target as HTMLInputElement).value = ""; }}
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
              <button
                type="button"
                onClick={handleRemove}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-destructive/30 text-destructive hover:bg-destructive/10 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Remove
              </button>
            </div>
          </div>
        ) : (
          <label className="flex flex-col items-center justify-center cursor-pointer py-5 hover:bg-muted/30 rounded-xl transition-colors">
            <Upload className="w-6 h-6 text-muted-foreground mb-2" />
            <span className="text-xs font-medium text-foreground">
              Click to upload packaging proof photo <span className="text-destructive">*</span>
            </span>
            <span className="text-[11px] text-muted-foreground mt-0.5">
              JPG, PNG, WebP up to 8MB
            </span>
            <input
              type="file"
              accept="image/*"
              onClick={(e) => { (e.target as HTMLInputElement).value = ""; }}
              onChange={handleFileChange}
              className="hidden"
            />
          </label>
        )}
      </div>
      {error && (
        <p className="text-xs text-destructive font-medium flex items-center gap-1.5 mt-1">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}
