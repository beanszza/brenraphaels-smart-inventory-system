import type { NotificationRecord } from "@/lib/gateway/notifications";
import type { NotificationSnapshot } from "./client";

export type LiveEvent =
  | { type: "notification.created"; notification: NotificationRecord }
  | { type: "notifications.read"; ids: string[] };

/** Validate the wire schema before allowing an event to change the inbox. */
export function parseLiveEvent(frame: unknown): LiveEvent | null {
  if (typeof frame !== "string") return null;
  try {
    const event = JSON.parse(frame);
    if (!event || typeof event !== "object") return null;
    if (event.type === "notifications.read" && Array.isArray(event.ids) &&
      event.ids.every((id: unknown) => typeof id === "string" && id.length > 0)) {
      return { type: event.type, ids: [...new Set<string>(event.ids)] };
    }
    const n = event.notification;
    if (event.type !== "notification.created" || !n || typeof n !== "object") return null;
    if (!["id", "type", "title", "body", "sendingApp", "targetApp", "userId", "createdAt"].every((key) => typeof n[key] === "string") ||
      !n.id || n.targetApp !== "IMS" || !Number.isFinite(Date.parse(n.createdAt)) ||
      !(n.link === null || typeof n.link === "string") ||
      !(n.readAt === null || (typeof n.readAt === "string" && Number.isFinite(Date.parse(n.readAt))))) return null;
    return { type: event.type, notification: n };
  } catch { return null; }
}

export function applyLiveEvent(snapshot: NotificationSnapshot, event: LiveEvent): NotificationSnapshot {
  if (event.type === "notification.created") {
    const n = event.notification;
    if (snapshot.notifications.some((item) => item.id === n.id)) return snapshot;
    return {
      notifications: [{ id: n.id, title: n.title, description: n.body, createdAt: n.createdAt, readAt: n.readAt }, ...snapshot.notifications].slice(0, 20),
      unreadCount: snapshot.unreadCount + (n.readAt === null ? 1 : 0),
    };
  }
  let changed = 0;
  const notifications = snapshot.notifications.map((n) => {
    if (n.readAt !== null || !event.ids.includes(n.id)) return n;
    changed++;
    return { ...n, readAt: new Date().toISOString() };
  });
  return { notifications, unreadCount: Math.max(0, snapshot.unreadCount - changed) };
}

export function needsLiveRefresh(snapshot: NotificationSnapshot, event: LiveEvent): boolean {
  return event.type === "notifications.read" && event.ids.some((id) => !snapshot.notifications.some((n) => n.id === id));
}

export type LiveSocket = {
  onopen: (() => void) | null;
  onmessage: ((message: { data: unknown }) => void) | null;
  onerror: (() => void) | null;
  onclose: (() => void) | null;
  close(): void;
};

type Options = {
  getTicket: () => Promise<{ url: string; ticket: string } | null>;
  onCreated: (notification: NotificationRecord) => void;
  onRead: (ids: string[]) => void;
  onState: (connected: boolean) => void;
  resync: () => void;
  createSocket?: (url: string) => LiveSocket;
  random?: () => number;
};

/** Owns the socket and retries for one mounted Staff identity. */
export function connectNotificationLive(options: Options): () => void {
  let stopped = false;
  let connecting = false;
  let connected = false;
  let attempt = 0;
  let generation = 0;
  let socket: LiveSocket | null = null;
  let retry: ReturnType<typeof setTimeout> | undefined;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  function state(open: boolean) {
    connected = open;
    options.onState(open);
  }
  function disconnect() {
    generation++;
    connecting = false;
    clearTimeout(timeout);
    const old = socket;
    socket = null;
    if (old) {
      old.onopen = old.onmessage = old.onerror = old.onclose = null;
      old.close();
    }
  }
  function schedule() {
    if (stopped || (typeof document !== "undefined" && document.hidden) || retry !== undefined) return;
    const base = 1000 * 2 ** Math.min(attempt++, 5);
    const delay = Math.min(30_000, base * (1 + (options.random ?? Math.random)() * 0.25));
    retry = setTimeout(() => { retry = undefined; void open(); }, delay);
  }
  function failed() {
    disconnect();
    state(false);
    schedule();
  }
  async function open() {
    if (stopped || (typeof document !== "undefined" && document.hidden) || connecting || socket) return;
    connecting = true;
    const current = ++generation;
    // Covers a stalled ticket request as well as an upgrade which never finishes.
    timeout = setTimeout(failed, 15_000);
    try {
      const ticket = await options.getTicket();
      if (stopped || current !== generation) return;
      if (!ticket) { failed(); return; }
      const url = new URL(ticket.url);
      url.searchParams.set("ticket", ticket.ticket);
      const ws = options.createSocket ? options.createSocket(url.toString()) : new WebSocket(url) as unknown as LiveSocket;
      socket = ws;
      ws.onopen = () => {
        clearTimeout(timeout);
        connecting = false;
        attempt = 0;
        state(true);
        options.resync();
      };
      ws.onmessage = ({ data }) => {
        const event = parseLiveEvent(data);
        if (event?.type === "notification.created") options.onCreated(event.notification);
        if (event?.type === "notifications.read") options.onRead(event.ids);
      };
      ws.onerror = ws.onclose = failed;
    } catch {
      if (!stopped && current === generation) failed();
    }
  }
  function resume() {
    if (typeof document !== "undefined" && document.hidden) {
      clearTimeout(retry);
      retry = undefined;
      // Keep a healthy socket, but cancel an in-flight connection or ticket.
      if (connecting) { disconnect(); state(false); }
      return;
    }
    if (!connected && retry === undefined) void open();
  }
  state(false);
  if (typeof document !== "undefined") document.addEventListener("visibilitychange", resume);
  void open();
  return () => {
    stopped = true;
    disconnect();
    clearTimeout(retry);
    if (typeof document !== "undefined") document.removeEventListener("visibilitychange", resume);
  };
}

/** Retain the merged bell API while sharing validated events and connection teardown. */
export type LiveOptions = {
  onSync: () => void;
  onCreated?: (notification: NotificationRecord) => void;
  onRead?: (ids: string[]) => void;
  createSocket?: (url: string) => LiveSocket;
  random?: () => number;
} & ({ getTicket: Options["getTicket"]; getUrl?: never } | { getUrl: () => Promise<string>; getTicket?: never });

export function startLiveNotifications(options: LiveOptions) {
  return connectNotificationLive({
    getTicket: options.getTicket ?? (async () => {
      const address = new URL(await options.getUrl!());
      const ticket = address.searchParams.get("ticket");
      if (!ticket) return null;
      address.searchParams.delete("ticket");
      return { url: address.toString(), ticket };
    }),
    onCreated: options.onCreated ?? options.onSync,
    onRead: options.onRead ?? options.onSync,
    onState: () => {},
    resync: options.onSync,
    createSocket: options.createSocket,
    random: options.random,
  });
}
