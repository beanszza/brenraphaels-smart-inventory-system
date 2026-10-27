/* eslint-disable @next/next/no-img-element */
"use client";
import { useEffect, useState } from "react";
import { resolveProductionImage } from "@/lib/production/image-client";
import { FILE_PLACEHOLDER } from "@/lib/files";

export function ProductionImage({ kind, id, alt, className, version = 0 }: {
  kind: "product" | "batch"; id: number; alt: string; className?: string; version?: number;
}) {
  const [url, setUrl] = useState<string>(FILE_PLACEHOLDER);
  useEffect(() => {
    let current = true;
    resolveProductionImage(kind, id).then(value => { if (current) setUrl(value); });
    return () => { current = false; };
  }, [kind, id, version]);
  return <img src={url} alt={alt} className={className} onError={() => { if (url !== FILE_PLACEHOLDER) setUrl(FILE_PLACEHOLDER); }} />;
}
