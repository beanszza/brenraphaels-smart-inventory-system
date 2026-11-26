import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const afterCallbacks: Array<() => Promise<void> | void> = [];
let afterOutsideRequest = false;

vi.mock("next/server", () => ({
  after: (cb: () => Promise<void> | void) => {
    if (afterOutsideRequest) throw new Error("after was called outside a request scope");
    afterCallbacks.push(cb);
  },
}));

import { stockMayHaveChanged } from "@/lib/shop/stock-events";

beforeEach(() => {
  afterCallbacks.length = 0;
  afterOutsideRequest = false;
  vi.stubEnv("CREOMS_URL", "https://creoms.test");
  vi.stubEnv("IMS_CREOMS_SECRET", "creoms-secret-at-least-thirty-two-characters");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("stockMayHaveChanged", () => {
  it("registers with Next.js after() inside a request and serializes concurrent flushes", async () => {
    const run = vi.fn(async () => {});
    stockMayHaveChanged(run);
    stockMayHaveChanged(run);

    expect(afterCallbacks).toHaveLength(2);
    expect(run).not.toHaveBeenCalled();

    await Promise.all(afterCallbacks.map((cb) => cb()));
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("falls back to the settle timer when called outside a Next.js request scope", async () => {
    vi.useFakeTimers();
    afterOutsideRequest = true;
    const run = vi.fn(async () => {});

    stockMayHaveChanged(run);
    expect(run).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1_000);
    expect(run).toHaveBeenCalledTimes(1);
  });
});
