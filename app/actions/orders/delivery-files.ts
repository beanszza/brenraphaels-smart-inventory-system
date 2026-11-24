"use server";

import { requireModule } from "@/lib/portal/staff";
import { requestUpload, isFileId, FILE_PLACEHOLDER, MAX_FILE_BYTES } from "@/lib/files";
import { filesGateway } from "@/lib/gateway/files";
import { resourceResult } from "@/lib/resources/result";

const MODULE = "Orders & Procurement";

export async function uploadDeliveryAttachmentDirect(formData: FormData) {
  const staff = await requireModule(MODULE);
  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    return resourceResult({ success: false, message: "No attachment file provided." });
  }

  let contentType = (file.type || "").toLowerCase();
  const filename = (file.name || "delivery-document").slice(0, 250);
  if (!contentType || contentType === "application/octet-stream") {
    const lower = filename.toLowerCase();
    if (lower.endsWith(".pdf")) contentType = "application/pdf";
    else if (lower.endsWith(".png")) contentType = "image/png";
    else if (lower.endsWith(".webp")) contentType = "image/webp";
    else contentType = "image/jpeg";
  }

  const allowedTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
  if (!allowedTypes.includes(contentType)) {
    return resourceResult({
      success: false,
      message: "Only JPG, PNG, WEBP, or PDF files are allowed.",
    });
  }

  if (file.size <= 0 || file.size > MAX_FILE_BYTES) {
    return resourceResult({
      success: false,
      message: "The file must be between 1 byte and 10 MB.",
    });
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  try {
    const address = await requestUpload(
      filesGateway,
      staff,
      {
        kind: "delivery-attachment",
        filename,
        contentType,
        size: file.size,
      }
    );

    if (!address?.uploadUrl || !address?.id) {
      throw new Error("Invalid upload address from file gateway.");
    }

    // Direct PUT to object storage with retry
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
      throw lastUploadError || new Error("Failed to write attachment to file storage.");
    }

    // Confirm with gateway with retry for eventual consistency
    let confirmOk = false;
    let lastConfirmError: any = null;
    for (let attempt = 1; attempt <= 5; attempt++) {
      try {
        if (attempt > 1) {
          await new Promise((r) => setTimeout(r, attempt * 400));
        }
        await filesGateway.confirm(address.id, staff.id);
        confirmOk = true;
        break;
      } catch (err: any) {
        lastConfirmError = err;
        console.warn(`Confirm delivery attachment attempt ${attempt} failed:`, err?.message || err);
      }
    }

    if (!confirmOk) {
      throw lastConfirmError || new Error("Failed to confirm attachment with file gateway.");
    }

    return resourceResult({
      success: true,
      message: "Attachment uploaded successfully.",
      data: { fileId: address.id, filename },
    });
  } catch (error: any) {
    console.error("Delivery attachment upload error:", error);
    return resourceResult({
      success: false,
      message: error?.message || "Failed to upload attachment to file storage.",
    });
  }
}

async function resolveSingleRef(
  staff: Awaited<ReturnType<typeof requireModule>>,
  ref: string | null | undefined
): Promise<{ url: string | null; contentType?: string | null; reason?: string }> {
  if (!ref || typeof ref !== "string") {
    return { url: null };
  }

  const trimmed = ref.trim();
  if (trimmed.startsWith("data:") || trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return { url: trimmed };
  }

  if (!isFileId(trimmed)) {
    return { url: null };
  }

  try {
    const viewed = (await filesGateway.view(trimmed, staff.id)) as
      | ({
          url?: string;
          downloadUrl?: string;
          signedUrl?: string;
          contentType?: string;
          variants?: Array<{ status?: string; url?: string | null }>;
        } & Record<string, unknown>)
      | null;

    if (viewed) {
      const candidateUrl =
        viewed.url ||
        viewed.downloadUrl ||
        viewed.signedUrl ||
        viewed.variants?.find((v) => v.status === "ready" && v.url)?.url ||
        null;

      if (candidateUrl && candidateUrl !== FILE_PLACEHOLDER && !candidateUrl.includes("file-placeholder")) {
        return { url: candidateUrl, contentType: viewed.contentType ?? null };
      }
      return { url: null, reason: `File ${trimmed} returned no URL (status=${String(viewed.status ?? "unknown")})` };
    }
    return { url: null, reason: `File ${trimmed} not found (404)` };
  } catch (error: unknown) {
    console.error("Failed to resolve delivery attachment:", error);
    return { url: null, reason: error instanceof Error ? error.message : String(error) };
  }
}

export async function resolveDeliveryAttachment(ref: string | null | undefined) {
  const staff = await requireModule(MODULE);
  const resolved = await resolveSingleRef(staff, ref);
  return resourceResult({ success: true, data: resolved });
}

export async function resolveDeliveryAttachments(refs: {
  receipt?: string | null;
  arrival?: string | null;
}) {
  const staff = await requireModule(MODULE);
  const [receipt, arrival] = await Promise.all([
    resolveSingleRef(staff, refs.receipt),
    resolveSingleRef(staff, refs.arrival),
  ]);
  return resourceResult({
    success: true,
    data: {
      receiptUrl: receipt.url,
      receiptReason: receipt.reason,
      arrivalUrl: arrival.url,
      arrivalReason: arrival.reason,
    },
  });
}
