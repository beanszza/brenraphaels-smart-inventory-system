"use client";

import React, { useState, useEffect } from "react";
import { FileText } from "lucide-react";
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

  const boxSize = size === "small" ? "size-10" : "size-14";

  return (
    <div className="rounded-control border border-input bg-page px-3 py-2.5 flex items-center gap-3">
      <div
        className={`${boxSize} rounded-control border border-border bg-surface overflow-hidden flex items-center justify-center shrink-0`}
      >
        {isImage ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={displaySrc}
            alt={title}
            onClick={() => onPreview?.({ title, src: displaySrc })}
            className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
          />
        ) : (
          <FileText className="w-4 h-4 text-primary" />
        )}
      </div>
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="type-body-secondary font-medium text-ink truncate">{title}</p>
        {subtitle && (
          <p className="type-caption text-ink-muted truncate">{subtitle}</p>
        )}
      </div>
      {isImage && onPreview && (
        <button
          type="button"
          onClick={() => onPreview({ title, src: displaySrc })}
          className="type-body-secondary font-medium text-primary hover:underline shrink-0 cursor-pointer"
        >
          Preview
        </button>
      )}
    </div>
  );
}
