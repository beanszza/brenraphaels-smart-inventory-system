import { describe, expect, it } from "vitest";
import { accessFor } from "@/lib/portal/access";
import type { PortalPort, Validation } from "@/lib/portal/client";

const staff = {
  id: "staff-1",
  name: "Ada",
  username: "2026-AB-001",
  email: "ada@example.com",
};
const portal: PortalPort = {
  exchange: async () => ({ ok: false, reason: "rejected" }),
  validate: async () => ({ decision: "allowed", staff }),
};

describe("Module guard through the Portal port", () => {
  it("allows Staff holding the Module", async () => {
    expect(await accessFor("handle", { portal }).check("Inventory")).toEqual({
      decision: "allowed",
      staff,
    });
  });
  it.each(["denied", "invalid", "unavailable"] as const)(
    "denies %s answers",
    async (decision) => {
      const fake = {
        ...portal,
        validate: async (): Promise<Validation> => ({ decision }),
      };
      expect(
        await accessFor("handle", { portal: fake }).check("Inventory"),
      ).toEqual({ decision });
    },
  );
  it("denies missing handles and thrown Portal failures", async () => {
    expect(await accessFor(undefined, { portal }).check("Inventory")).toEqual({
      decision: "invalid",
    });
    const offline = {
      ...portal,
      validate: async () => {
        throw new Error("offline");
      },
    };
    expect(
      await accessFor("handle", { portal: offline }).check("Inventory"),
    ).toEqual({ decision: "unavailable" });
  });
  it("checks revocation again on the next request", async () => {
    let decision: "allowed" | "denied" = "allowed";
    const fake = {
      ...portal,
      validate: async (): Promise<Validation> =>
        decision === "allowed" ? { decision, staff } : { decision },
    };
    expect(
      (await accessFor("handle", { portal: fake }).check("Inventory")).decision,
    ).toBe("allowed");
    decision = "denied";
    expect(
      (await accessFor("handle", { portal: fake }).check("Inventory")).decision,
    ).toBe("denied");
  });
  it("opens Dashboard for Staff holding any IMS Module, denying outages", async () => {
    const fake = {
      ...portal,
      validate: async (_handle: string, module: string): Promise<Validation> =>
        module === "Inventory"
          ? { decision: "allowed", staff }
          : { decision: "denied" },
    };
    expect(
      (await accessFor("handle", { portal: fake }).check("Dashboard")).decision,
    ).toBe("allowed");
    const outage = {
      ...fake,
      validate: async (handle: string, module: string): Promise<Validation> =>
        module === "Stock Transfer"
          ? { decision: "unavailable" }
          : fake.validate(handle, module),
    };
    expect(
      (await accessFor("handle", { portal: outage }).check("Dashboard"))
        .decision,
    ).toBe("unavailable");
  });
});
