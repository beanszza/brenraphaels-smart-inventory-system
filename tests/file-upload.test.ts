import { describe, expect, it } from "vitest";
import { FILE_PLACEHOLDER } from "@/lib/files";
import { resolveFileUrl, uploadFile } from "@/lib/file-upload";

const ID = "3f2b8c1e-5a4d-4c6e-9b7a-1d2e3f4a5b6c";
const image = new File([new Uint8Array(5)], "jam.png", { type: "image/png" });

type Call = { url: string; init?: RequestInit };
function fakeFetch(responses: Array<Response | Error>) {
  const calls: Call[] = [];
  const fetcher = async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    const next = responses.shift();
    if (!next) throw new Error("unexpected request");
    if (next instanceof Error) throw next;
    return next;
  };
  return { fetcher: fetcher as typeof fetch, calls };
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe("uploadFile", () => {
  it("asks for an address, sends the bytes straight to storage, then confirms", async () => {
    const { fetcher, calls } = fakeFetch([
      json({ fileId: ID, uploadUrl: "https://storage.test/put?sig=1", uploadUrlExpiresInSeconds: 600 }, 201),
      new Response(null, { status: 200 }),
      json({ fileId: ID, status: "active" }),
    ]);

    await expect(uploadFile("/api/finished-products/42/file", image, fetcher)).resolves.toBe(ID);

    expect(calls.map((c) => [c.init?.method, c.url])).toEqual([
      ["POST", "/api/finished-products/42/file/upload"],
      ["PUT", "https://storage.test/put?sig=1"],
      ["POST", "/api/finished-products/42/file/confirm"],
    ]);
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({ filename: "jam.png", contentType: "image/png", size: 5 });
    expect(calls[1].init?.body).toBe(image);
    expect((calls[1].init?.headers as Record<string, string>)["Content-Type"]).toBe("image/png");
    expect(calls[1].init?.credentials).toBe("omit");
    expect(JSON.parse(String(calls[2].init?.body))).toEqual({ fileId: ID });
  });

  it("never sends the bytes through our own server", async () => {
    const { fetcher, calls } = fakeFetch([
      json({ fileId: ID, uploadUrl: "https://storage.test/put", uploadUrlExpiresInSeconds: 600 }, 201),
      new Response(null, { status: 200 }),
      json({ fileId: ID, status: "active" }),
    ]);
    await uploadFile("/api/finished-products/42/file", image, fetcher);
    expect(calls.filter((c) => c.init?.body === image).map((c) => c.url)).toEqual(["https://storage.test/put"]);
  });

  it("reports the server's reason when the address is refused, without uploading", async () => {
    const { fetcher, calls } = fakeFetch([json({ message: "The file must be between 1 byte and 10 MB." }, 400)]);
    await expect(uploadFile("/api/finished-products/42/file", image, fetcher)).rejects.toThrow("The file must be between 1 byte and 10 MB.");
    expect(calls).toHaveLength(1);
  });

  it("fails without confirming when storage rejects the bytes", async () => {
    const { fetcher, calls } = fakeFetch([
      json({ fileId: ID, uploadUrl: "https://storage.test/put", uploadUrlExpiresInSeconds: 600 }, 201),
      new Response("denied", { status: 403 }),
    ]);
    await expect(uploadFile("/api/finished-products/42/file", image, fetcher)).rejects.toThrow("could not be uploaded");
    expect(calls).toHaveLength(2);
  });

  it("uses a generic message when the failure has no readable reason", async () => {
    const { fetcher } = fakeFetch([new Response("<html>", { status: 502 })]);
    await expect(uploadFile("/api/finished-products/42/file", image, fetcher)).rejects.toThrow("could not be uploaded");
  });
});

describe("resolveFileUrl", () => {
  it("returns the address the server resolved", async () => {
    const { fetcher, calls } = fakeFetch([json({ kind: "file", url: "https://storage.test/jam.png", private: false })]);
    await expect(resolveFileUrl("/api/finished-products/42/file", fetcher)).resolves.toBe("https://storage.test/jam.png");
    expect(calls[0].url).toBe("/api/finished-products/42/file");
  });

  it("shows the placeholder for an old record whose file no longer exists", async () => {
    const { fetcher } = fakeFetch([json({ kind: "placeholder", url: FILE_PLACEHOLDER, private: false })]);
    await expect(resolveFileUrl("/api/finished-products/42/file", fetcher)).resolves.toBe(FILE_PLACEHOLDER);
  });

  it("falls back to the placeholder when the lookup fails", async () => {
    const { fetcher } = fakeFetch([json({ message: "down" }, 502)]);
    await expect(resolveFileUrl("/api/finished-products/42/file", fetcher)).resolves.toBe(FILE_PLACEHOLDER);
    const network = fakeFetch([new Error("offline")]);
    await expect(resolveFileUrl("/api/finished-products/42/file", network.fetcher)).resolves.toBe(FILE_PLACEHOLDER);
  });
});
