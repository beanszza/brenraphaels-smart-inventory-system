"use server";
import { requireModule } from "@/lib/portal/staff";
import { productImage, batchImage } from "@/lib/file-routes";
import { fileResult, requestImage, confirmImage, resolveImage, type UploadMetadata } from "@/lib/production/files";
import { FileError, removeFile } from "@/lib/files";
import { filesGateway, type ImageVariant } from "@/lib/gateway/files";
import { prisma } from "@/lib/prisma";

export async function requestProductImageUpload(id: number, meta: UploadMetadata) {
    const staff = await requireModule("Production & Quality");
    return fileResult(() => requestImage(staff, productImage, id, meta));
}
export async function confirmProductImageUpload(id: number, fileId: string) {
    const staff = await requireModule("Production & Quality");
    return fileResult(() => confirmImage(staff, productImage, id, fileId));
}
export async function resolveProductImage(id: number, variant?: ImageVariant) {
    const staff = await requireModule("Production & Quality");
    return fileResult(() => resolveImage(staff, productImage, id, variant));
}
export async function requestBatchImageUpload(id: number, meta: UploadMetadata) {
    const staff = await requireModule("Production & Quality");
    return fileResult(() => requestImage(staff, batchImage, id, meta));
}
export async function confirmBatchImageUpload(id: number, fileId: string) {
    const staff = await requireModule("Production & Quality");
    return fileResult(() => confirmImage(staff, batchImage, id, fileId));
}
export async function resolveBatchImage(id: number, variant?: ImageVariant) {
    const staff = await requireModule("Production & Quality");
    return fileResult(() => resolveImage(staff, batchImage, id, variant));
}

/**
 * Server Action for direct batch image upload:
 * Bypasses browser CORS restrictions by transmitting bytes straight to storage via the backend.
 * Includes automatic retries for storage PUT and gateway confirmation to handle eventual consistency.
 */
export async function uploadBatchImageDirect(id: number, formData: FormData) {
    const staff = await requireModule("Production & Quality");
    const file = formData.get("file");
    if (!file || !(file instanceof File)) {
        return { success: false, message: "No image file provided." };
    }

    const filename = file.name || "packaging-proof.jpg";
    let contentType = file.type || "";
    if (contentType === "image/jpg") contentType = "image/jpeg";
    if (!contentType || contentType === "application/octet-stream") {
        const lower = filename.toLowerCase();
        if (lower.endsWith(".png")) contentType = "image/png";
        else if (lower.endsWith(".webp")) contentType = "image/webp";
        else contentType = "image/jpeg";
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const meta: UploadMetadata = {
        filename,
        contentType,
        size: buffer.length,
    };

    try {
        const address = await requestImage(staff, batchImage, id, meta);
        if (!address?.uploadUrl || !address?.fileId) {
            throw new Error("Invalid upload address from gateway.");
        }

        // Retry storage upload if network glitches
        let uploadOk = false;
        let lastUploadError: any = null;
        for (let attempt = 1; attempt <= 3; attempt++) {
            try {
                const stored = await fetch(address.uploadUrl, {
                    method: "PUT",
                    headers: {
                        "Content-Type": contentType,
                        "Content-Length": String(buffer.length),
                    },
                    body: buffer,
                });

                if (stored.ok) {
                    uploadOk = true;
                    break;
                } else {
                    lastUploadError = new Error(`Storage upload failed with status ${stored.status}`);
                }
            } catch (err) {
                lastUploadError = err;
            }
            if (attempt < 3) {
                await new Promise((r) => setTimeout(r, attempt * 300));
            }
        }

        if (!uploadOk) {
            throw lastUploadError || new Error("Failed to write image to storage.");
        }

        // Retry confirmation with exponential backoff to handle storage eventual consistency (e.g. 409 "The file is not ready")
        let confirmOk = false;
        let lastConfirmError: any = null;
        for (let attempt = 1; attempt <= 5; attempt++) {
            try {
                if (attempt > 1) {
                    await new Promise((r) => setTimeout(r, attempt * 400));
                }
                await confirmImage(staff, batchImage, id, address.fileId);
                confirmOk = true;
                break;
            } catch (err: any) {
                lastConfirmError = err;
                console.warn(`Confirm batch image attempt ${attempt} failed:`, err?.message || err);
            }
        }

        if (!confirmOk) {
            throw lastConfirmError || new Error("Failed to confirm image with gateway.");
        }

        return { success: true, data: { fileId: address.fileId } };
    } catch (error) {
        console.warn("Gateway batch upload unavailable, falling back to base64 storage:", error);
        // Fallback to storing base64 Data URL if gateway is offline/disabled (e.g. status 402)
        if (buffer.length <= 5 * 1024 * 1024) {
            const dataUrl = `data:${contentType};base64,${buffer.toString("base64")}`;
            try {
                await prisma.productionBatches.update({
                    where: { BatchId: id },
                    data: { ImageUrl: dataUrl },
                });
                return { success: true, data: { fileId: dataUrl } };
            } catch (dbErr) {
                console.error("Failed to save fallback image to database:", dbErr);
            }
        }
        return { success: false, message: error instanceof FileError ? error.message : "The image could not be uploaded. Please try again." };
    }
}

/**
 * Server Action for direct finished product image upload:
 * Bypasses browser CORS restrictions by transmitting bytes straight to storage via the backend.
 * Includes automatic retries for storage PUT and gateway confirmation to handle eventual consistency.
 */
export async function uploadProductImageDirect(id: number, formData: FormData) {
    const staff = await requireModule("Production & Quality");
    const file = formData.get("file");
    if (!file || !(file instanceof File)) {
        return { success: false, message: "No image file provided." };
    }

    const filename = file.name || "product.jpg";
    let contentType = file.type || "";
    if (contentType === "image/jpg") contentType = "image/jpeg";
    if (!contentType || contentType === "application/octet-stream") {
        const lower = filename.toLowerCase();
        if (lower.endsWith(".png")) contentType = "image/png";
        else if (lower.endsWith(".webp")) contentType = "image/webp";
        else contentType = "image/jpeg";
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const meta: UploadMetadata = {
        filename,
        contentType,
        size: buffer.length,
    };

    try {
        const address = await requestImage(staff, productImage, id, meta);
        if (!address?.uploadUrl || !address?.fileId) {
            throw new Error("Invalid upload address from gateway.");
        }

        // Retry storage upload if network glitches
        let uploadOk = false;
        let lastUploadError: any = null;
        for (let attempt = 1; attempt <= 3; attempt++) {
            try {
                const stored = await fetch(address.uploadUrl, {
                    method: "PUT",
                    headers: {
                        "Content-Type": contentType,
                        "Content-Length": String(buffer.length),
                    },
                    body: buffer,
                });

                if (stored.ok) {
                    uploadOk = true;
                    break;
                } else {
                    lastUploadError = new Error(`Storage upload failed with status ${stored.status}`);
                }
            } catch (err) {
                lastUploadError = err;
            }
            if (attempt < 3) {
                await new Promise((r) => setTimeout(r, attempt * 300));
            }
        }

        if (!uploadOk) {
            throw lastUploadError || new Error("Failed to write image to storage.");
        }

        // Retry confirmation with exponential backoff to handle storage eventual consistency (e.g. 409 "The file is not ready")
        let confirmOk = false;
        let lastConfirmError: any = null;
        for (let attempt = 1; attempt <= 5; attempt++) {
            try {
                if (attempt > 1) {
                    await new Promise((r) => setTimeout(r, attempt * 400));
                }
                await confirmImage(staff, productImage, id, address.fileId);
                confirmOk = true;
                break;
            } catch (err: any) {
                lastConfirmError = err;
                console.warn(`Confirm product image attempt ${attempt} failed:`, err?.message || err);
            }
        }

        if (!confirmOk) {
            throw lastConfirmError || new Error("Failed to confirm image with gateway.");
        }

        return { success: true, data: { fileId: address.fileId } };
    } catch (error) {
        console.warn("Gateway product upload unavailable, falling back to base64 storage:", error);
        if (buffer.length <= 5 * 1024 * 1024) {
            const dataUrl = `data:${contentType};base64,${buffer.toString("base64")}`;
            try {
                await prisma.finishedProducts.update({
                    where: { ProductId: id },
                    data: { ImageUrl: dataUrl },
                });
                return { success: true, data: { fileId: dataUrl } };
            } catch (dbErr) {
                console.error("Failed to save fallback product image to database:", dbErr);
            }
        }
        return { success: false, message: error instanceof FileError ? error.message : "The image could not be uploaded. Please try again." };
    }
}

export async function removeProductImage(id: number) {
    const staff = await requireModule("Production & Quality");
    return fileResult(() => removeFile(filesGateway, staff, productImage, id));
}
export async function removeBatchImage(id: number) {
    const staff = await requireModule("Production & Quality");
    return fileResult(() => removeFile(filesGateway, staff, batchImage, id));
}
