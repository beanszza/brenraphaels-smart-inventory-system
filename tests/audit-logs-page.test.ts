import { beforeEach, describe, expect, it, vi } from "vitest";

const requireModule = vi.fn();
const readImsAuditEvents = vi.fn();
vi.mock("@/lib/portal/staff", () => ({ requireModule: (m: string) => requireModule(m) }));
vi.mock("@/lib/audit", () => ({ readImsAuditEvents: (o: unknown) => readImsAuditEvents(o) }));

import Page from "@/app/(root)/resources-suppliers/logs/page";

function viewProps(tree: { props: { children: { props: unknown } } }) {
  return tree.props.children.props as { initialLogs: unknown[]; unavailable: boolean };
}

beforeEach(() => {
  vi.clearAllMocks();
  requireModule.mockResolvedValue({});
  readImsAuditEvents.mockResolvedValue([]);
});

describe("IMS audit logs page", () => {
  it("requires Resources & Suppliers and reads nothing without it", async () => {
    requireModule.mockRejectedValue(new Error("NEXT_REDIRECT"));
    await expect(Page({ searchParams: Promise.resolve({}) })).rejects.toThrow("NEXT_REDIRECT");
    expect(requireModule).toHaveBeenCalledWith("Resources & Suppliers");
    expect(readImsAuditEvents).not.toHaveBeenCalled();
  });

  it("shows gateway events as log entries", async () => {
    readImsAuditEvents.mockResolvedValue([
      {
        id: "e1",
        description: "Ana approved PO-1",
        target: { display_name: "PO-1" },
        actor: { display_name: "Ana Cruz" },
        occurred_at: "2026-01-02T03:04:05.000Z",
      },
    ]);
    const props = viewProps(await Page({ searchParams: Promise.resolve({ type: "inventory" }) }) as never);
    expect(readImsAuditEvents).toHaveBeenCalledWith({ modules: ["Inventory"] });
    expect(props.initialLogs).toEqual([
      { id: "e1", activity: "Ana approved PO-1", entityName: "PO-1", timestamp: "2026-01-02T03:04:05.000Z", user: "Ana Cruz" },
    ]);
    expect(props.unavailable).toBe(false);
  });

  it("flags an unreachable gateway instead of failing", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    readImsAuditEvents.mockRejectedValue(new Error("down"));
    const props = viewProps(await Page({ searchParams: Promise.resolve({}) }) as never);
    expect(props.unavailable).toBe(true);
    expect(props.initialLogs).toEqual([]);
  });
});
