import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createLiveStock, isStockChanged } from "@/lib/inventory/stock-live";

class FakeSocket {
  static all: FakeSocket[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((message: { data: unknown }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  closed = false;
  constructor(public url: string) { FakeSocket.all.push(this); }
  close() { this.closed = true; this.onclose?.(); }
}

beforeEach(() => { vi.useFakeTimers(); FakeSocket.all = []; });
afterEach(() => { vi.useRealTimers(); });

const setup = (getUrl = vi.fn(async () => "wss://gw.test/notifications/stock/staff/live?ticket=t")) => {
  const refresh = vi.fn();
  const store = createLiveStock({ getUrl, refresh, createSocket: (url) => new FakeSocket(url) as unknown as WebSocket, random: () => 1 });
  return { store, refresh, getUrl };
};

it("reads only stock.changed frames", () => {
  expect(isStockChanged(JSON.stringify({ type: "stock.changed", sizeId: "22" }))).toBe(true);
  expect(isStockChanged(JSON.stringify({ type: "orders.changed" }))).toBe(false);
  expect(isStockChanged("not json")).toBe(false);
});

it("opens the socket only while subscribed and refreshes once for a burst of stock events", async () => {
  const { store, refresh, getUrl } = setup();
  expect(getUrl).not.toHaveBeenCalled();
  const unsubscribe = store.subscribe(() => {});
  await vi.advanceTimersByTimeAsync(0);
  const socket = FakeSocket.all[0];
  socket.onopen?.();
  expect(store.getSnapshot()).toBe("live");
  expect(refresh).not.toHaveBeenCalled();
  for (const id of ["11", "12", "22"]) socket.onmessage?.({ data: JSON.stringify({ type: "stock.changed", sizeId: id }) });
  socket.onmessage?.({ data: JSON.stringify({ type: "other" }) });
  await vi.advanceTimersByTimeAsync(200);
  expect(refresh).toHaveBeenCalledTimes(1);
  unsubscribe();
  expect(socket.closed).toBe(true);
});

it("never refreshes on a timer while idle, and catches up once after a reconnect", async () => {
  const { store, refresh, getUrl } = setup();
  store.subscribe(() => {});
  await vi.advanceTimersByTimeAsync(0);
  FakeSocket.all[0].onopen?.();
  await vi.advanceTimersByTimeAsync(10 * 60_000);
  expect(refresh).not.toHaveBeenCalled();
  expect(getUrl).toHaveBeenCalledTimes(1);
  FakeSocket.all[0].onclose?.();
  expect(store.getSnapshot()).toBe("offline");
  await vi.advanceTimersByTimeAsync(1_000);
  FakeSocket.all[1].onopen?.();
  await vi.advanceTimersByTimeAsync(200);
  expect(refresh).toHaveBeenCalledTimes(1);
  expect(getUrl).toHaveBeenCalledTimes(2);
});
