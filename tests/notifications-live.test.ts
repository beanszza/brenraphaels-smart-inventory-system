import { readFileSync } from "node:fs";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { startLiveNotifications, type LiveSocket } from "@/lib/notifications/live";

class FakeSocket implements LiveSocket {
  onopen: (() => void) | null = null;
  onmessage: ((m: { data: unknown }) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;
  closed = false;
  constructor(public url: string) {}
  close() { this.closed = true; this.onclose?.(); }
}

let sockets: FakeSocket[];
let getUrl: ReturnType<typeof vi.fn<() => Promise<string>>>;
let onSync: ReturnType<typeof vi.fn<() => void>>;
const start = () => startLiveNotifications({ getUrl, onSync, createSocket: (u) => { const s = new FakeSocket(u); sockets.push(s); return s; }, random: () => 0 });
const flush = () => vi.advanceTimersByTimeAsync(0);

beforeEach(() => {
  vi.useFakeTimers();
  sockets = [];
  getUrl = vi.fn(async () => `wss://gw/notifications/live?ticket=t${sockets.length}`);
  onSync = vi.fn();
});
afterEach(() => vi.useRealTimers());

it("opens one socket and refetches the feed on connect and on events", async () => {
  start(); await flush();
  expect(sockets).toHaveLength(1);
  sockets[0].onopen!();
  expect(onSync).toHaveBeenCalledTimes(1);
  sockets[0].onmessage!({ data: JSON.stringify({ type: "notification.created" }) });
  sockets[0].onmessage!({ data: JSON.stringify({ type: "notifications.read" }) });
  expect(onSync).toHaveBeenCalledTimes(3);
  sockets[0].onmessage!({ data: JSON.stringify({ type: "other" }) });
  sockets[0].onmessage!({ data: "not json" });
  expect(onSync).toHaveBeenCalledTimes(3);
});

it("makes no requests or timers while connected and idle", async () => {
  start(); await flush(); sockets[0].onopen!();
  const calls = onSync.mock.calls.length;
  await vi.advanceTimersByTimeAsync(10 * 60_000);
  expect(onSync).toHaveBeenCalledTimes(calls);
  expect(getUrl).toHaveBeenCalledTimes(1);
  expect(vi.getTimerCount()).toBe(0);
});

it("reconnects with a fresh ticket and exponential backoff, then catches up", async () => {
  start(); await flush();
  sockets[0].onclose!();
  await vi.advanceTimersByTimeAsync(999); expect(sockets).toHaveLength(1);
  await vi.advanceTimersByTimeAsync(1); expect(sockets).toHaveLength(2);
  expect(sockets[1].url).not.toBe(sockets[0].url);
  sockets[1].onclose!();
  await vi.advanceTimersByTimeAsync(1999); expect(sockets).toHaveLength(2);
  await vi.advanceTimersByTimeAsync(1); expect(sockets).toHaveLength(3);
  sockets[2].onopen!();
  expect(onSync).toHaveBeenCalledTimes(1);
  sockets[2].onclose!();
  await vi.advanceTimersByTimeAsync(1000); expect(sockets).toHaveLength(4);
});

it("retries when the ticket request fails", async () => {
  getUrl.mockRejectedValueOnce(new Error("down"));
  start(); await flush();
  expect(sockets).toHaveLength(0);
  await vi.advanceTimersByTimeAsync(1000);
  expect(sockets).toHaveLength(1);
});

it("stops cleanly: closes the socket and never reconnects", async () => {
  const stop = start(); await flush();
  stop();
  expect(sockets[0].closed).toBe(true);
  await vi.advanceTimersByTimeAsync(60_000);
  expect(sockets).toHaveLength(1);
  expect(vi.getTimerCount()).toBe(0);
});

it("the bell has no focus listener or interval refetch", () => {
  const src = readFileSync("components/shared/HeaderNotifications.tsx", "utf8");
  expect(src).not.toMatch(/setInterval|addEventListener\("focus"|visibilitychange/);
  expect(src).toContain("startLiveNotifications");
  expect(src).toMatch(/onOpenChange=\{\(open\) => \{ if \(open\) void request\(\)/);
});
