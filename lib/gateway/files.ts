import { FileError } from "@/lib/file-error";

export type Visibility = "public" | "private";
export type Retention = "permanent" | "temporary";
export type ImageVariant = "small" | "medium" | "large";
export type FileVariant = { name: ImageVariant; status: "ready" | "failed"; url: string | null };

/** File as file-storage reports it through the gateway. */
export type StoredFile = {
  id: string;
  status: "pending" | "active";
  filename: string;
  contentType: string;
  size: number;
  visibility: Visibility;
  retentionType: Retention;
  variants: FileVariant[];
  expiresAt: string | null;
};

export type UploadRequest = {
  link?: FileLink;
  filename: string;
  contentType: string;
  size: number;
  visibility: Visibility;
  retentionType: Retention;
};

export type UploadAddress = StoredFile & { uploadUrl: string; uploadUrlExpiresInSeconds: number };
export type ViewedFile = StoredFile & { url: string };
export type FileLink = { system: "IMS"; entityType: string; entityId: string; role: string };
export type RecordFilesQuery = { system: "IMS"; entityType: string; entityId: string; role?: string; page?: string };
export type FilePage = { files: StoredFile[]; nextPage: string | null };
export type ReplacementRequest = { contentType: string; size: number };

/** The gateway as IMS uses it for files; `actor` is the Portal user ID. */
export interface FilesPort {
  requestUpload(request: UploadRequest, actor: string): Promise<UploadAddress>;
  confirm(id: string, actor: string): Promise<StoredFile>;
  /** Public address, or a short-lived signed one for a Private file. Null when no such Active file. */
  view(id: string, actor: string): Promise<ViewedFile | null>;
  addLink(id: string, link: FileLink, actor: string): Promise<void>;
  requestReplacement(id: string, request: ReplacementRequest, actor: string): Promise<UploadAddress>;
  confirmReplacement(id: string, actor: string): Promise<StoredFile>;
  listByRecord(query: RecordFilesQuery, actor: string): Promise<FilePage>;
  removeLink(id: string, link: FileLink, actor: string): Promise<void>;
  /** Only for files known to have no other consumers. Prefer removeLink for shared files. */
  deleteFile(id: string, actor: string): Promise<void>;
}

function gateway() {
  const base = process.env.IMS_GATEWAY_URL;
  const key = process.env.IMS_GATEWAY_CALLER_KEY;
  if (!base || !key) throw new Error("IMS_GATEWAY_URL and IMS_GATEWAY_CALLER_KEY must be set; see .env.example");
  return { base: base.replace(/\/$/, ""), key };
}

async function call(method: string, path: string, actor: string, body?: unknown): Promise<Response> {
  const { base, key } = gateway();
  return fetch(`${base}/files${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      "X-Actor-Id": actor,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(5_000),
  });
}

async function json<T>(response: Response, what: string): Promise<T> {
  check(response, what);
  return (await response.json()) as T;
}

function check(response: Response, what: string) {
  if (response.ok) return;
  switch (response.status) {
    case 400: throw new FileError("Invalid file request.", 400);
    case 404: throw new FileError("File not found.", 404);
    case 409: throw new FileError("The file is not ready. Upload the file before confirming and try again.", 409);
    case 422: throw new FileError("The uploaded file does not match its declared type or size.", 422);
    default: throw new Error(`The gateway refused ${what}: ${response.status}`);
  }
}

export const filesGateway: FilesPort = {
  async requestUpload(request, actor) {
    return json(await call("POST", "", actor, request), "the upload request");
  },

  async confirm(id, actor) {
    return json(await call("POST", `/${encodeURIComponent(id)}/confirm`, actor, {}), "the upload confirmation");
  },

  async view(id, actor) {
    const response = await call("GET", `/${encodeURIComponent(id)}`, actor);
    if (response.status === 404) return null;
    return json(response, "the file view");
  },

  async addLink(id, link, actor) {
    const response = await call("POST", `/${encodeURIComponent(id)}/links`, actor, link);
    check(response, "the file link");
  },

  async requestReplacement(id, request, actor) {
    return json(await call("POST", `/${encodeURIComponent(id)}/replacement`, actor, request), "the replacement request");
  },

  async confirmReplacement(id, actor) {
    return json(await call("POST", `/${encodeURIComponent(id)}/replacement/confirm`, actor, {}), "the replacement confirmation");
  },

  async listByRecord(query, actor) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) if (value !== undefined) params.set(key, value);
    return json(await call("GET", `?${params}`, actor), "the record's files");
  },

  async removeLink(id, link, actor) {
    const response = await call("DELETE", `/${encodeURIComponent(id)}/links`, actor, link);
    if (response.status !== 404) check(response, "the file unlink");
  },

  async deleteFile(id, actor) {
    const response = await call("DELETE", `/${encodeURIComponent(id)}`, actor);
    if (response.status !== 404) check(response, "the file deletion");
  },
};
