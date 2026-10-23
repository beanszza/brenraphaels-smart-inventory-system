import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { recordKnownStaff, type KnownStaffRecord, type KnownStaffStore } from "@/lib/known-staff";
import {
  countUnreadNotifications,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  notifyModule,
  notifyStaff,
} from "@/lib/notifications";
import type { NotificationGatewayPort, NotificationInput, NotificationRecord } from "@/lib/gateway/notifications";
import type { Module } from "@/lib/portal/config";
import { callback, login } from "@/lib/portal/handoff";
import { HANDOFF_COOKIE } from "@/lib/portal/config";
import { FakePortal, portalFetch, FAKE_PORTAL_URL, FAKE_SECRET } from "./fake-portal";

const ada = { id: "u-ada", name: "Ada", username: "2026-AB-001", email: "ada@example.com" };
const ben = { id: "u-ben", name: "Ben", username: "2026-AB-002", email: "ben@example.com" };
const message: NotificationInput = { type: "approval", title: "Waiting", body: "PO-1 needs approval" };

function fakeStore(): KnownStaffStore & { rows: Map<string, KnownStaffRecord> } {
  const rows = new Map<string, KnownStaffRecord>();
  return {
    rows,
    upsert: async (record) => void rows.set(record.staffId, record),
    holding: async (module) => [...rows.values()].filter((r) => r.modules.includes(module)),
  };
}

/** An in-memory notification service that, like the real one, keeps an inbox per user id. */
function fakeGateway() {
  const sent: { userIds: string[]; input: NotificationInput }[] = [];
  const inbox = new Map<string, NotificationRecord[]>();
  const gateway: NotificationGatewayPort = {
    async send(userIds, input) {
      sent.push({ userIds, input });
      for (const userId of userIds) {
        const list = inbox.get(userId) ?? [];
        list.unshift({ ...input, link: input.link ?? null, id: `${userId}-${list.length}`, sendingApp: "IMS", targetApp: "IMS", userId, createdAt: "2026-01-01T00:00:00Z", readAt: null });
        inbox.set(userId, list);
      }
    },
    list: async (userId, { limit }) => (inbox.get(userId) ?? []).slice(0, limit),
    countUnread: async (userId) => (inbox.get(userId) ?? []).filter((n) => !n.readAt).length,
    markRead: async (userId, id) => void (inbox.get(userId) ?? []).forEach((n) => n.id === id && (n.readAt = "now")),
    markAllRead: async (userId) => void (inbox.get(userId) ?? []).forEach((n) => (n.readAt = "now")),
  };
  return { gateway, sent };
}

async function known(store: KnownStaffStore, staff: typeof ada, modules: Module[]) {
  await recordKnownStaff(staff, modules, store);
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("Known Staff", () => {
  it("records a Staff member with their Modules and refreshes them on the next sign-in", async () => {
    const store = fakeStore();
    await known(store, ada, ["Dashboard", "Inventory"]);
    await known(store, ada, ["Dashboard", "Goods Receiving"]);
    expect([...store.rows.values()]).toEqual([
      { staffId: "u-ada", name: "Ada", username: "2026-AB-001", modules: ["Dashboard", "Goods Receiving"] },
    ]);
  });
});

describe("sending", () => {
  it("sends to one Staff member by Portal user id", async () => {
    const { gateway, sent } = fakeGateway();
    await notifyStaff("u-ada", message, { gateway });
    expect(sent).toEqual([{ userIds: ["u-ada"], input: message }]);
  });

  it("reaches only Known Staff who held the Module", async () => {
    const store = fakeStore();
    await known(store, ada, ["Dashboard", "Inventory"]);
    await known(store, ben, ["Dashboard", "Goods Receiving"]);
    const { gateway, sent } = fakeGateway();
    await notifyModule("Inventory", message, { gateway, knownStaff: store });
    expect(sent).toEqual([{ userIds: ["u-ada"], input: message }]);
  });

  it("can leave out the Staff member whose action raised it", async () => {
    const store = fakeStore();
    await known(store, ada, ["Inventory"]);
    await known(store, ben, ["Inventory"]);
    const { gateway, sent } = fakeGateway();
    await notifyModule("Inventory", message, { gateway, knownStaff: store, except: "u-ada" });
    expect(sent[0].userIds).toEqual(["u-ben"]);
  });

  it("sends nothing when nobody known holds the Module", async () => {
    const { gateway, sent } = fakeGateway();
    await notifyModule("Inventory", message, { gateway, knownStaff: fakeStore() });
    expect(sent).toEqual([]);
  });

  it("does not fail the caller when the gateway fails, and logs it", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const { gateway } = fakeGateway();
    gateway.send = async () => {
      throw new Error("down");
    };
    await expect(notifyStaff("u-ada", message, { gateway })).resolves.toBeUndefined();
    expect(log).toHaveBeenCalled();
  });

  it("does not fail the caller when Known Staff cannot be read", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const store = fakeStore();
    store.holding = async () => {
      throw new Error("db down");
    };
    await expect(notifyModule("Inventory", message, { gateway: fakeGateway().gateway, knownStaff: store })).resolves.toBeUndefined();
    expect(log).toHaveBeenCalled();
  });
});

describe("the bell", () => {
  it("lists, counts, marks one read and marks all read for the signed-in Staff only", async () => {
    const { gateway } = fakeGateway();
    await notifyStaff("u-ada", message, { gateway });
    await notifyStaff("u-ada", { ...message, title: "Second" }, { gateway });
    await notifyStaff("u-ben", message, { gateway });

    expect((await listNotifications(ada, 20, { gateway })).map((n) => n.title)).toEqual(["Second", "Waiting"]);
    expect(await countUnreadNotifications(ada, { gateway })).toBe(2);

    const [first] = await listNotifications(ada, 20, { gateway });
    await markNotificationRead(ada, first.id, { gateway });
    expect(await countUnreadNotifications(ada, { gateway })).toBe(1);

    await markAllNotificationsRead(ada, { gateway });
    expect(await countUnreadNotifications(ada, { gateway })).toBe(0);
    expect(await countUnreadNotifications(ben, { gateway })).toBe(1);
  });
});

describe("Known Staff never grants access", () => {
  const requireModule = vi.fn();
  beforeEach(() => {
    vi.resetModules();
    requireModule.mockReset();
    vi.doMock("@/lib/portal/staff", () => ({ requireModule }));
    vi.doMock("@/lib/notifications", () => ({
      listNotifications: vi.fn(async () => []),
      countUnreadNotifications: vi.fn(async () => 0),
      markNotificationRead: vi.fn(async () => {}),
      markAllNotificationsRead: vi.fn(async () => {}),
    }));
  });
  afterEach(() => {
    vi.doUnmock("@/lib/portal/staff");
    vi.doUnmock("@/lib/notifications");
  });

  it.each(["listMyNotifications", "countMyUnreadNotifications", "markMyNotificationRead", "markAllMyNotificationsRead"] as const)(
    "%s re-checks access and stops when the Portal refuses",
    async (action) => {
      const actions = await import("@/app/actions/notifications");
      const core = await import("@/lib/notifications");
      requireModule.mockRejectedValue(new Error("NEXT_REDIRECT"));
      await expect(actions[action]("n1")).rejects.toThrow("NEXT_REDIRECT");
      expect(requireModule).toHaveBeenCalledWith("Dashboard");
      expect(Object.values(core).every((fn) => (fn as ReturnType<typeof vi.fn>).mock.calls.length === 0)).toBe(true);
    },
  );
});

describe("sign-in", () => {
  const origin = "https://localhost:3003";
  let portal: FakePortal;
  beforeEach(() => {
    vi.stubEnv("IMS_APP_URL", origin);
    vi.stubEnv("PORTAL_URL", FAKE_PORTAL_URL);
    vi.stubEnv("PORTAL_SYSTEM_SECRET", FAKE_SECRET);
    vi.stubEnv("IMS_DEV_BYPASS", "false");
    portal = new FakePortal();
    portal.addStaff(ada.id, ada, ["Inventory", "Goods Receiving"]);
    portal.signIn(ada.id);
    vi.stubGlobal("fetch", portalFetch(portal));
  });

  async function signIn(store: KnownStaffStore) {
    const started = login(new NextRequest(`${origin}/api/portal/login`));
    const authorized = await portal.handle(new Request(started.headers.get("location")!));
    const request = new NextRequest(authorized.headers.get("location")!);
    request.cookies.set(HANDOFF_COOKIE, started.cookies.get(HANDOFF_COOKIE)!.value);
    const { portalClient } = await import("@/lib/portal/client");
    return callback(request, portalClient, store);
  }

  it("records the Staff member with the Modules they hold", async () => {
    const store = fakeStore();
    await signIn(store);
    expect(store.rows.get("u-ada")).toMatchObject({ name: "Ada", modules: ["Dashboard", "Goods Receiving", "Inventory"] });
  });

  it("still signs in when Known Staff cannot be written", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const store = fakeStore();
    store.upsert = async () => {
      throw new Error("db down");
    };
    const response = await signIn(store);
    expect(response.headers.get("location")).toBe(`${origin}/`);
  });
});
