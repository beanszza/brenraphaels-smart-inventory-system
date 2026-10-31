import {
  requestProductImageUpload,
  confirmProductImageUpload,
  resolveProductImage,
  requestBatchImageUpload,
  confirmBatchImageUpload,
  resolveBatchImage,
  uploadBatchImageDirect,
  uploadProductImageDirect,
} from "@/app/actions/production/images";
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

export async function resolveProductionImage(kind: "product" | "batch", id: number) {
  try {
    const result = await (kind === "product" ? resolveProductImage(id) : resolveBatchImage(id));
    return result.success ? (result.data.url as string) : FILE_PLACEHOLDER;
  } catch {
    return FILE_PLACEHOLDER;
  }
}
