import {
  resolveProductImage,
  resolveBatchImage,
  uploadBatchImageDirect,
  uploadProductImageDirect,
} from "@/app/actions/production/images";
import type { ImageVariant } from "@/lib/gateway/files";
import { FILE_PLACEHOLDER } from "@/lib/files";

export async function uploadProductionImage(kind: "product" | "batch", id: number, file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);

  const res =
    kind === "batch"
      ? await uploadBatchImageDirect(id, formData)
      : await uploadProductImageDirect(id, formData);

  if (res.success && res.data?.fileId) {
    return res.data.fileId;
  }

  throw new Error(res.message || "Upload failed. Please try again.");
}

export async function resolveProductionImage(kind: "product" | "batch", id: number, variant?: ImageVariant) {
  try {
    const result = await (kind === "product" ? resolveProductImage(id, variant) : resolveBatchImage(id, variant));
    return result.success ? (result.data.url as string) : FILE_PLACEHOLDER;
  } catch {
    return FILE_PLACEHOLDER;
  }
}
