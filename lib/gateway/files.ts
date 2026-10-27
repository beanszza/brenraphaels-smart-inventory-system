export type Visibility = "public" | "private";
export type Retention = "permanent" | "temporary";

/** File as file-storage reports it through the gateway. */
export type StoredFile = {
  id: string;
  status: "pending" | "active";
  filename: string;
  contentType: string;
  size: number;
  visibility: Visibility;
  retentionType: Retention;
};

export type UploadRequest = {
  filename: string;
  contentType: string;
  size: number;
  visibility: Visibility;
  retentionType: Retention;
};

export type UploadAddress = StoredFile & { uploadUrl: string; uploadUrlExpiresInSeconds: number };
export type ViewedFile = StoredFile & { url: string };
export type FileLink = { system: "IMS"; entityType: string; entityId: string; role: string };

/** The gateway as IMS uses it for files; replaced with a fake in tests. `actor` is the Staff Username. */
export interface FilesPort {
  requestUpload(request: UploadRequest, actor: string): Promise<UploadAddress>;
  confirm(id: string, actor: string): Promise<StoredFile>;
  /** Public address, or a short-lived signed one for a Private file. Null when no such Active file. */
  view(id: string, actor: string): Promise<ViewedFile | null>;
  addLink(id: string, link: FileLink, actor: string): Promise<void>;
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
  if (!response.ok) throw new Error(`The gateway refused ${what}: ${response.status}`);
  return (await response.json()) as T;
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
    if (!response.ok) throw new Error(`The gateway refused the file link: ${response.status}`);
  },
};
