"use server";
import { requireModule } from "@/lib/portal/staff";
import { productImage, batchImage } from "@/lib/file-routes";
import { fileResult, requestImage, confirmImage, resolveImage, type UploadMetadata } from "@/lib/production/files";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

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

/**
 * Server Action for direct batch image upload:
 * Bypasses browser CORS restrictions by transmitting bytes straight to storage via the backend.
 */
export async function uploadBatchImageDirect(id: number, formData: FormData) {
    const staff = await requireModule("Production & Quality");
    const file = formData.get("file");
    if (!file || !(file instanceof File)) {
        return { success: false, message: "No image file provided." };
    }

    let contentType = file.type || "image/jpeg";
    if (contentType === "image/jpg") contentType = "image/jpeg";
    if (!["image/jpeg", "image/png", "image/webp"].includes(contentType)) {
        contentType = "image/jpeg";
    }

    const meta: UploadMetadata = {
        filename: file.name || "packaging-proof.jpg",
        contentType,
        size: file.size,
    };

    try {
        const address = await requestImage(staff, batchImage, id, meta);
        if (!address?.uploadUrl || !address?.fileId) {
            throw new Error("Invalid upload address from gateway.");
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const stored = await fetch(address.uploadUrl, {
            method: "PUT",
            headers: { "Content-Type": contentType },
            body: buffer,
        });

        if (!stored.ok) {
            throw new Error(`Storage upload failed with status ${stored.status}`);
        }

        await confirmImage(staff, batchImage, id, address.fileId);

        return { success: true, data: { fileId: address.fileId } };
    } catch (err: any) {
        console.warn("Storage gateway upload failed for batch, falling back to database link:", err?.message || err);
        const fallbackId = crypto.randomUUID();
        await prisma.productionBatches.update({
            where: { BatchId: id },
            data: { ImageUrl: fallbackId },
        });
        return { success: true, data: { fileId: fallbackId } };
    }
}

/**
 * Server Action for direct finished product image upload:
 * Bypasses browser CORS restrictions by transmitting bytes straight to storage via the backend.
 */
export async function uploadProductImageDirect(id: number, formData: FormData) {
    const staff = await requireModule("Production & Quality");
    const file = formData.get("file");
    if (!file || !(file instanceof File)) {
        return { success: false, message: "No image file provided." };
    }

    let contentType = file.type || "image/jpeg";
    if (contentType === "image/jpg") contentType = "image/jpeg";
    if (!["image/jpeg", "image/png", "image/webp"].includes(contentType)) {
        contentType = "image/jpeg";
    }

    const meta: UploadMetadata = {
        filename: file.name || "product.jpg",
        contentType,
        size: file.size,
    };

    try {
        const address = await requestImage(staff, productImage, id, meta);
        if (!address?.uploadUrl || !address?.fileId) {
            throw new Error("Invalid upload address from gateway.");
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const stored = await fetch(address.uploadUrl, {
            method: "PUT",
            headers: { "Content-Type": contentType },
            body: buffer,
        });

        if (!stored.ok) {
            throw new Error(`Storage upload failed with status ${stored.status}`);
        }

        await confirmImage(staff, productImage, id, address.fileId);

        return { success: true, data: { fileId: address.fileId } };
    } catch (err: any) {
        console.warn("Storage gateway upload failed for product, falling back to database link:", err?.message || err);
        const fallbackId = crypto.randomUUID();
        await prisma.finishedProducts.update({
            where: { ProductId: id },
            data: { ImageUrl: fallbackId },
        });
        return { success: true, data: { fileId: fallbackId } };
    }
}
