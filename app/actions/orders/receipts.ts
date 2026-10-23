"use server";

import { requireModule } from "@/lib/portal/staff";
import { confirmAndLink, FileError, requestUpload, resolveFile } from "@/lib/files";
import { filesGateway } from "@/lib/gateway/files";
import { purchaseOrderReceipt } from "@/lib/file-routes";
import { recordAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { errorMessage, resourceResult } from "@/lib/resources/result";

const MODULE = "Orders & Procurement";

const refusal = (error: unknown) => {
  if (!(error instanceof FileError)) console.error("Receipt file request failed", error);
  return resourceResult({
    success: false,
    message: error instanceof FileError ? error.message : `The file service is unavailable: ${errorMessage(error)}`,
  });
};

async function exists(poId: number) {
  if (!Number.isSafeInteger(poId) || !(await purchaseOrderReceipt.exists(poId))) throw new FileError("Record not found.", 404);
}

/** Step one of a direct upload: an address to PUT the receipt's bytes to. */
export async function requestReceiptUpload(poId: number, file: { filename: string; contentType: string; size: number }) {
  const staff = await requireModule(MODULE);
  try {
    await exists(poId);
    const address = await requestUpload(filesGateway, staff, { kind: "receipt", ...file });
    return resourceResult({
      success: true,
      data: { fileId: address.id, uploadUrl: address.uploadUrl, uploadUrlExpiresInSeconds: address.uploadUrlExpiresInSeconds },
    });
  } catch (error) {
    return refusal(error);
  }
}

/** Step two: links the uploaded receipt to the order. */
export async function confirmReceiptUpload(poId: number, fileId: string) {
  const staff = await requireModule(MODULE);
  try {
    const file = await confirmAndLink(filesGateway, staff, purchaseOrderReceipt, poId, fileId);
    const order = await prisma.purchaseOrders.findUnique({ where: { PoId: poId } });
    await recordAudit(staff, {
      module: MODULE, change: "updated",
      target: { type: "purchase-order", id: poId, name: order?.PoNumber ?? `Purchase order ${poId}` },
      description: `${staff.name} uploaded a receipt for purchase order ${order?.PoNumber ?? poId}`,
    });
    return resourceResult({ success: true, data: { fileId: file.id, status: file.status } });
  } catch (error) {
    return refusal(error);
  }
}

/** Where to show the receipt from: a short-lived link for a stored file, otherwise the placeholder. */
export async function resolveReceipt(poId: number) {
  const staff = await requireModule(MODULE);
  try {
    await exists(poId);
    return resourceResult({ success: true, data: await resolveFile(filesGateway, staff, await purchaseOrderReceipt.current(poId)) });
  } catch (error) {
    return refusal(error);
  }
}
