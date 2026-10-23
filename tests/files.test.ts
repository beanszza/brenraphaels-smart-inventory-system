import { describe, expect, it } from "vitest";
import { confirmAndLink, FILE_KINDS, FILE_PLACEHOLDER, requestUpload, resolveFile, FileError, type FileTarget } from "@/lib/files";
import type { FileLink, FilesPort, StoredFile, UploadRequest, ViewedFile } from "@/lib/gateway/files";

const ID = "3f2b8c1e-5a4d-4c6e-9b7a-1d2e3f4a5b6c";
const staff = { id: "u1", name: "Ana Cruz", username: "2026-AB-001", email: "ana@example.com" };

function fakeFiles() {
  const files = new Map<string, StoredFile>();
  const links: { id: string; link: FileLink; actor: string }[] = [];
  const requests: { request: UploadRequest; actor: string }[] = [];
  let next = 0;
  const port: FilesPort = {
    async requestUpload(request, actor) {
      requests.push({ request, actor });
      const id = `00000000-0000-4000-8000-${String(++next).padStart(12, "0")}`;
      files.set(id, { id, status: "pending", ...request });
      return { ...files.get(id)!, uploadUrl: `https://storage.test/put/${id}`, uploadUrlExpiresInSeconds: 600 };
    },
    async confirm(id) {
      const file = files.get(id);
      if (!file) throw new Error("not found");
      file.status = "active";
      return file;
    },
    async view(id) {
      const file = files.get(id);
      if (!file || file.status !== "active") return null;
      const url = file.visibility === "public" ? `https://cdn.test/${id}` : `https://storage.test/signed/${id}?sig=abc`;
      return { ...file, url } satisfies ViewedFile;
    },
    async addLink(id, link, actor) {
      links.push({ id, link, actor });
    },
  };
  return { port, files, links, requests };
}

function fakeTarget(initial: string | null = null) {
  const target: FileTarget & { saved: string | null } = {
    kind: "receipt",
    entityType: "purchase-order",
    role: "receipt",
    saved: initial,
    async exists() { return true; },
    async current() { return this.saved; },
    async save(_id, fileId) { this.saved = fileId; },
  };
  return target;
}

describe("requestUpload", () => {
  it.each([
    ["product-image", "public"],
    ["receipt", "private"],
    ["batch-image", "private"],
  ] as const)("asks for a %s with %s visibility and permanent retention", async (kind, visibility) => {
    const { port, requests } = fakeFiles();
    const contentType = kind === "receipt" ? "application/pdf" : "image/png";
    const address = await requestUpload(port, staff, { kind, filename: "a.png", contentType, size: 1024 });
    expect(requests).toEqual([
      { request: { filename: "a.png", contentType, size: 1024, visibility, retentionType: "permanent" }, actor: "2026-AB-001" },
    ]);
    expect(address.uploadUrl).toContain("https://storage.test/put/");
    expect(FILE_KINDS[kind].visibility).toBe(visibility);
  });

  it("never lets the client choose visibility or retention", async () => {
    const { port, requests } = fakeFiles();
    await requestUpload(port, staff, { kind: "receipt", filename: "r.pdf", contentType: "application/pdf", size: 5, visibility: "public", retentionType: "temporary" } as never);
    expect(requests[0].request).toMatchObject({ visibility: "private", retentionType: "permanent" });
  });

  it.each([
    ["a PDF image", { kind: "product-image", contentType: "application/pdf", size: 10 }],
    ["an oversized file", { kind: "receipt", contentType: "image/png", size: 10 * 1024 * 1024 + 1 }],
    ["an empty file", { kind: "receipt", contentType: "image/png", size: 0 }],
    ["an unknown kind", { kind: "avatar", contentType: "image/png", size: 10 }],
  ] as const)("rejects %s before calling the gateway", async (_, input) => {
    const { port, requests } = fakeFiles();
    await expect(requestUpload(port, staff, { filename: "x", ...input } as never)).rejects.toBeInstanceOf(FileError);
    expect(requests).toHaveLength(0);
  });

  it("allows a PDF receipt", async () => {
    const { port } = fakeFiles();
    await expect(requestUpload(port, staff, { kind: "receipt", filename: "r.pdf", contentType: "application/pdf", size: 5 })).resolves.toBeDefined();
  });
});

describe("confirmAndLink", () => {
  async function pending(kindFile: Parameters<typeof requestUpload>[2]) {
    const fake = fakeFiles();
    const { id } = await requestUpload(fake.port, staff, kindFile);
    return { ...fake, id };
  }

  it("confirms the upload, links the file to the record and stores its id on the record", async () => {
    const { port, links, id } = await pending({ kind: "receipt", filename: "r.pdf", contentType: "application/pdf", size: 5 });
    const target = fakeTarget();
    const file = await confirmAndLink(port, staff, target, 42, id);
    expect(file.status).toBe("active");
    expect(links).toEqual([{ id, link: { system: "IMS", entityType: "purchase-order", entityId: "42", role: "receipt" }, actor: "2026-AB-001" }]);
    expect(target.saved).toBe(id);
  });

  it("refuses a file that was not requested with this kind's policy", async () => {
    const { port, files, id } = await pending({ kind: "receipt", filename: "r.pdf", contentType: "application/pdf", size: 5 });
    files.get(id)!.visibility = "public";
    const target = fakeTarget();
    await expect(confirmAndLink(port, staff, target, 42, id)).rejects.toMatchObject({ status: 422 });
    expect(target.saved).toBeNull();
  });

  it("refuses an id that is not a file id, without calling the gateway", async () => {
    const { port, links } = fakeFiles();
    const target = fakeTarget();
    await expect(confirmAndLink(port, staff, target, 42, "/uploads/receipts/a.pdf")).rejects.toMatchObject({ status: 400 });
    expect(links).toHaveLength(0);
  });

  it("answers 404 when the record does not exist", async () => {
    const { port, id } = await pending({ kind: "receipt", filename: "r.pdf", contentType: "application/pdf", size: 5 });
    const target = { ...fakeTarget(), exists: async () => false };
    await expect(confirmAndLink(port, staff, target, 42, id)).rejects.toMatchObject({ status: 404 });
  });
});

describe("resolveFile", () => {
  it("resolves a new file id to the file's public address", async () => {
    const { port, files } = fakeFiles();
    files.set(ID, { id: ID, status: "active", filename: "p.png", contentType: "image/png", size: 1, visibility: "public", retentionType: "permanent" });
    expect(await resolveFile(port, staff, ID)).toEqual({ kind: "file", url: `https://cdn.test/${ID}`, private: false });
  });

  it("resolves a private file id to its short-lived address and marks it private", async () => {
    const { port, files } = fakeFiles();
    files.set(ID, { id: ID, status: "active", filename: "r.pdf", contentType: "application/pdf", size: 1, visibility: "private", retentionType: "permanent" });
    expect(await resolveFile(port, staff, ID)).toEqual({ kind: "file", url: `https://storage.test/signed/${ID}?sig=abc`, private: true });
  });

  it.each(["/uploads/receipts/abc_receipt.jpg", "uploads/products/x.png", "/api/scms/uploads/batches/x.png", "https://old.example/x.png", "data:image/png;base64,AAAA"])(
    "resolves the old stored path %s to the placeholder without calling the gateway",
    async (path) => {
      const { port } = fakeFiles();
      port.view = async () => { throw new Error("gateway must not be called"); };
      expect(await resolveFile(port, staff, path)).toEqual({ kind: "placeholder", url: FILE_PLACEHOLDER, private: false });
    },
  );

  it.each([null, undefined, "", "  "])("resolves a missing reference (%j) to the placeholder", async (ref) => {
    const { port } = fakeFiles();
    expect((await resolveFile(port, staff, ref)).kind).toBe("placeholder");
  });

  it("resolves an id the gateway does not know to the placeholder", async () => {
    const { port } = fakeFiles();
    expect((await resolveFile(port, staff, ID)).kind).toBe("placeholder");
  });
});
