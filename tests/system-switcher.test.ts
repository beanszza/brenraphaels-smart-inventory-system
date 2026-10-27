import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => vi.unstubAllEnvs());

describe("system switcher", () => {
  it("links to the Portal and every other system, with IMS as the only active one", async () => {
    const { systems } = await import("@/components/shared/SidebarNav");
    const names = systems.map((s) => s.fullName);
    expect(names).toEqual([
      "Enterprise Portal",
      "Customer Relationship Management",
      "Human Resource Management",
      "E-Commerce Storefront",
      "Point of Sale",
      "Inventory Management",
    ]);
    expect(systems.filter((s) => s.active).map((s) => s.fullName)).toEqual(["Inventory Management"]);
    for (const s of systems.filter((s) => !s.active)) expect(s.url).toMatch(/^https?:\/\//);
    expect(systems.find((s) => s.fullName === "Enterprise Portal")?.portal).toBe(true);
  });

  it("takes system addresses from the public environment", async () => {
    vi.stubEnv("NEXT_PUBLIC_CRMS_URL", "https://crms.example.com/");
    vi.resetModules();
    const { systems } = await import("@/components/shared/SidebarNav");
    expect(systems.find((s) => s.fullName.startsWith("Customer"))?.url).toBe("https://crms.example.com/");
  });
});
