"use client";

import React, { useRef, useState } from "react";
import { Upload, FileText, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface FileUploadFieldProps {
  label: string;
  helperText?: string;
  value?: string;
  onChange: (fileInfo: { fileName: string; fileUrl?: string }) => void;
  accept?: string;
}

export function FileUploadField({
  label,
  helperText = "Upload PDF, scanned waybill, or photo receipt",
  value,
  onChange,
  accept = ".pdf,.jpg,.jpeg,.png,.doc,.docx",
}: FileUploadFieldProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string>(value || "");
  const [fileSize, setFileSize] = useState<string>("");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFileName(file.name);
      const sizeKB = Math.round(file.size / 1024);
      setFileSize(sizeKB > 1024 ? `${(sizeKB / 1024).toFixed(1)} MB` : `${sizeKB} KB`);

      const reader = new FileReader();
      reader.onload = () => {
        const base64Data = reader.result as string;
        onChange({ fileName: file.name, fileUrl: base64Data });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemove = () => {
    setFileName("");
    setFileSize("");
    if (fileInputRef.current) fileInputRef.current.value = "";
    onChange({ fileName: "", fileUrl: "" });
  };

  return (
    <div className="space-y-1.5">
      <label className="type-label font-semibold text-text-primary">{label}</label>
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        onChange={handleFileChange}
        className="hidden"
      />

      {fileName ? (
        <div className="flex items-center justify-between p-3 rounded-control border border-divider bg-surface-muted">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-control bg-surface border border-divider flex items-center justify-center shrink-0">
              <FileText className="w-4 h-4 text-text-primary" />
            </div>
            <div className="min-w-0">
              <div className="type-body font-medium text-text-primary truncate">{fileName}</div>
              {fileSize && <div className="type-caption text-text-muted">{fileSize}</div>}
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleRemove}
            className="h-7 w-7 rounded-control text-text-muted hover:text-text-primary cursor-pointer"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            className="rounded-control border border-divider bg-surface px-4 py-2 type-label-button font-semibold text-text-primary hover:bg-surface-hover transition-colors flex items-center gap-2 cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5 text-text-primary" />
            Upload Document
          </Button>
          <span className="type-caption text-text-muted">{helperText}</span>
        </div>
      )}
    </div>
  );
}
