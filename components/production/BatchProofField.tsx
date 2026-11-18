"use client";

import { useState } from "react";
import { Upload, Trash2, Loader2, AlertCircle } from "lucide-react";
import { removeBatchImage } from "@/app/actions/production/images";
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

    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      setPreviewUrl(dataUrl);
      setFileName(file.name);

      try {
        const fileId = await uploadProductionImage("batch", batchId, file);
        onChange(fileId || dataUrl);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed. Please try again.");
        setPreviewUrl("");
        setFileName("");
        onChange("");
      } finally {
        setBusy(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemove = async () => {
    setBusy(true);
    setError("");
    try {
      const result = await removeBatchImage(batchId);
      if (!result.success) throw new Error(result.message || "The image could not be removed.");
      setPreviewUrl("");
      setFileName("");
      onChange("");
    } catch (error) {
      setError(error instanceof Error ? error.message : "The image could not be removed.");
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-1.5">
      <span className="type-table-header text-text-primary">{label}</span>
      <div className="border-2 border-dashed border-divider rounded-control p-4 bg-surface-secondary/30 transition-colors">
        {busy ? (
          <div className="flex flex-col items-center justify-center py-6 text-text-muted gap-2">
            <Loader2 className="w-6 h-6 text-brand animate-spin" />
            <span className="type-caption font-medium text-text-primary">Uploading proof photo...</span>
            <span className="type-caption text-text-muted">Please wait while the image is being confirmed.</span>
          </div>
        ) : previewUrl ? (
          <div className="space-y-3">
            <div className="flex flex-col items-center justify-center p-2 bg-surface rounded-control border border-divider">
              <img
                src={previewUrl}
                alt="Proof of packaging"
                className="max-h-56 rounded-control object-contain border border-divider shadow-card"
              />
              <p className="mt-2 type-caption text-text-muted truncate max-w-xs text-center">
                {fileName || "packaging-proof.jpg"}
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <label className="cursor-pointer type-caption font-semibold px-3 py-1.5 rounded-control border border-divider bg-surface hover:bg-surface-hover text-text-primary transition-colors flex items-center gap-1.5">
                <Upload className="w-3.5 h-3.5" />
                Change File
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/*"
                  onClick={(e) => { (e.target as HTMLInputElement).value = ""; }}
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
              <button
                type="button"
                onClick={handleRemove}
                className="type-caption font-semibold px-3 py-1.5 rounded-control border border-status-danger/30 text-status-danger hover:bg-status-danger/10 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Remove
              </button>
            </div>
          </div>
        ) : (
          <label className="flex flex-col items-center justify-center cursor-pointer py-5 hover:bg-surface-secondary rounded-control transition-colors">
            <Upload className="w-6 h-6 text-text-muted mb-2" />
            <span className="type-caption font-medium text-text-primary">
              Click to upload packaging proof photo <span className="text-status-danger">*</span>
            </span>
            <span className="type-caption text-text-muted mt-0.5">
              JPG, PNG, WebP up to 8MB
            </span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/*"
              onClick={(e) => { (e.target as HTMLInputElement).value = ""; }}
              onChange={handleFileChange}
              className="hidden"
            />
          </label>
        )}
      </div>
      {error && (
        <p className="type-caption text-status-danger font-medium flex items-center gap-1.5 mt-1">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}
