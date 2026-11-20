/* eslint-disable @next/next/no-img-element */
"use client";
import { useEffect, useState } from "react";
import { resolveProductionImage } from "@/lib/production/image-client";
import type { ImageVariant } from "@/lib/gateway/files";
import { FILE_PLACEHOLDER } from "@/lib/files";

export function ProductionImage({ kind, id, alt, className, version = 0, variant = "small" }: {
  kind: "product" | "batch"; id: number; alt: string; className?: string; version?: number; variant?: ImageVariant;
}) {
  const [url, setUrl] = useState<string>(FILE_PLACEHOLDER);
  useEffect(() => {
    let current = true;
    resolveProductionImage(kind, id, variant).then(value => {
      if (!current) return;
      const resolved =
        version > 0 && kind === "product" && value && value !== FILE_PLACEHOLDER && !value.startsWith("data:")
          ? `${value}${value.includes("?") ? "&" : "?"}v=${version}`
          : value;
      setUrl(resolved);
    });
    return () => { current = false; };
  }, [kind, id, version, variant]);
  return <img src={url} alt={alt} className={className} onError={() => { if (url !== FILE_PLACEHOLDER) setUrl(FILE_PLACEHOLDER); }} />;
}
