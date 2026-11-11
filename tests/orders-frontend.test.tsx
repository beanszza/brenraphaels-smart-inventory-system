import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { allPages, resultData } from "@/lib/orders/screen-data";
import { loadProcurementScreen, requisitionSupplies, procurementRecipes } from "@/app/actions/orders/screens";
import { supplierItemsByItem, supplierItemsBySupplier } from "@/app/actions/orders/catalog";
import { PRTab } from "@/components/orders-procurement/pr/PRTab";
import { PRDetailsModal } from "@/components/orders-procurement/pr/PRDetailsModal";
import { CreatePRModal } from "@/components/orders-procurement/pr/CreatePRForm";
import { POTab } from "@/components/orders-procurement/po/POTab";
import { DeliveryTab } from "@/components/orders-procurement/delivery/DeliveryTab";
import type { PurchaseRequisition, PurchaseOrderPO, Delivery } from "@/components/orders-procurement/types";

const fake = vi.hoisted(() => ({ guard: vi.fn(), items: vi.fn(), recipes: vi.fn(), catalog: vi.fn(),
  requisitions: vi.fn(), orders: vi.fn(), deliveries: vi.fn() }));
vi.mock("@/lib/portal/staff", () => ({ requireModule: fake.guard }));
vi.mock("@/lib/prisma", () => ({ prisma: {
  items: { findMany: fake.items }, recipes: { findMany: fake.recipes }, supplierItems: { findMany: fake.catalog },
} }));
vi.mock("@/app/actions/orders/requisitions", () => ({ listRequisitions: fake.requisitions }));
vi.mock("@/app/actions/orders/orders", () => ({ listOrders: fake.orders }));
vi.mock("@/app/actions/orders/deliveries", () => ({ listDeliveries: fake.deliveries }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.mock("@/context/StaffContext", () => ({ useStaff: () => ({ name: "Staff", username: "staff" }) }));
vi.mock("@/lib/orders/client", () => ({ procurement: {} }));
vi.mock("@/components/resources-suppliers/ModalWrapper", () => ({
  default: ({ open, children }: { open: boolean; children: React.ReactNode }) => (open ? <div>{children}</div> : null),
}));

beforeEach(() => { vi.clearAllMocks(); fake.guard.mockResolvedValue({ username: "staff" }); });

describe("complete procurement lists", () => {
  it("keeps records beyond the API's 100-row page limit", async () => {
    const rows = Array.from({ length: 251 }, (_, id) => ({ id }));
    const result = await allPages(async query => {
      const page = Number(new URLSearchParams(query).get("page"));
      return { success: true, data: { items: rows.slice((page - 1) * 100, page * 100), totalCount: rows.length, pageSize: 100 } };
    });
    expect(result).toEqual(rows);
  });
  it("refuses a failed page instead of presenting a partial list", async () => {
    await expect(allPages(async query => new URLSearchParams(query).get("page") === "1"
      ? { success: true, data: { items: [1], totalCount: 101, pageSize: 100 } }
      : { success: false })).rejects.toThrow("could not be loaded");
    expect(() => resultData({ success: false, message: "private database detail" })).toThrow("Procurement data could not be loaded");
  });
});

for (const outcome of ["denied", "invalid session", "Portal unavailable"]) {
  it(`does not read data when access is ${outcome}`, async () => {
    fake.guard.mockRejectedValue(new Error(outcome));
    for (const read of [loadProcurementScreen, requisitionSupplies, procurementRecipes,
      () => supplierItemsByItem(1), () => supplierItemsBySupplier(1)]) {
      await expect(read()).rejects.toThrow(outcome);
    }
    expect(fake.items).not.toHaveBeenCalled();
    expect(fake.catalog).not.toHaveBeenCalled();
    expect(fake.recipes).not.toHaveBeenCalled();
    expect(fake.requisitions).not.toHaveBeenCalled();
  });
}

it("shows aggregated stock to Staff holding only procurement", async () => {
  fake.items.mockResolvedValue([{ ItemId: 5, ItemCode: "SPL-5", ItemName: "Flour", StockUomId: 2,
    Category: { CategoryName: "Ingredient" }, Uom: { Abbreviation: "kg" },
    Inventories: [{ CurrentStock: "2.5" }, { CurrentStock: "1.5" }] }]);
  expect(resultData(await requisitionSupplies())).toEqual([{ itemId: 5, itemCode: "SPL-5", itemName: "Flour",
    purchaseUomId: 2, uomName: "kg", currentStock: 4 }]);
  expect(fake.guard).toHaveBeenCalledWith("Orders & Procurement");
});

it("renders the server's rows before effects or client requests run", () => {
  const pr = { prId: 1, prNumber: "PR-SERVER", requestDate: "2026-10-24", requestedBy: "staff", department: "Inventory", status: "Draft", items: [] } as unknown as PurchaseRequisition;
  const po = { poId: 1, poNumber: "PO-SERVER", orderDate: "2026-10-24", supplierName: "Supplier", status: "Draft", items: [] } as unknown as PurchaseOrderPO;
  const delivery = { deliveryId: 1, deliveryNumber: "DEL-SERVER", supplierName: "Supplier", status: "Scheduled", items: [] } as unknown as Delivery;
  expect(renderToStaticMarkup(<PRTab initialRequisitions={[pr]} />)).toContain("PR-SERVER");
  expect(renderToStaticMarkup(<POTab initialOrders={[po]} />)).toContain("PO-SERVER");
  expect(renderToStaticMarkup(<DeliveryTab initialDeliveries={[delivery]} />)).toContain("DEL-SERVER");
});

it("shows backend approval and delivery statuses in the matching tabs", () => {
  const po = { poId: 1, poNumber: "PO-PENDING", orderDate: "2026-10-24", supplierName: "Supplier", status: "PendingApproval", items: [] } as unknown as PurchaseOrderPO;
  const html = renderToStaticMarkup(<POTab initialOrders={[po]} />);
  expect(html).toContain("PO-PENDING");
  expect(html).toContain("Pending Approval");
  expect(html).not.toContain(">PendingApproval<");
});

it("removes Converted to PO tab, sorts High priority PRs on top, and exposes full report download on Closed PRs", () => {
  const lowPr = {
    prId: 10, prNumber: "PR-LOW", requestDate: "2026-10-24", requiredDate: "2026-11-01",
    requestedBy: "staff", department: "Inventory", status: "Approved", priority: "Low",
    purpose: "Stock Replenishment", requestType: "Stock Replenishment", items: [],
  } as unknown as PurchaseRequisition;
  const highPr = {
    prId: 2, prNumber: "PR-HIGH", requestDate: "2026-10-20", requiredDate: "2026-11-01",
    requestedBy: "staff", department: "Inventory", status: "Approved", priority: "High",
    purpose: "Stock Replenishment", requestType: "Stock Replenishment", items: [],
  } as unknown as PurchaseRequisition;

  const tabHtml = renderToStaticMarkup(<PRTab initialRequisitions={[lowPr, highPr]} />);
  expect(tabHtml).not.toContain("Converted to PO");
  expect(tabHtml.indexOf("PR-HIGH")).toBeLessThan(tabHtml.indexOf("PR-LOW"));

  const closedPr = { ...highPr, status: "Closed", isFullyConvertedToPo: true } as unknown as PurchaseRequisition;
  const closedModalHtml = renderToStaticMarkup(
    <PRDetailsModal pr={closedPr} onClose={() => {}} onCreatePo={() => {}} />
  );
  expect(closedModalHtml).toContain("Download Full Report (PDF)");
  expect(closedModalHtml).not.toContain("Create Purchase Order");

  const convertedPr = { ...highPr, status: "Approved", isFullyConvertedToPo: true } as unknown as PurchaseRequisition;
  const convertedModalHtml = renderToStaticMarkup(
    <PRDetailsModal pr={convertedPr} onClose={() => {}} onCreatePo={() => {}} />
  );
  expect(convertedModalHtml).not.toContain("Create Purchase Order");
});

it("renders Low/Medium/High priority options and custom Other purpose input (50-char limit) in CreatePRModal", () => {
  const html = renderToStaticMarkup(
    <CreatePRModal
      open
      initialSupplies={[]}
      initialData={{
        prId: 1, prNumber: "PR-1", department: "Inventory", requestedBy: "Staff",
        requestDate: "2026-11-01", requiredDate: "2026-11-10", status: "Draft",
        requestType: "Custom rush request", purpose: "Custom rush request", priority: "Normal", items: [],
      }}
      onClose={() => {}}
    />
  );
  expect(html).toContain('<option value="Low">Low</option>');
  expect(html).toMatch(/<option value="Medium"[^>]*>Medium<\/option>/);
  expect(html).toContain('<option value="High">High</option>');
  expect(html).not.toContain('<option value="Normal">');
  expect(html).not.toContain('<option value="Urgent">');
  expect(html).toContain("Custom rush request");
  expect(html).toContain("19/50");
});
