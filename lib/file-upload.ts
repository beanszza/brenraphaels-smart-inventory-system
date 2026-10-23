import { FILE_PLACEHOLDER } from "@/lib/files";

type Fetcher = typeof fetch;

const FAILED = "The file could not be uploaded.";

async function readJson<T>(response: Response): Promise<T | null> {
  return (await response.json().catch(() => null)) as T | null;
}

async function failure(response: Response): Promise<Error> {
  const body = await readJson<{ message?: unknown }>(response);
  return new Error(typeof body?.message === "string" && body.message ? body.message : FAILED);
}

type UploadAddress = { fileId?: string; uploadUrl?: string };

/** The record-side halves of an upload, however they are reached: route handlers or server actions. */
export type UploadSteps = {
  request(meta: { filename: string; contentType: string; size: number }): Promise<UploadAddress>;
  confirm(fileId: string): Promise<void>;
};

/** Sends the bytes straight to storage so their size never meets our request limit. */
export async function uploadWith(steps: UploadSteps, file: File, fetcher: Fetcher = fetch): Promise<string> {
  const address = await steps.request({ filename: file.name, contentType: file.type, size: file.size });
  if (!address?.fileId || !address.uploadUrl) throw new Error(FAILED);

  // Storage signs the address, so our session cookie has no business going with it.
  const stored = await fetcher(address.uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type },
    body: file,
    credentials: "omit",
  });
  if (!stored.ok) throw new Error(FAILED);

  await steps.confirm(address.fileId);
  return address.fileId;
}

/**
 * Uploads a file for one record through its file route. `base` is the record's file route,
 * such as `/api/finished-products/42/file`. Resolves to the new file id once the record is linked.
 */
export function uploadFile(base: string, file: File, fetcher: Fetcher = fetch): Promise<string> {
  return uploadWith(
    {
      async request(meta) {
        const requested = await fetcher(`${base}/upload`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(meta),
        });
        if (!requested.ok) throw await failure(requested);
        return (await readJson<UploadAddress>(requested)) ?? {};
      },
      async confirm(fileId) {
        const confirmed = await fetcher(`${base}/confirm`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileId }),
        });
        if (!confirmed.ok) throw await failure(confirmed);
      },
    },
    file,
    fetcher,
  );
}

/** Where to show a record's file from; the placeholder when it has none or cannot be found. */
export async function resolveFileUrl(base: string, fetcher: Fetcher = fetch): Promise<string> {
  try {
    const response = await fetcher(base, { cache: "no-store" });
    if (!response.ok) return FILE_PLACEHOLDER;
    const file = await readJson<{ url?: unknown }>(response);
    return typeof file?.url === "string" && file.url ? file.url : FILE_PLACEHOLDER;
  } catch {
    return FILE_PLACEHOLDER;
  }
}
