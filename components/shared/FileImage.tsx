/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useState } from "react";
import type { ImageVariant } from "@/lib/gateway/files";
import { FILE_PLACEHOLDER } from "@/lib/files";
import { resolveFileUrl } from "@/lib/file-upload";

/**
 * Shows the image a record holds. `base` is the record's file route. Records whose file is
 * missing, and files that fail to load, show the placeholder. Change `version` to look it up again.
 */
export function FileImage({ base, alt, className, version = 0, variant = "small" }: { base: string; alt: string; className?: string; version?: number; variant?: ImageVariant }) {
  const [url, setUrl] = useState<string>(FILE_PLACEHOLDER);

  useEffect(() => {
    let current = true;
    resolveFileUrl(`${base}${base.includes("?") ? "&" : "?"}variant=${variant}`).then((resolved) => current && setUrl(resolved));
    return () => {
      current = false;
    };
  }, [base, version, variant]);

  // Falling back only when not already on the placeholder, so a broken placeholder cannot retry forever.
  return <img src={url} alt={alt} className={className} onError={() => url !== FILE_PLACEHOLDER && setUrl(FILE_PLACEHOLDER)} />;
}
