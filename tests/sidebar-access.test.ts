import { describe, expect, it } from "vitest";
import { modulesFor } from "@/lib/portal/access";
import type { PortalPort, Validation } from "@/lib/portal/client";
import { moduleForPath, visibleNavGroups } from "@/components/shared/SidebarNav";

const staff = {
  id: "staff-1",
  name: "Ada",
  username: "2026-AB-001",
  email: "ada@example.com",
};
const holding = (held: string[]): PortalPort => ({
  exchange: async () => ({ ok: false, reason: "rejected" }),
  validate: async (_handle, module): Promise<Validation> =>
    held.includes(module) ? { decision: "allowed", staff } : { decision: "denied" },
});
const names = (groups: ReturnType<typeof visibleNavGroups>) =>
  groups.flatMap((g) => g.items.map((i) => i.name));

describe("Modules held by Staff", () => {
  it("lists exactly the Modules the Portal allows, plus Dashboard", async () => {
    const result = await modulesFor("handle", {
      portal: holding(["Inventory", "Production & Quality"]),
    });
    expect(result).toEqual({
      decision: "allowed",
      staff,
      modules: ["Dashboard", "Inventory", "Production & Quality"],
    });
  });
  it("denies Staff holding no Module", async () => {
    expect(await modulesFor("handle", { portal: holding([]) })).toEqual({
      decision: "denied",
    });
  });
  it("reflects a revoked Module on the next load", async () => {
    let held = ["Inventory", "Stock Transfer"];
    const portal: PortalPort = {
      ...holding([]),
      validate: async (h, m) => holding(held).validate(h, m),
    };
    const first = await modulesFor("handle", { portal });
    held = ["Inventory"];
    const second = await modulesFor("handle", { portal });
    expect(first.decision === "allowed" && first.modules).toContain("Stock Transfer");
    expect(second.decision === "allowed" && second.modules).not.toContain("Stock Transfer");
  });
  it("passes through invalid sessions and outages", async () => {
    expect(await modulesFor(undefined, { portal: holding(["Inventory"]) })).toEqual({
      decision: "invalid",
    });
    const outage: PortalPort = {
      ...holding([]),
      validate: async () => ({ decision: "unavailable" }),
    };
    expect(await modulesFor("handle", { portal: outage })).toEqual({
      decision: "unavailable",
    });
    const throwing: PortalPort = {
      ...holding([]),
      validate: async () => {
        throw new Error("offline");
      },
    };
    expect(await modulesFor("handle", { portal: throwing })).toEqual({
      decision: "unavailable",
    });
  });
  it("lets an invalid session win over concurrent allowed answers", async () => {
    const portal: PortalPort = {
      ...holding([]),
      validate: async (_h, module): Promise<Validation> =>
        module === "Inventory"
          ? { decision: "allowed", staff }
          : { decision: "invalid" },
    };
    expect(await modulesFor("handle", { portal })).toEqual({ decision: "invalid" });
  });
});

describe("Sidebar items", () => {
  it("shows Head Cook-style access as exactly Inventory, Production & Quality and Dashboard", () => {
    expect(
      names(visibleNavGroups(["Dashboard", "Inventory", "Production & Quality"])),
    ).toEqual(["Dashboard", "Inventory", "Production & Quality"]);
  });
  it("drops groups left empty", () => {
    const groups = visibleNavGroups(["Dashboard"]);
    expect(groups.map((g) => g.label)).toEqual(["Core"]);
  });
  it("shows nothing when no Module is held", () => {
    expect(visibleNavGroups([])).toEqual([]);
  });
});

describe("Owning Module of a page address", () => {
  it.each([
    ["/", "Dashboard"],
    ["/inventory", "Inventory"],
    ["/orders-procurement/edit-pr/42", "Orders & Procurement"],
    ["/resources-suppliers/logs", "Resources & Suppliers"],
    ["/traceability", "Inventory"],
    ["/stock-transfer", "Stock Transfer"],
    ["/distribution-analytics", "Stock Transfer"],
    ["/distribution", "Stock Transfer"],
  ])("%s belongs to %s", (path, module) => {
    expect(moduleForPath(path)).toBe(module);
  });
  it("does not match on a shared string prefix", () => {
    expect(moduleForPath("/inventory-secrets")).toBeUndefined();
  });
  it("has no Module for an unknown address", () => {
    expect(moduleForPath("/settings")).toBeUndefined();
  });
});
