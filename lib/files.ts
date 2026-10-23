import type { FileLink, FilesPort, StoredFile, UploadAddress, Visibility } from "@/lib/gateway/files";
import type { Staff } from "@/lib/portal/client";

export const FILE_PLACEHOLDER = "/images/file-placeholder.svg";
export const MAX_FILE_BYTES = 10 * 1024 * 1024;

const IMAGES = ["image/jpeg", "image/png", "image/webp"];

/** Product images are shown on other systems' storefronts; receipts and batch images are internal. */
export const FILE_KINDS = {
  "product-image": { visibility: "public", contentTypes: IMAGES },
  receipt: { visibility: "private", contentTypes: [...IMAGES, "application/pdf"] },
  "batch-image": { visibility: "private", contentTypes: IMAGES },
} as const satisfies Record<string, { visibility: Visibility; contentTypes: string[] }>;

export type FileKind = keyof typeof FILE_KINDS;

/** Every IMS file is kept until removed, whatever the kind. */
const RETENTION = "permanent";

export class FileError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 404 | 422,
  ) {
    super(message);
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isFileId = (ref: string) => UUID.test(ref);

export type UploadInput = { kind: FileKind; filename: string; contentType: string; size: number };

/** Visibility and retention come from the kind; the client only describes the bytes. */
export async function requestUpload(port: FilesPort, staff: Staff, input: UploadInput): Promise<UploadAddress> {
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
  return port.requestUpload(
    { filename, contentType: input.contentType, size: input.size, visibility: policy.visibility, retentionType: RETENTION },
    staff.username,
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
  const file = await port.confirm(fileId, staff.username);
  if (file.visibility !== FILE_KINDS[target.kind].visibility || file.retentionType !== RETENTION) {
    throw new FileError(`That file was not uploaded as a ${target.kind}.`, 422);
  }
  const link: FileLink = { system: "IMS", entityType: target.entityType, entityId: String(recordId), role: target.role };
  await port.addLink(fileId, link, staff.username);
  await target.save(recordId, fileId);
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
export async function resolveFile(port: FilesPort, staff: Staff, ref: string | null | undefined): Promise<ResolvedFile> {
  const id = ref?.trim();
  if (!id || !isFileId(id)) return placeholder;
  const file = await port.view(id, staff.username);
  if (!file) return placeholder;
  return { kind: "file", url: file.url, private: file.visibility === "private" };
}
