import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyLiveEvent, connectNotificationLive, needsLiveRefresh, parseLiveEvent } from "@/lib/notifications/live";
import { notificationGateway } from "@/lib/gateway/notifications";

const record = { id: "n1", type: "approval", title: "Ready", body: "Review batch", link: null, sendingApp: "IMS", targetApp: "IMS", userId: "ada", createdAt: "2026-11-01T00:00:00Z", readAt: null };
const requireModule = vi.hoisted(() => vi.fn());
vi.mock("@/lib/portal/staff", () => ({ requireModule }));

class Socket {
  static instances: Socket[] = [];
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  close = vi.fn();
  url: string;
  constructor(url: string | URL) { this.url = String(url); Socket.instances.push(this); }
}
let doc: EventTarget & { hidden: boolean };
let win: EventTarget;
let stop: (() => void) | undefined;
beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(Math, "random").mockReturnValue(0);
  doc = Object.assign(new EventTarget(), { hidden: false });
  win = new EventTarget();
  vi.stubGlobal("document", doc);
  vi.stubGlobal("window", win);
  vi.stubGlobal("WebSocket", Socket);
  Socket.instances = [];
  requireModule.mockReset();
});
afterEach(() => {
  stop?.(); stop = undefined;
  vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs();
});
function start(getTicket: () => Promise<{ url: string; ticket: string } | null> = vi.fn(async () => ({ url: "wss://gateway/notifications/live", ticket: "fresh" }))) {
  const callbacks = { getTicket, onCreated: vi.fn(), onRead: vi.fn(), onState: vi.fn(), resync: vi.fn() };
  stop = connectNotificationLive(callbacks);
  return callbacks;
}

describe("ticket boundary", () => {
  it("rejects invalid sessions before issuing any ticket", async () => {
    requireModule.mockRejectedValue(new Error("denied"));
    const issue = vi.spyOn(notificationGateway, "issueLiveTicket");
    const { getMyNotificationLiveTicket } = await import("@/app/actions/notifications");
    await expect(getMyNotificationLiveTicket()).rejects.toThrow("denied");
    expect(issue).not.toHaveBeenCalled();
  });
  it("takes identity only from the session and quietly falls back on ticket failure", async () => {
    requireModule.mockResolvedValue({ id: "portal-ada" });
    const issue = vi.spyOn(notificationGateway, "issueLiveTicket").mockResolvedValue({ url: "wss://gateway/notifications/live", ticket: "one-use" });
    const { getMyNotificationLiveTicket } = await import("@/app/actions/notifications");
    expect(getMyNotificationLiveTicket.length).toBe(0);
    await expect(getMyNotificationLiveTicket()).resolves.toEqual({ url: "wss://gateway/notifications/live", ticket: "one-use" });
    expect(issue).toHaveBeenCalledWith("portal-ada");
    issue.mockRejectedValue(new Error("down"));
    await expect(getMyNotificationLiveTicket()).resolves.toBeNull();
  });
  it("posts to the authenticated gateway and returns only a derived URL and ticket", async () => {
    vi.stubEnv("IMS_GATEWAY_URL", "https://gateway.example");
    vi.stubEnv("IMS_GATEWAY_CALLER_KEY", "server-only");
    const fetch = vi.fn(async () => Response.json({ ticket: "one-use", secret: "never-return" }));
    vi.stubGlobal("fetch", fetch);
    await expect(notificationGateway.issueLiveTicket("ada")).resolves.toEqual({ url: "wss://gateway.example/notifications/live", ticket: "one-use" });
    expect(fetch).toHaveBeenCalledWith("https://gateway.example/live-tickets", expect.objectContaining({
      headers: { Authorization: "Bearer server-only", "Content-Type": "application/json" },
      body: JSON.stringify({ userId: "ada" }),
    }));
  });
});

describe("wire events", () => {
  it("validates frames and ignores malformed or unknown events", () => {
    expect(parseLiveEvent(JSON.stringify({ type: "notification.created", notification: record }))).toEqual({ type: "notification.created", notification: record });
    for (const frame of ["pong", "null", "{}", '{"type":"unknown"}', JSON.stringify({ type: "notification.created", notification: { ...record, readAt: 12 } }), JSON.stringify({ type: "notifications.read", ids: [null] })]) expect(parseLiveEvent(frame)).toBeNull();
  });
  it("maps body, dedupes created records, caps the list and counts reads once", () => {
    const initial = { notifications: [], unreadCount: 0 };
    const event = { type: "notification.created" as const, notification: record };
    const created = applyLiveEvent(initial, event);
    expect(created.notifications[0].description).toBe(record.body);
    expect(created.unreadCount).toBe(1);
    expect(applyLiveEvent(created, event)).toBe(created);
    const read = applyLiveEvent(created, { type: "notifications.read", ids: [record.id, record.id, "outside"] });
    expect(read.unreadCount).toBe(0);
    expect(read.notifications[0].readAt).not.toBeNull();
    expect(needsLiveRefresh(created, { type: "notifications.read", ids: [record.id] })).toBe(false);
    expect(needsLiveRefresh(created, { type: "notifications.read", ids: ["outside"] })).toBe(true);
    expect(applyLiveEvent(read, { type: "notifications.read", ids: [record.id] }).unreadCount).toBe(0);
    let many = created;
    for (let i = 0; i < 25; i++) many = applyLiveEvent(many, { ...event, notification: { ...record, id: String(i) } });
    expect(many.notifications).toHaveLength(20);
    expect(many.unreadCount).toBe(26);
  });
});

describe("live lifecycle", () => {
  it("reconnects with a fresh ticket, resyncs on every open without polling", async () => {
    const cb = start(vi.fn(async () => ({ url: "wss://gateway/notifications/live", ticket: `ticket-${Socket.instances.length}` })));
    await vi.advanceTimersByTimeAsync(0);
    const first = Socket.instances[0];
    first.onopen!();
    expect(cb.resync).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(cb.resync).toHaveBeenCalledTimes(1);
    first.onmessage!({ data: JSON.stringify({ type: "notification.created", notification: record }) });
    expect(cb.onCreated).toHaveBeenCalledWith(record);
    first.onmessage!({ data: JSON.stringify({ type: "notifications.read", ids: ["n1"] }) });
    expect(cb.onRead).toHaveBeenCalledWith(["n1"]);
    first.onclose!();
    expect(first.close).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(999);
    expect(cb.getTicket).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(cb.getTicket).toHaveBeenCalledTimes(2);
    expect(Socket.instances[1].url).toContain("ticket=ticket-1");
    await vi.advanceTimersByTimeAsync(60_000);
    expect(cb.resync).toHaveBeenCalledTimes(1);
    Socket.instances.at(-1)!.onopen!();
    expect(cb.resync).toHaveBeenCalledTimes(2);
  });
  it("backs off ticket failures without showing errors or polling", async () => {
    const cb = start(vi.fn(async () => null));
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(1000);
    expect(cb.getTicket).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1999);
    expect(cb.getTicket).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(cb.getTicket).toHaveBeenCalledTimes(3);
    await vi.advanceTimersByTimeAsync(57_000);
    expect(cb.resync).not.toHaveBeenCalled();
    expect(cb.onState).not.toHaveBeenCalledWith(true);
  });
  it("pauses retries while hidden, resumes on visibility and closes on identity teardown", async () => {
    const cb = start();
    await vi.advanceTimersByTimeAsync(0);
    Socket.instances[0].onopen!();
    Socket.instances[0].onerror!();
    doc.hidden = true; doc.dispatchEvent(new Event("visibilitychange"));
    await vi.advanceTimersByTimeAsync(60_000);
    expect(cb.getTicket).toHaveBeenCalledTimes(1);
    doc.hidden = false; doc.dispatchEvent(new Event("visibilitychange"));
    await vi.advanceTimersByTimeAsync(0);
    expect(cb.getTicket).toHaveBeenCalledTimes(2);
    const socket = Socket.instances[1];
    socket.onopen!();
    const syncs = cb.resync.mock.calls.length;
    win.dispatchEvent(new Event("focus"));
    expect(cb.resync).toHaveBeenCalledTimes(syncs);
    stop!(); stop = undefined;
    expect(socket.close).toHaveBeenCalledOnce();
    expect(socket.onmessage).toBeNull();
    await vi.advanceTimersByTimeAsync(300_000);
    expect(cb.getTicket).toHaveBeenCalledTimes(2);
  });
  it("ignores a ticket arriving after teardown", async () => {
    let resolve!: (value: { url: string; ticket: string }) => void;
    start(vi.fn(() => new Promise<{ url: string; ticket: string }>((done) => { resolve = done; })));
    stop!(); stop = undefined;
    resolve({ url: "wss://gateway/live", ticket: "old" });
    await vi.advanceTimersByTimeAsync(0);
    expect(Socket.instances).toHaveLength(0);
  });
  it("times out a stalled upgrade and tries a fresh ticket", async () => {
    const cb = start();
    await vi.advanceTimersByTimeAsync(0);
    const stalled = Socket.instances[0];
    await vi.advanceTimersByTimeAsync(15_000);
    expect(stalled.close).toHaveBeenCalledOnce();
    expect(stalled.onopen).toBeNull();
    await vi.advanceTimersByTimeAsync(1000);
    expect(cb.getTicket).toHaveBeenCalledTimes(2);
    Socket.instances[1].onopen!();
    expect(cb.resync).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });
  it("cancels an in-flight ticket when hidden and ignores its late result", async () => {
    let resolve!: (value: { url: string; ticket: string }) => void;
    const getTicket = vi.fn<() => Promise<{ url: string; ticket: string } | null>>()
      .mockImplementationOnce(() => new Promise((done) => { resolve = done; }))
      .mockResolvedValue({ url: "wss://gateway/live", ticket: "fresh" });
    start(getTicket);
    doc.hidden = true;
    doc.dispatchEvent(new Event("visibilitychange"));
    resolve({ url: "wss://gateway/live", ticket: "expired" });
    await vi.advanceTimersByTimeAsync(60_000);
    expect(Socket.instances).toHaveLength(0);
    doc.hidden = false;
    doc.dispatchEvent(new Event("visibilitychange"));
    await vi.advanceTimersByTimeAsync(0);
    expect(Socket.instances[0].url).toContain("ticket=fresh");
  });
});
