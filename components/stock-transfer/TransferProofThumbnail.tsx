"use client";

import React, { useState, useEffect } from "react";
import { FileText, ExternalLink } from "lucide-react";
import { isFileId } from "@/lib/files";
import { resolveTransferAttachment } from "@/app/actions/stock-transfer/transfer-files";

interface TransferProofThumbnailProps {
  rawSrc?: string | null;
  title: string;
  subtitle?: string;
  onPreview?: (item: { title: string; src: string }) => void;
  size?: "small" | "medium";
}

export function TransferProofThumbnail({
  rawSrc,
  title,
  subtitle,
  onPreview,
  size = "medium",
}: TransferProofThumbnailProps) {
  const [resolvedUrl, setResolvedUrl] = useState<string>("");

  useEffect(() => {
    let active = true;
    if (!rawSrc) {
      setResolvedUrl("");
      return;
    }

    const trimmed = rawSrc.trim();
    if (trimmed.startsWith("data:") || trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
      setResolvedUrl(trimmed);
    } else if (isFileId(trimmed)) {
      resolveTransferAttachment(trimmed)
        .then((res) => {
          if (active && res.data?.url) {
            setResolvedUrl(res.data.url);
          }
        })
        .catch(() => {});
    }

    return () => {
      active = false;
    };
  }, [rawSrc]);

  if (!rawSrc) return null;

  const displaySrc = resolvedUrl || rawSrc;
  const isImage =
    displaySrc.startsWith("data:image/") ||
    displaySrc.match(/\.(jpeg|jpg|png|webp)($|\?)/i) ||
    displaySrc.includes("/files/");

  const boxSize = size === "small" ? "w-16 h-16" : "w-20 h-20";

  return (
    <div className="rounded-panel border border-divider bg-surface p-3 flex items-center gap-3">
      <div
        className={`${boxSize} rounded-control border border-divider bg-surface-hover overflow-hidden flex items-center justify-center shrink-0`}
      >
        {isImage ? (
          <img
            src={displaySrc}
            alt={title}
            onClick={() => onPreview?.({ title, src: displaySrc })}
            className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
          />
        ) : (
          <FileText className="w-6 h-6 text-text-muted" />
        )}
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <p className="type-caption font-semibold text-text-primary truncate">{title}</p>
        {subtitle && (
          <p className="type-caption text-text-muted truncate">{subtitle}</p>
        )}
        {isImage && onPreview && (
          <button
            type="button"
            onClick={() => onPreview({ title, src: displaySrc })}
            className="type-caption font-semibold text-primary hover:underline inline-flex items-center gap-1 cursor-pointer"
          >
            <ExternalLink className="w-3 h-3" /> View Full Image
          </button>
        )}
      </div>
    </div>
  );
}
