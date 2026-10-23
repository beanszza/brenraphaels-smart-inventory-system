import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { FileTarget } from "@/lib/files";
import type { FilesPort, StoredFile } from "@/lib/gateway/files";

const staff = { id: "u1", name: "Ana Cruz", username: "2026-AB-001", email: "ana@example.com" };
vi.mock("@/lib/portal/staff", () => ({ requireRouteModule: async () => ({ ok: true, staff }) }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

const { fileRoutes } = await import("@/lib/file-routes");

const ID = "3f2b8c1e-5a4d-4c6e-9b7a-1d2e3f4a5b6c";
const props = { params: Promise.resolve({ id: "42" }) };
const json = (body: unknown) => new NextRequest("https://localhost:3003/x", { method: "POST", body: JSON.stringify(body) });

function setup(stored: string | null = null) {
  const file: StoredFile = { id: ID, status: "pending", filename: "r.pdf", contentType: "application/pdf", size: 5, visibility: "private", retentionType: "permanent" };
  const port: FilesPort = {
    requestUpload: async () => ({ ...file, uploadUrl: "https://storage.test/put", uploadUrlExpiresInSeconds: 600 }),
    confirm: async () => ({ ...file, status: "active" }),
    view: async () => ({ ...file, status: "active", url: "https://storage.test/signed?sig=1" }),
    addLink: async () => {},
  };
  const target: FileTarget & { saved: string | null } = {
    kind: "receipt", entityType: "purchase-order", role: "receipt", saved: stored,
    exists: async (id) => id === 42,
    current: async () => target.saved,
    save: async (_id, fileId) => { target.saved = fileId; },
  };
  return { routes: fileRoutes("Orders & Procurement", target, port), target };
}

describe("file routes", () => {
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
