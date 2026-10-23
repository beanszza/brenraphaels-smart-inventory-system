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
  const [url, setUrl] = useState<string>(FILE_PLACEHOLDER);

  useEffect(() => {
    let current = true;
    resolveFileUrl(base).then((resolved) => current && setUrl(resolved));
    return () => {
      current = false;
    };
  }, [base, version]);

  // Falling back only when not already on the placeholder, so a broken placeholder cannot retry forever.
  return <img src={url} alt={alt} className={className} onError={() => url !== FILE_PLACEHOLDER && setUrl(FILE_PLACEHOLDER)} />;
}
