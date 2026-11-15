import { afterEach, expect, it, vi } from "vitest";
import { notificationGateway } from "@/lib/gateway/notifications";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

it("loads the bell through the gateway's notification service prefix", async () => {
  vi.stubEnv("IMS_GATEWAY_URL", "https://gateway.example/");
  vi.stubEnv("IMS_GATEWAY_CALLER_KEY", "test-key");
  const fetch = vi.fn(async (input: string) => {
    const url = new URL(input);
    if (url.pathname === "/notifications/notifications") return Response.json({ notifications: [] });
    if (url.pathname === "/notifications/notifications/unread-count") return Response.json({ unread: 0 });
    return new Response("Not Found", { status: 404 });
  });
  vi.stubGlobal("fetch", fetch);

  await expect(notificationGateway.list("portal-user", { limit: 20 })).resolves.toEqual([]);
  await expect(notificationGateway.countUnread("portal-user")).resolves.toBe(0);
  for (const [input] of fetch.mock.calls) {
    const url = new URL(input);
    expect(url.searchParams.get("userId")).toBe("portal-user");
    expect(url.searchParams.get("app")).toBe("IMS");
  }
});

it("uses the same service prefix for sending and marking notifications read", async () => {
  vi.stubEnv("IMS_GATEWAY_URL", "https://gateway.example");
  vi.stubEnv("IMS_GATEWAY_CALLER_KEY", "test-key");
  const fetch = vi.fn<(input: string, init?: RequestInit) => Promise<Response>>()
    .mockImplementation(async () => new Response(null, { status: 204 }));
  vi.stubGlobal("fetch", fetch);
  const id = "00000000-0000-4000-8000-000000000001";
  await notificationGateway.send(["portal-user"], { type: "approval", title: "Review", body: "Ready" }, AbortSignal.timeout(1000));
  await notificationGateway.markRead("portal-user", id);
  await notificationGateway.markAllRead("portal-user");
  expect(fetch.mock.calls.map(([url]) => url)).toEqual([
    "https://gateway.example/notifications/notifications",
    `https://gateway.example/notifications/notifications/${id}/read`,
    "https://gateway.example/notifications/notifications/read-all",
  ]);
});
