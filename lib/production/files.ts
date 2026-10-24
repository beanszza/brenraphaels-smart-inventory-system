import { confirmAndLink, FileError, requestUpload, resolveFile, type FileTarget } from "@/lib/files";
import { filesGateway } from "@/lib/gateway/files";
import { recordAudit } from "@/lib/audit";
import type { Staff } from "@/lib/portal/client";
import { resourceResult } from "@/lib/resources/result";
import { positiveId } from "./mutate";

export type UploadMetadata = { filename: string; contentType: string; size: number };
async function exists(target: FileTarget, id: number) {
  positiveId(id);
  if (!(await target.exists(id))) throw new FileError("Record not found.", 404);
}
export async function fileResult(work: () => Promise<unknown>) {
  try { return resourceResult({ success: true, data: await work() }); }
  catch (error) {
    if (!(error instanceof FileError)) console.error("Production file action failed", error);
    return resourceResult({ success: false, message: error instanceof FileError ? error.message : "The file service is unavailable." });
  }
}
export async function requestImage(staff: Staff, target: FileTarget, id: number, meta: UploadMetadata) {
  await exists(target, id);
  const address = await requestUpload(filesGateway, staff, { ...meta, kind: target.kind });
  await recordAudit(staff, {
    module: "Production & Quality", change: "created", target: { type: "file", id: address.id, name: meta.filename },
    description: `${staff.name} requested a ${target.role} upload for ${target.entityType} ${id}`,
  });
  return { fileId: address.id, uploadUrl: address.uploadUrl, uploadUrlExpiresInSeconds: address.uploadUrlExpiresInSeconds };
}
export async function confirmImage(staff: Staff, target: FileTarget, id: number, fileId: string) {
  await exists(target, id);
  const file = await confirmAndLink(filesGateway, staff, target, id, fileId);
  await recordAudit(staff, {
    module: "Production & Quality", change: "updated", target: { type: target.entityType, id, name: `${target.entityType} ${id}` },
    description: `${staff.name} attached a ${target.role} to ${target.entityType} ${id}`,
  });
  return { fileId: file.id, status: file.status };
}
export async function resolveImage(staff: Staff, target: FileTarget, id: number) {
  await exists(target, id);
  return resolveFile(filesGateway, staff, await target.current(id));
}
