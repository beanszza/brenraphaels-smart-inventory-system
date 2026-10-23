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
  link?: string;
};

/** The notification half of the gateway as IMS uses it; replaced with a fake in tests. */
export interface NotificationGatewayPort {
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
    await call(`/${encodeURIComponent(id)}/read`, { method: "POST", body: Object.fromEntries(inbox(userId)) });
  },

  async markAllRead(userId) {
    await call("/read-all", { method: "POST", body: Object.fromEntries(inbox(userId)) });
  },
};
