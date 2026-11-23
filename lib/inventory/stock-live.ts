/** A stock.changed frame names one Size; the notification service sends its id as a string. */
export function isStockChanged(frame: unknown): boolean {
  if (typeof frame !== "string") return false;
  try {
    const event = JSON.parse(frame);
    return event?.type === "stock.changed" && (typeof event.sizeId === "string" || typeof event.sizeId === "number");
  } catch { return false; }
}

export interface LiveStockOptions {
  getUrl: () => Promise<string | null>;
  /** Fetch the page's figures again: on a stock change, and on every (re)connect after the first. */
  refresh: () => void;
  createSocket?: (url: string) => WebSocket;
  random?: () => number;
}

export interface LiveStockStore {
  subscribe(listener: () => void): () => void;
  getSnapshot(): "connecting" | "live" | "offline";
}

/**
 * Keeps an IMS stock screen current from the Staff stock channel (the one CREOMS listens on). The socket lives while
 * someone subscribes. The only timers are the reconnect back-off and a short gather of a burst of events into one
 * refresh; neither makes a request by itself. Nothing runs on focus or visibility.
 */
export function createLiveStock(options: LiveStockOptions): LiveStockStore {
  let state: "connecting" | "live" | "offline" = "connecting";
  const listeners = new Set<() => void>();
  const set = (next: typeof state) => { if (state !== next) { state = next; for (const listener of listeners) listener(); } };
  let stop: (() => void) | null = null;

  const start = () => {
    let stopped = false;
    let socket: WebSocket | undefined;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let gather: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;
    let connectedBefore = false;
    const random = options.random ?? Math.random;

    const changed = () => {
      if (gather) return;
      gather = setTimeout(() => { gather = undefined; if (!stopped) options.refresh(); }, 150);
    };
    const reconnect = () => {
      if (stopped) return;
      set("offline");
      const ceiling = Math.min(30_000, 1_000 * 2 ** Math.min(attempts++, 5));
      retry = setTimeout(connect, ceiling * (0.5 + random() * 0.5));
    };
    const connect = async () => {
      retry = undefined;
      let url: string | null = null;
      try { url = await options.getUrl(); } catch { url = null; }
      if (stopped) return;
      if (!url) { reconnect(); return; }
      const opened = (options.createSocket ?? ((address: string) => new WebSocket(address)))(url);
      socket = opened;
      opened.onopen = () => {
        attempts = 0;
        set("live");
        // Anything that changed while the socket was down is caught up once.
        if (connectedBefore) changed();
        connectedBefore = true;
      };
      opened.onmessage = (message) => { if (isStockChanged(message.data)) changed(); };
      opened.onclose = () => { if (socket === opened) { socket = undefined; reconnect(); } };
      opened.onerror = () => opened.close();
    };
    void connect();
    return () => {
      stopped = true;
      clearTimeout(retry);
      clearTimeout(gather);
      const open = socket;
      socket = undefined;
      open?.close();
    };
  };

  return {
    subscribe(listener) {
      listeners.add(listener);
      if (!stop) stop = start();
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) { stop?.(); stop = null; state = "connecting"; }
      };
    },
    getSnapshot: () => state,
  };
}
