import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { filesGateway } from "@/lib/gateway/files";
import { FileError } from "@/lib/files";

const ID = "3f2b8c1e-5a4d-4c6e-9b7a-1d2e3f4a5b6c";
const actor = "portal-user-id";
const link = { system: "IMS", entityType: "finished-product", entityId: "42", role: "product image" } as const;
const fetcher = vi.fn<typeof fetch>();

beforeEach(() => {
  vi.stubEnv("IMS_GATEWAY_URL", "https://gateway.test/");
  vi.stubEnv("IMS_GATEWAY_CALLER_KEY", "test-key");
  vi.stubGlobal("fetch", fetcher);
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.resetAllMocks(); });

describe("file storage gateway", () => {
  it("requests and confirms an in-place replacement through the authenticated gateway", async () => {
    fetcher.mockResolvedValueOnce(Response.json({ id: ID, uploadUrl: "https://storage.test/replace" }));
    const request = { contentType: "image/png", size: 5 };
    expect(await filesGateway.requestReplacement(ID, request, actor)).toMatchObject({ id: ID });
    expect(fetcher).toHaveBeenLastCalledWith(`https://gateway.test/files/${ID}/replacement`, expect.objectContaining({
      method: "POST", body: JSON.stringify(request), cache: "no-store",
      headers: { Authorization: "Bearer test-key", "X-Actor-Id": actor, "Content-Type": "application/json" },
    }));
    const file = { id: ID, variants: [{ name: "small", status: "ready", url: "https://cdn.test/small" }], expiresAt: null };
    fetcher.mockResolvedValueOnce(Response.json(file));
    expect(await filesGateway.confirmReplacement(ID, actor)).toEqual(file);
    expect(fetcher).toHaveBeenLastCalledWith(`https://gateway.test/files/${ID}/replacement/confirm`, expect.objectContaining({ method: "POST", body: "{}" }));
  });

  it("lists files with encoded record filters and pagination", async () => {
    const page = { files: [], nextPage: null };
    fetcher.mockResolvedValueOnce(Response.json(page));
    expect(await filesGateway.listByRecord({ ...link, page: "cursor+/=" }, actor)).toEqual(page);
    const url = new URL(String(fetcher.mock.calls[0][0]));
    expect(url.pathname).toBe("/files");
    expect(Object.fromEntries(url.searchParams)).toEqual({ ...link, page: "cursor+/=" });
  });

  it.each([204, 404])("unlinks and deletes idempotently (%s) without parsing a response body", async status => {
    fetcher.mockImplementation(async () => new Response(null, { status }));
    await expect(filesGateway.removeLink(ID, link, actor)).resolves.toBeUndefined();
    expect(fetcher).toHaveBeenLastCalledWith(`https://gateway.test/files/${ID}/links`, expect.objectContaining({ method: "DELETE", body: JSON.stringify(link) }));
    await expect(filesGateway.deleteFile(ID, actor)).resolves.toBeUndefined();
    expect(fetcher).toHaveBeenLastCalledWith(`https://gateway.test/files/${ID}`, expect.objectContaining({ method: "DELETE", body: undefined }));
  });

  it.each([409, 422])("surfaces storage validation errors as FileError (%s)", async status => {
    fetcher.mockImplementation(async () => new Response("private service details", { status }));
    for (const operation of [
      () => filesGateway.confirm(ID, actor),
      () => filesGateway.requestReplacement(ID, { contentType: "image/png", size: 5 }, actor),
      () => filesGateway.confirmReplacement(ID, actor),
      () => filesGateway.removeLink(ID, link, actor),
      () => filesGateway.deleteFile(ID, actor),
    ]) {
      await expect(operation()).rejects.toBeInstanceOf(FileError);
      await expect(operation()).rejects.toMatchObject({ status });
    }
  });

  it("forwards the pending upload's record link", async () => {
    fetcher.mockResolvedValueOnce(Response.json({ id: ID }));
    const request = { filename: "photo.png", contentType: "image/png", size: 5, visibility: "public", retentionType: "permanent", link } as const;
    await filesGateway.requestUpload(request, actor);
    expect(fetcher).toHaveBeenCalledWith("https://gateway.test/files", expect.objectContaining({ body: JSON.stringify(request) }));
  });
});
