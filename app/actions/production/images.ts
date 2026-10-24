"use server";
import { requireModule } from "@/lib/portal/staff";
import { productImage, batchImage } from "@/lib/file-routes";
import { fileResult, requestImage, confirmImage, resolveImage, type UploadMetadata } from "@/lib/production/files";
export async function requestProductImageUpload(id: number, meta: UploadMetadata) {
    const staff = await requireModule("Production & Quality");
    return fileResult(() => requestImage(staff, productImage, id, meta));
}
export async function confirmProductImageUpload(id: number, fileId: string) {
    const staff = await requireModule("Production & Quality");
    return fileResult(() => confirmImage(staff, productImage, id, fileId));
}
export async function resolveProductImage(id: number) {
    const staff = await requireModule("Production & Quality");
    return fileResult(() => resolveImage(staff, productImage, id));
}
export async function requestBatchImageUpload(id: number, meta: UploadMetadata) {
    const staff = await requireModule("Production & Quality");
    return fileResult(() => requestImage(staff, batchImage, id, meta));
}
export async function confirmBatchImageUpload(id: number, fileId: string) {
    const staff = await requireModule("Production & Quality");
    return fileResult(() => confirmImage(staff, batchImage, id, fileId));
}
export async function resolveBatchImage(id: number) {
    const staff = await requireModule("Production & Quality");
    return fileResult(() => resolveImage(staff, batchImage, id));
}
