import { uploadWith } from "@/lib/file-upload";
import { actionResponse } from "@/lib/resources/action-response";
import { requestProductImageUpload, confirmProductImageUpload, resolveProductImage, requestBatchImageUpload, confirmBatchImageUpload, resolveBatchImage } from "@/app/actions/production/images";
import { FILE_PLACEHOLDER } from "@/lib/files";

export function uploadProductionImage(kind: "product" | "batch", id: number, file: File) {
  const request = kind === "product" ? requestProductImageUpload : requestBatchImageUpload;
  const confirm = kind === "product" ? confirmProductImageUpload : confirmBatchImageUpload;
  return uploadWith({
    request: async meta => (await actionResponse(request(id, meta))).data.data,
    confirm: async fileId => { await actionResponse(confirm(id, fileId)); },
  }, file);
}
export async function resolveProductionImage(kind: "product" | "batch", id: number) {
  try {
    const result = await (kind === "product" ? resolveProductImage(id) : resolveBatchImage(id));
    return result.success ? result.data.url as string : FILE_PLACEHOLDER;
  } catch { return FILE_PLACEHOLDER; }
}
