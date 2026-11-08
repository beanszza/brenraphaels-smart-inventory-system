import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { Module } from "@/lib/portal/config";
import { MODULES } from "@/lib/portal/config";
import { getDashboardData } from "@/app/actions/dashboard";
import Dashboard from "@/dashboard/page";
import DashboardPage from "@/app/(root)/page";
import DashboardLoading from "@/app/(root)/loading";

const fake = vi.hoisted(() => ({
  held: [] as string[], signed: true, decision: "normal", fail: false, empty: false,
  reads: vi.fn(), validate: vi.fn(),
}));
vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
  cookies: async () => ({ get: () => fake.signed ? { value: "session" } : undefined }),
}));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(`Redirect: ${url}`); } }));
vi.mock("@/lib/portal/client", () => ({ portalClient: {
  validate: async (_handle: string, module: string) => {
    fake.validate(module);
    if (fake.decision !== "normal") return { decision: fake.decision };
    return fake.held.includes(module)
      ? { decision: "allowed", staff: { id: "staff", name: "Staff" } }
      : { decision: "denied" };
  },
} }));
const counts: Record<string, number> = {
  items: 11, suppliers: 12, purchaseRequisitions: 13, purchaseOrders: 14,
  goodsReceipts: 15, inventories: 16, productionRequests: 17, productionBatches: 18,
  stockTransferRequests: 19, stockTransfers: 20,
};
vi.mock("@/lib/prisma", () => ({ prisma: new Proxy({}, { get: (_, model: string) => {
  const read = async (args: unknown) => {
    fake.reads(model, args);
    if (fake.fail) throw new Error("Database offline");
    return model === "$queryRaw" ? [{ count: BigInt(fake.empty ? 0 : 3) }] : fake.empty ? 0 : counts[model];
  };
  return model === "$queryRaw" ? read : { count: read };
} }) }));

// The analytics queries are covered in dashboard-analytics.test.ts; here only the Module hand-off matters.
const analytics = vi.hoisted(() => ({ load: vi.fn() }));
vi.mock("@/lib/dashboard/screen-data", () => ({ loadDashboardAnalytics: analytics.load }));
const noAnalytics = {
  generatedAt: "2026-11-06T00:00:00.000Z",
  kpis: { activeInventory: null, lowStockAlerts: null, productionBatches: null, activeSuppliers: null },
  inventoryDistribution: null, procurementTrend: null, productionQuality: null, supplierPerformance: null,
  distribution: null, procurementRecommendations: null, inventoryForecasts: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  analytics.load.mockResolvedValue(noAnalytics);
  vi.stubEnv("IMS_DEV_BYPASS", "false");
  fake.held = ["Inventory"];
  fake.signed = true;
  fake.decision = "normal";
  fake.fail = false;
  fake.empty = false;
});
afterEach(() => vi.unstubAllEnvs());

it.each([
  ["unsigned", false, "normal", "/signing-in"],
  ["no Modules", true, "normal", "/no-access"],
  ["expired", true, "invalid", "/signing-in"],
  ["Portal outage", true, "unavailable", "/unavailable"],
] as const)("denies %s before all database reads", async (_, signed, decision, destination) => {
  fake.signed = signed;
  fake.decision = decision;
  fake.held = [];
  await expect(getDashboardData()).rejects.toThrow(`Redirect: ${destination}`);
  expect(fake.reads).not.toHaveBeenCalled();
});

const ownership: [Module, string[]][] = [
  ["Resources & Suppliers", ["items", "suppliers"]],
  ["Orders & Procurement", ["purchaseRequisitions", "purchaseOrders"]],
  ["Goods Receiving", ["goodsReceipts"]],
  ["Inventory", ["inventories", "$queryRaw"]],
  ["Production & Quality", ["productionRequests", "productionBatches"]],
  ["Stock Transfer", ["stockTransferRequests", "stockTransfers"]],
];
it.each(ownership)("queries only %s data for a Staff member with that Module", async (module, models) => {
  fake.held = [module];
  const result = await getDashboardData();
  expect(result.map(section => section.module)).toEqual([module]);
  expect(fake.reads.mock.calls.map(call => call[0]).sort()).toEqual([...models].sort());
  expect(fake.validate).toHaveBeenCalledTimes(6);
  // No Decimal or BigInt leaks through the server action result.
  expect(() => JSON.stringify(result)).not.toThrow();
  expect(result[0].figures.every(figure => typeof figure.value === "number")).toBe(true);
});
it("returns persisted counts for all assigned Modules", async () => {
  fake.held = [...MODULES];
  const sections = await getDashboardData();
  expect(sections).toHaveLength(6);
  expect(sections.flatMap(section => section.figures.map(figure => figure.value)))
    .toEqual([11, 12, 13, 14, 15, 16, 3, 17, 18, 19, 20]);
});
it("rechecks grants and omits revoked data on the next read", async () => {
  fake.held = ["Inventory", "Stock Transfer"];
  expect(await getDashboardData()).toHaveLength(2);
  fake.held = ["Stock Transfer"];
  fake.reads.mockClear();
  expect((await getDashboardData()).map(section => section.module)).toEqual(["Stock Transfer"]);
  expect(fake.reads.mock.calls.map(call => call[0])).toEqual(["stockTransferRequests", "stockTransfers"]);
});
it("renders persisted data on the server without disclosing other Modules", async () => {
  analytics.load.mockResolvedValue({
    ...noAnalytics,
    kpis: {
      ...noAnalytics.kpis,
      activeInventory: { value: 16, unit: "Items", trend: null },
      lowStockAlerts: { value: 3, unit: "Items", trend: null },
    },
  });
  const html = renderToStaticMarkup(await Dashboard());
  expect(html).toContain("Active Inventory");
  expect(html).toContain(">16<");
  expect(html).toContain("Low Stock Alerts");
  expect(html).toContain(">3<");
  expect(html).not.toContain("Production");
  expect(html).not.toContain("Suppliers");
  expect(html).not.toContain("localhost");
});
it("propagates database failure instead of showing invented zeros", async () => {
  analytics.load.mockRejectedValue(new Error("Database offline"));
  await expect(Dashboard()).rejects.toThrow("Database offline");
});
it("renders an empty database as zero counts", async () => {
  fake.held = [...MODULES];
  fake.empty = true;
  const sections = await getDashboardData();
  expect(sections.flatMap(section => section.figures).every(figure => figure.value === 0)).toBe(true);
  analytics.load.mockResolvedValue({
    ...noAnalytics,
    kpis: {
      activeInventory: { value: 0, unit: "Items", trend: null },
      lowStockAlerts: { value: 0, unit: "Items", trend: null },
      productionBatches: { value: 0, unit: "This month", trend: null },
      activeSuppliers: { value: 0, unit: "Suppliers", trend: null },
    },
  });
  expect(renderToStaticMarkup(await Dashboard())).toContain(">0<");
});

it("renders the dashboard header without the legacy module overview", async () => {
  fake.held = [...MODULES];
  const html = renderToStaticMarkup(await DashboardPage());
  expect(html).toContain("Dashboard");
  expect(html).not.toContain("Module overview");
  expect(html).not.toContain("Loading Dashboard");
});

it("provides an accessible card skeleton without reading or revealing Module data", () => {
  const html = renderToStaticMarkup(<DashboardLoading />);
  expect(html).toContain('role="status"');
  expect(html).toContain('aria-label="Loading Dashboard"');
  expect(html).toContain('aria-hidden="true"');
  expect(html).toContain("animate-pulse");
  expect(html).not.toContain("href=");
  expect(fake.reads).not.toHaveBeenCalled();
  expect(fake.validate).not.toHaveBeenCalled();
});

it("hands the analytics only the Modules the Staff member holds", async () => {
  fake.held = ["Inventory", "Stock Transfer"];
  await DashboardPage();
  expect(analytics.load).toHaveBeenCalledTimes(1);
  expect([...analytics.load.mock.calls[0][0]].sort()).toEqual(["Dashboard", "Inventory", "Stock Transfer"]);
});

it("renders the live analytics sections the loader returns and hides the rest", async () => {
  fake.held = ["Inventory"];
  analytics.load.mockResolvedValue({
    ...noAnalytics,
    kpis: { ...noAnalytics.kpis, activeInventory: { value: 25, unit: "Items", trend: null } },
    inventoryDistribution: [{ name: "Raw Materials", value: 25, color: "#2563eb" }],
  });
  const html = renderToStaticMarkup(await DashboardPage());
  expect(html).toContain("Active Inventory");
  expect(html).toContain("Inventory Distribution");
  expect(html).not.toContain("Production Quality");
  expect(html).not.toContain("Supplier Performance");
});
