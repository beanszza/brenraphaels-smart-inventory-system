/**
 * Keeps one WebSocket open to the notification service and calls `onSync` to refetch the current
 * feed on every (re)connect and on every event. Nothing runs on a timer while connected; the only
 * timer is the backoff delay before reconnecting after a drop.
 */
export type LiveSocket = {
  onopen: (() => void) | null;
  onmessage: ((message: { data: unknown }) => void) | null;
  onerror: (() => void) | null;
  onclose: (() => void) | null;
  close(): void;
};

export type LiveOptions = {
  getUrl: () => Promise<string>;
  onSync: () => void;
  createSocket?: (url: string) => LiveSocket;
  random?: () => number;
};

const EVENTS = new Set(["notification.created", "notifications.read"]);

export function startLiveNotifications({ getUrl, onSync, createSocket = (url) => new WebSocket(url) as unknown as LiveSocket, random = Math.random }: LiveOptions) {
  let stopped = false;
  let socket: LiveSocket | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let failures = 0;

  function retry() {
    if (stopped || timer) return;
    const delay = Math.min(30_000, 1000 * 2 ** Math.min(failures++, 5));
    timer = setTimeout(() => { timer = undefined; void connect(); }, delay + random() * delay * 0.25);
  }

  async function connect() {
    try {
      const url = await getUrl();
      if (stopped) return;
      const connection = createSocket(url);
      socket = connection;
      // Refetch after subscribing, so an event during catch-up cannot be missed.
      connection.onopen = () => { failures = 0; onSync(); };
      connection.onmessage = (message) => {
        try {
          const event = JSON.parse(String(message.data));
          if (EVENTS.has(event?.type)) onSync();
        } catch { /* Ignore unknown frames. */ }
      };
      connection.onerror = () => connection.close();
      connection.onclose = () => { if (socket === connection) retry(); };
    } catch {
      retry();
    }
  }

  void connect();
  return () => {
    stopped = true;
    clearTimeout(timer);
    const connection = socket;
    socket = undefined;
    connection?.close();
  };
}
