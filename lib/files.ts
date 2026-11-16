import type { FileLink, FilesPort, StoredFile, UploadAddress, Visibility, ImageVariant } from "@/lib/gateway/files";
import { FileError } from "@/lib/file-error";
import type { Staff } from "@/lib/portal/client";

export { FileError } from "@/lib/file-error";

export const FILE_PLACEHOLDER = "/images/file-placeholder.svg";
export const MAX_FILE_BYTES = 10 * 1024 * 1024;

const IMAGES = ["image/jpeg", "image/png", "image/webp"];

/** Product images are shown on other systems' storefronts; receipts and batch images are internal. */
export const FILE_KINDS = {
  "product-image": { visibility: "public", contentTypes: IMAGES },
  receipt: { visibility: "private", contentTypes: [...IMAGES, "application/pdf"] },
  "batch-image": { visibility: "private", contentTypes: IMAGES },
  "write-off-photo": { visibility: "private", contentTypes: IMAGES },
} as const satisfies Record<string, { visibility: Visibility; contentTypes: string[] }>;

export type FileKind = keyof typeof FILE_KINDS;

/** Every IMS file is kept until removed, whatever the kind. */
const RETENTION = "permanent";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isFileId = (ref: string) => UUID.test(ref);

export type UploadInput = { kind: FileKind; filename: string; contentType: string; size: number };

/** Visibility and retention come from the kind; the client only describes the bytes. */
export async function requestUpload(port: FilesPort, staff: Staff, input: UploadInput, target?: FileTarget, recordId?: number): Promise<UploadAddress> {
  const policy = Object.hasOwn(FILE_KINDS, input.kind) ? FILE_KINDS[input.kind] : undefined;
  if (!policy) throw new FileError("Unknown file kind.", 400);
  const filename = typeof input.filename === "string" ? input.filename.trim() : "";
  if (!filename) throw new FileError("A filename is required.", 400);
  if (!(policy.contentTypes as readonly string[]).includes(input.contentType)) {
    throw new FileError(`A ${input.kind} must be one of: ${policy.contentTypes.join(", ")}.`, 400);
  }
  if (!Number.isInteger(input.size) || input.size <= 0 || input.size > MAX_FILE_BYTES) {
    throw new FileError("The file must be between 1 byte and 10 MB.", 400);
  }
  if (target) {
    if (recordId === undefined || !Number.isSafeInteger(recordId) || recordId <= 0 || !(await target.exists(recordId))) {
      throw new FileError("Record not found.", 404);
    }
    const current = await target.current(recordId);
    if (current && isFileId(current)) {
      try {
        return await port.requestReplacement(current, { contentType: input.contentType, size: input.size }, staff.id);
      } catch (error) {
        if (!(error instanceof FileError) || error.status !== 404) throw error;
      }
    }
  }
  return port.requestUpload(
    { filename, contentType: input.contentType, size: input.size, visibility: policy.visibility, retentionType: RETENTION,
      ...(target && recordId !== undefined ? { link: recordLink(target, recordId) } : {}) },
    staff.id,
  );
}

/** The IMS record a file belongs to; the kind decides which Module and column are involved. */
export interface FileTarget {
  kind: FileKind;
  entityType: string;
  role: string;
  exists(recordId: number): Promise<boolean>;
  /** The reference stored on the record: a file id, an old path, or empty. */
  current(recordId: number): Promise<string | null>;
  save(recordId: number, fileId: string): Promise<void>;
}

export function recordLink(target: Pick<FileTarget, "entityType" | "role">, recordId: number): FileLink {
  return { system: "IMS", entityType: target.entityType, entityId: String(recordId), role: target.role };
}

/** Remove only IMS's link; other systems may still hold the file ID. */
export async function unlinkFile(port: FilesPort, staff: Staff, target: Pick<FileTarget, "entityType" | "role">, recordId: number, ref: string | null | undefined) {
  if (ref && isFileId(ref)) await port.removeLink(ref, recordLink(target, recordId), staff.id);
}

export async function removeFile(port: FilesPort, staff: Staff, target: FileTarget, recordId: number) {
  if (!Number.isSafeInteger(recordId) || recordId <= 0 || !(await target.exists(recordId))) throw new FileError("Record not found.", 404);
  await unlinkFile(port, staff, target, recordId, await target.current(recordId));
  await target.save(recordId, "");
}

/** Confirms the uploaded bytes, labels the file with its record and stores its id on the record. */
export async function confirmAndLink(
  port: FilesPort,
  staff: Staff,
  target: FileTarget,
  recordId: number,
  fileId: string,
): Promise<StoredFile> {
  if (typeof fileId !== "string" || !isFileId(fileId)) throw new FileError("fileId must be a file id.", 400);
  if (!(await target.exists(recordId))) throw new FileError("Record not found.", 404);
  const current = await target.current(recordId);
  const replacement = current === fileId;
  const file = await (replacement ? port.confirmReplacement(fileId, staff.id) : port.confirm(fileId, staff.id));
  if (file.visibility !== FILE_KINDS[target.kind].visibility || file.retentionType !== RETENTION) {
    throw new FileError(`That file was not uploaded as a ${target.kind}.`, 422);
  }
  if (!replacement) await port.addLink(fileId, recordLink(target, recordId), staff.id);
  await target.save(recordId, fileId);
  if (!replacement) await unlinkFile(port, staff, target, recordId, current);
  return file;
}

export type ResolvedFile =
  | { kind: "file"; url: string; private: boolean }
  | { kind: "placeholder"; url: typeof FILE_PLACEHOLDER; private: false };

const placeholder = { kind: "placeholder", url: FILE_PLACEHOLDER, private: false } as const;

/**
 * Understands both stored references: a new file id resolves to its address (short-lived for a
 * private file), and anything else (old upload paths, empty values) to the placeholder.
 */
export async function resolveFile(port: FilesPort, staff: Staff, ref: string | null | undefined, preferredVariant?: ImageVariant): Promise<ResolvedFile> {
  const id = ref?.trim();
  if (!id || !isFileId(id)) return placeholder;
  try {
    const file = await port.view(id, staff.id);
    if (!file) return placeholder;
    const variant = file.variants?.find(item => item.name === preferredVariant && item.status === "ready" && item.url);
    return { kind: "file", url: variant?.url || file.url, private: file.visibility === "private" };
  } catch {
    return placeholder;
  }
}
