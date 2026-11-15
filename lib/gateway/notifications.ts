/** The app name IMS is known by in the notification service. */
export const NOTIFICATION_APP = "IMS";

export type NotificationRecord = {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  sendingApp: string;
  targetApp: string;
  userId: string;
  createdAt: string;
  readAt: string | null;
};

export type NotificationInput = {
  type: string;
  title: string;
  body: string;
  /** Must be an absolute URL; the notification service rejects relative paths. */
  link?: string;
};

/** The notification half of the gateway as IMS uses it; replaced with a fake in tests. */
export interface NotificationGatewayPort {
  issueLiveTicket(userId: string): Promise<{ url: string; ticket: string }>;
  /** Sends one notification to each Portal user id, addressed to the app IMS. */
  send(userIds: string[], input: NotificationInput, signal: AbortSignal): Promise<void>;
  list(userId: string, options: { unreadOnly?: boolean; limit: number }): Promise<NotificationRecord[]>;
  countUnread(userId: string): Promise<number>;
  markRead(userId: string, id: string): Promise<void>;
  markAllRead(userId: string): Promise<void>;
}

export const SEND_TIMEOUT_MS = 3_000;
const READ_TIMEOUT_MS = 5_000;

function gateway() {
  const base = process.env.IMS_GATEWAY_URL;
  const key = process.env.IMS_GATEWAY_CALLER_KEY;
  if (!base || !key) throw new Error("IMS_GATEWAY_URL and IMS_GATEWAY_CALLER_KEY must be set; see .env.example");
  return { base: base.replace(/\/$/, ""), key };
}

async function call(path: string, init: { method?: string; body?: unknown; signal?: AbortSignal } = {}) {
  const { base, key } = gateway();
  const response = await fetch(`${base}/notifications${path}`, {
    method: init.method ?? "GET",
    headers: { Authorization: `Bearer ${key}`, ...(init.body ? { "Content-Type": "application/json" } : {}) },
    body: init.body ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
    signal: init.signal ?? AbortSignal.timeout(READ_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`The gateway refused the notification request: ${response.status}`);
  return response;
}

const inbox = (userId: string) => new URLSearchParams({ userId, app: NOTIFICATION_APP });

export const notificationGateway: NotificationGatewayPort = {
  async issueLiveTicket(userId) {
    const { base, key } = gateway();
    const response = await fetch(`${base}/live-tickets`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(READ_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error("Could not issue notification live ticket");
    const body: unknown = await response.json();
    if (!body || typeof body !== "object" || !("ticket" in body) || typeof body.ticket !== "string" || !body.ticket) {
      throw new Error("Invalid notification live ticket");
    }
    const url = new URL(`${base}/notifications/live`);
    if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("Invalid gateway URL");
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    return { url: url.toString(), ticket: body.ticket };
  },
  async send(userIds, input, signal) {
    await call("", {
      method: "POST",
      body: { ...input, sendingApp: NOTIFICATION_APP, targetApp: NOTIFICATION_APP, userIds },
      signal,
    });
  },

  async list(userId, { unreadOnly, limit }) {
    const query = inbox(userId);
    query.set("limit", String(Math.min(limit, 100)));
    if (unreadOnly) query.set("unread", "true");
    const body = (await (await call(`?${query}`)).json()) as { notifications: NotificationRecord[] };
    return body.notifications;
  },

  async countUnread(userId) {
    const body = (await (await call(`/unread-count?${inbox(userId)}`)).json()) as { unread: number };
    return body.unread;
  },

  async markRead(userId, id) {
    // Ids are UUIDs; anything else cannot exist, so there is nothing to mark.
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return;
    await call(`/${encodeURIComponent(id)}/read`, { method: "POST", body: Object.fromEntries(inbox(userId)) });
  },

  async markAllRead(userId) {
    await call("/read-all", { method: "POST", body: Object.fromEntries(inbox(userId)) });
  },
};

/** Compatibility URL for existing bell callers; credentials stay on the server. */
export async function notificationLiveUrl(userId: string): Promise<string> {
  const { url, ticket } = await notificationGateway.issueLiveTicket(userId);
  const address = new URL(url);
  address.searchParams.set("ticket", ticket);
  return address.toString();
}
