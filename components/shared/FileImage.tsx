/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useState } from "react";
import { FILE_PLACEHOLDER } from "@/lib/files";
import { resolveFileUrl } from "@/lib/file-upload";

/**
 * Shows the image a record holds. `base` is the record's file route. Records whose file is
 * missing, and files that fail to load, show the placeholder. Change `version` to look it up again.
 */
export function FileImage({ base, alt, className, version = 0 }: { base: string; alt: string; className?: string; version?: number }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let current = true;
    resolveFileUrl(base).then((resolved) => current && setUrl(resolved));
    return () => {
      current = false;
    };
  }, [base, version]);

  if (!url) return <div className={className} aria-hidden />;
  return <img src={url} alt={alt} className={className} onError={() => setUrl(FILE_PLACEHOLDER)} />;
}
