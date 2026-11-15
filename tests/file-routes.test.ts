import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { FileError, type FileTarget } from "@/lib/files";
import type { FilesPort, StoredFile } from "@/lib/gateway/files";

const staff = { id: "u1", name: "Ana Cruz", username: "2026-AB-001", email: "ana@example.com" };
vi.mock("@/lib/portal/staff", () => ({ requireRouteModule: async () => ({ ok: true, staff }) }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

const { fileRoutes } = await import("@/lib/file-routes");

const ID = "3f2b8c1e-5a4d-4c6e-9b7a-1d2e3f4a5b6c";
const props = { params: Promise.resolve({ id: "42" }) };
const json = (body: unknown) => new NextRequest("https://localhost:3003/x", { method: "POST", body: JSON.stringify(body) });

function setup(stored: string | null = null) {
  const file: StoredFile = { id: ID, status: "pending", filename: "r.pdf", contentType: "application/pdf", size: 5, visibility: "private", retentionType: "permanent", variants: [], expiresAt: null };
  const port: FilesPort = {
    requestUpload: async () => ({ ...file, uploadUrl: "https://storage.test/put", uploadUrlExpiresInSeconds: 600 }),
    confirm: async () => ({ ...file, status: "active" }),
    view: async () => ({ ...file, status: "active", url: "https://storage.test/signed?sig=1" }),
    addLink: vi.fn(async () => {}),
    requestReplacement: vi.fn(async () => ({ ...file, uploadUrl: "https://storage.test/replace", uploadUrlExpiresInSeconds: 600 })),
    confirmReplacement: vi.fn(async () => ({ ...file, status: "active" as const })),
    listByRecord: vi.fn(async () => ({ files: [], nextPage: null })),
    removeLink: vi.fn(async () => {}),
    deleteFile: vi.fn(async () => {}),
  };
  const target: FileTarget & { saved: string | null } = {
    kind: "receipt", entityType: "purchase-order", role: "receipt", saved: stored,
    exists: async (id) => id === 42,
    current: async () => target.saved,
    save: async (_id, fileId) => { target.saved = fileId; },
  };
  return { routes: fileRoutes("Orders & Procurement", target, port), target, port };
}

describe("file routes", () => {
  it("replaces an existing receipt in place and forwards Portal identity", async () => {
    const { routes, port, target } = setup(ID);
    const response = await routes.upload(json({ filename: "r.pdf", contentType: "application/pdf", size: 5 }), props);
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ fileId: ID, uploadUrl: "https://storage.test/replace" });
    expect(port.requestReplacement).toHaveBeenCalledWith(ID, { contentType: "application/pdf", size: 5 }, staff.id);
    expect((await routes.confirm(json({ fileId: ID }), props)).status).toBe(200);
    expect(port.confirmReplacement).toHaveBeenCalledWith(ID, staff.id);
    expect(port.addLink).not.toHaveBeenCalled();
    expect(target.saved).toBe(ID);
  });

  it.each([409, 422] as const)("returns expected storage errors with their status (%s)", async status => {
    const { routes, port, target } = setup(ID);
    vi.mocked(port.confirmReplacement).mockRejectedValueOnce(new FileError("Upload could not be confirmed.", status));
    const response = await routes.confirm(json({ fileId: ID }), props);
    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({ message: "Upload could not be confirmed." });
    expect(target.saved).toBe(ID);
  });

  it("selects a ready image variant while keeping private links uncached", async () => {
    const { routes, port } = setup(ID);
    port.view = async () => ({ id: ID, status: "active", filename: "r.png", contentType: "image/png", size: 5,
      visibility: "private", retentionType: "permanent", expiresAt: null, url: "https://storage.test/original",
      variants: [{ name: "medium", status: "ready", url: "https://storage.test/medium" }] });
    const response = await routes.resolve(new NextRequest("https://localhost:3003/x?variant=medium"), props);
    expect(await response.json()).toMatchObject({ url: "https://storage.test/medium", private: true });
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("unlinks a removed image before clearing its record reference", async () => {
    const { routes, port, target } = setup(ID);
    expect((await routes.remove(new NextRequest("https://localhost:3003/x", { method: "DELETE" }), props)).status).toBe(204);
    expect(port.removeLink).toHaveBeenCalledWith(ID, { system: "IMS", entityType: "purchase-order", entityId: "42", role: "receipt" }, staff.id);
    expect(target.saved).toBe("");
    expect(port.deleteFile).not.toHaveBeenCalled();
  });

  it("uploads, confirms and then resolves a private receipt with an uncached short-lived link", async () => {
    const { routes, target } = setup();
    const upload = await routes.upload(json({ filename: "r.pdf", contentType: "application/pdf", size: 5 }), props);
    expect(upload.status).toBe(201);
    expect(await upload.json()).toEqual({ fileId: ID, uploadUrl: "https://storage.test/put", uploadUrlExpiresInSeconds: 600 });

    const confirm = await routes.confirm(json({ fileId: ID }), props);
    expect(await confirm.json()).toEqual({ fileId: ID, status: "active" });
    expect(target.saved).toBe(ID);

    const resolved = await routes.resolve(new NextRequest("https://localhost:3003/x"), props);
    expect(await resolved.json()).toEqual({ kind: "file", url: "https://storage.test/signed?sig=1", private: true });
    expect(resolved.headers.get("cache-control")).toBe("no-store");
  });

  it("resolves an old stored path to the placeholder", async () => {
    const { routes } = setup("/uploads/receipts/old.pdf");
    const resolved = await routes.resolve(new NextRequest("https://localhost:3003/x"), props);
    expect(await resolved.json()).toMatchObject({ kind: "placeholder" });
  });

  it("answers 400 for an invalid upload and 404 for an unknown record", async () => {
    const { routes } = setup();
    expect((await routes.upload(json({ filename: "x.exe", contentType: "application/x-msdownload", size: 5 }), props)).status).toBe(400);
    expect((await routes.upload(json({}), { params: Promise.resolve({ id: "7" }) })).status).toBe(404);
    expect((await routes.resolve(new NextRequest("https://localhost:3003/x"), { params: Promise.resolve({ id: "abc" }) })).status).toBe(404);
  });

  it("answers 502 without leaking details when the gateway fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const failing = fileRoutes("Orders & Procurement", { ...setup().target }, { ...({} as FilesPort), requestUpload: async () => { throw new Error("secret-detail"); } });
    const response = await failing.upload(json({ filename: "r.pdf", contentType: "application/pdf", size: 5 }), props);
    expect(response.status).toBe(502);
    expect(JSON.stringify(await response.json())).not.toContain("secret-detail");
  });
});
