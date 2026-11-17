"use server";

import { requireModule } from "@/lib/portal/staff";
import { requestUpload, resolveFile, isFileId, FILE_PLACEHOLDER, MAX_FILE_BYTES } from "@/lib/files";
import { filesGateway } from "@/lib/gateway/files";
import { resourceResult } from "@/lib/resources/result";

const MODULE = "Stock Transfer";

export async function uploadTransferAttachmentDirect(formData: FormData) {
  const staff = await requireModule(MODULE);
  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    return resourceResult({ success: false, message: "No attachment file provided." });
  }

  let contentType = (file.type || "").toLowerCase();
  const filename = (file.name || "transfer-document").slice(0, 250);
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
        kind: "transfer-attachment",
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
        console.warn(`Confirm transfer attachment attempt ${attempt} failed:`, err?.message || err);
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
    console.error("Transfer attachment upload error:", error);
    return resourceResult({
      success: false,
      message: error?.message || "Failed to upload attachment to file storage.",
    });
  }
}

export async function resolveTransferAttachment(ref: string | null | undefined) {
  const staff = await requireModule(MODULE);
  if (!ref || typeof ref !== "string") {
    return resourceResult({ success: true, data: { url: null } });
  }

  const trimmed = ref.trim();
  if (trimmed.startsWith("data:") || trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return resourceResult({ success: true, data: { url: trimmed } });
  }

  if (!isFileId(trimmed)) {
    return resourceResult({ success: true, data: { url: null } });
  }

  try {
    const resolved = await resolveFile(filesGateway, staff, trimmed);
    const url = resolved.url !== FILE_PLACEHOLDER && !resolved.url.includes("file-placeholder") ? resolved.url : null;
    return resourceResult({ success: true, data: { url } });
  } catch (error) {
    console.error("Failed to resolve transfer attachment:", error);
    return resourceResult({ success: true, data: { url: null } });
  }
}
