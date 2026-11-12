import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  getFutureDateError,
  getMaxFutureDateString,
  getTodayDateString,
} from "@/lib/date-limits";
import { SearchInput } from "@/components/shared/SearchInput";
import { CreatePRModal } from "@/components/orders-procurement/pr/CreatePRForm";
import { CreateDeliveryModal } from "@/components/orders-procurement/delivery/CreateDeliveryModal";
import { CreatePOModal } from "@/components/orders-procurement/po/CreatePOModal";
import { PODetailsModal } from "@/components/orders-procurement/po/PODetailsModal";
import { POApprovalModal } from "@/components/orders-procurement/po/POApprovalModal";
import { POTable } from "@/components/orders-procurement/po/POTable";
import { DeliveryDetailsModal } from "@/components/orders-procurement/delivery/DeliveryDetailsModal";
import DiscrepancyDetailsModal from "@/components/receiving/DiscrepancyDetailsModal";
import InventoryTable from "@/components/inventory/InventoryTable";
import CategoryModal from "@/components/resources-suppliers/CategoryModal";
import CategoryTable from "@/components/resources-suppliers/CategoryTable";
import ProductionRequestModal from "@/components/production/ProductionRequestModal";
import LotsTable from "@/components/lots/LotsTable";
import GrnDetailsModal from "@/components/receiving/GrnDetailsModal";
import StockInDetailsModal from "@/components/receiving/StockInDetailsModal";
import type { Delivery, PurchaseOrderPO } from "@/components/orders-procurement/types";
import type { Discrepancy, GRN, StockIn } from "@/components/receiving/types";

vi.mock("@/lib/orders/client", () => ({ procurement: {} }));
vi.mock("@/app/actions/orders/screens", () => ({ requisitionSupplies: vi.fn() }));
vi.mock("@/app/actions/orders/orders", () => ({
  listOrders: vi.fn(),
  approvePurchaseOrder: vi.fn(),
}));
vi.mock("@/app/actions/orders/deliveries", () => ({ listDeliveries: vi.fn() }));
vi.mock("@/context/StaffContext", () => ({
  useStaff: () => ({ name: "Staff", username: "staff" }),
  useIsAdmin: () => true,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));
vi.mock("@/components/resources-suppliers/ModalWrapper", () => ({
  default: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? <div className="font-sans">{children}</div> : null,
}));

describe("date-limits helper", () => {
  it("computes today's local YYYY-MM-DD and dynamic 10-year max limit", () => {
    const in2026 = new Date(2026, 10, 12); // Nov 12, 2026
    const in2027 = new Date(2027, 0, 5); // Jan 5, 2027

    expect(getTodayDateString(in2026)).toBe("2026-11-12");
    expect(getMaxFutureDateString(10, in2026)).toBe("2036-12-31");
    expect(getMaxFutureDateString(10, in2027)).toBe("2037-12-31");
  });

  it("rejects past dates and years beyond currentYear + 10 (including 6-digit years)", () => {
    const now = new Date(2026, 10, 12);

    expect(getFutureDateError("2026-11-11", "Required Date", { allowToday: true, now })).not.toBe("");
    expect(getFutureDateError("2026-11-12", "Required Date", { allowToday: false, now })).not.toBe("");
    expect(getFutureDateError("2026-11-12", "Required Date", { allowToday: true, now })).toBe("");
    expect(getFutureDateError("2036-12-31", "Required Date", { allowToday: true, now })).toBe("");
    expect(getFutureDateError("2037-01-01", "Required Date", { allowToday: true, now })).not.toBe("");
    expect(getFutureDateError("209029-11-12", "Required Date", { allowToday: true, now })).not.toBe("");
  });
});

describe("SearchInput visibility", () => {
  it("renders a crisp bordered search bar without bg-muted/20", () => {
    const html = renderToStaticMarkup(
      <SearchInput placeholder="Search supplies..." value="" onChange={() => { }} />
    );

    expect(html).toContain("border-border");
    expect(html).toContain("bg-secondary/50");
    expect(html).not.toContain("bg-muted/20");
    expect(html).not.toContain("shadow-sm");
    expect(html).toContain('placeholder="Search supplies..."');
  });
});

describe("Modal layout, typography, and date bounds", () => {
  it("keeps Priority before Purpose in CreatePRModal and applies dynamic future date bounds", () => {
    const html = renderToStaticMarkup(
      <CreatePRModal
        open
        initialSupplies={[]}
        initialData={{
          prId: 1,
          prNumber: "PR-1",
          department: "Inventory",
          requestedBy: "Staff",
          requestDate: "2026-11-12",
          requiredDate: "2026-11-20",
          status: "Draft",
          requestType: "Custom rush request",
          purpose: "Custom rush request",
          priority: "Medium",
          items: [],
        }}
        onClose={() => { }}
      />
    );

    expect(html.indexOf("Priority")).toBeLessThan(html.indexOf("Purpose"));
    expect(html).not.toContain("font-mono");
    expect(html).toContain(`max="${getMaxFutureDateString()}"`);
  });

  it("removes font-mono and applies dynamic date caps in CreateDeliveryModal and POApprovalModal", () => {
    const deliveryHtml = renderToStaticMarkup(
      <CreateDeliveryModal open onClose={() => { }} onSuccess={() => { }} />
    );
    expect(deliveryHtml).not.toContain("font-mono");

    const po = {
      poId: 7,
      poNumber: "PO-2026-0007",
      prId: 1,
      supplierId: 1,
      supplierName: "Acme Supplies",
      orderDate: "2026-11-10",
      status: "Sent",
      totalAmount: 1000,
      items: [
        {
          poItemId: 1,
          itemId: 10,
          itemName: "Sugar",
          purchaseUomName: "kg",
          poItemQuantity: 10,
          unitPrice: 100,
          totalPrice: 1000,
        },
      ],
    } as unknown as PurchaseOrderPO;

    const approvalHtml = renderToStaticMarkup(
      <POApprovalModal po={po} onClose={() => { }} onSuccess={() => { }} />
    );
    expect(approvalHtml).not.toContain("font-mono");
    expect(approvalHtml).toContain(`max="${getTodayDateString()}"`);
    expect(approvalHtml).not.toContain("Expected Arrival Date");
  });

  it("renders updated CreatePOModal search bar and removes Back to Requisitions copy", () => {
    const html = renderToStaticMarkup(
      <CreatePOModal open onClose={() => { }} onSuccess={() => { }} />
    );
    expect(html).toContain('placeholder="Search requisitions..."');
    expect(html).toContain("bg-secondary/50");
    expect(html).not.toContain("Back to Requisitions");
    expect(html).not.toContain(">ACTION<");
  });

  it("hides pending prices, download button, and double PO header on Pending Approval PODetailsModal", () => {
    const pendingPo = {
      poId: 16,
      poNumber: "PO-2026-0016",
      prId: 17,
      prNumber: "PR-2026-0017",
      supplierId: 1,
      supplierName: "Jo Ann Inc.",
      requestedBy: "Vince Neil Madeja",
      orderDate: "2026-11-12",
      expectedArrivalDate: "2026-11-19",
      status: "Pending Approval",
      totalAmount: 0,
      items: [
        {
          poItemId: 1,
          itemId: 10,
          itemName: "Nestea",
          purchaseUomName: "bottle",
          poItemQuantity: 67,
          unitPrice: 0,
          totalPrice: 0,
        },
      ],
    } as unknown as PurchaseOrderPO;

    const pendingHtml = renderToStaticMarkup(
      <PODetailsModal
        po={pendingPo}
        onClose={() => { }}
        onCancel={() => { }}
        onApproveWithForm={() => { }}
      />
    );
    expect(pendingHtml).not.toContain("UNIT PRICE");
    expect(pendingHtml).not.toContain("TOTAL AMOUNT DUE");
    expect(pendingHtml).not.toContain("Download Purchase Order");
    expect(pendingHtml).toContain("Cancel Purchase Order");
    expect(pendingHtml).toContain("Approve Order");
    expect(pendingHtml.indexOf("Cancel Purchase Order")).toBeLessThan(pendingHtml.indexOf("Approve Order"));

    const approvedPo = {
      ...pendingPo,
      status: "Approved",
      totalAmount: 1340,
      items: [
        {
          poItemId: 1,
          itemId: 10,
          itemName: "Nestea",
          purchaseUomName: "bottle",
          poItemQuantity: 67,
          unitPrice: 20,
          totalPrice: 1340,
        },
      ],
    } as unknown as PurchaseOrderPO;

    const approvedHtml = renderToStaticMarkup(
      <PODetailsModal po={approvedPo} onClose={() => { }} />
    );
    expect(approvedHtml).toContain("UNIT PRICE");
    expect(approvedHtml).toContain("TOTAL AMOUNT DUE");
  });

  it("enforces Close button and required positive prices in POApprovalModal, restores Planned Dispatch Date, and hides Cancel/Schedule Delivery appropriately", () => {
    const zeroPricePo = {
      poId: 16,
      poNumber: "PO-2026-0016",
      prId: 17,
      prNumber: "PR-2026-0017",
      supplierId: 1,
      supplierName: "Jo Ann Inc.",
      orderDate: "2026-11-12",
      status: "Pending Approval",
      totalAmount: 0,
      items: [
        {
          poItemId: 1,
          itemId: 10,
          itemName: "Nestea",
          purchaseUomName: "bottle",
          poItemQuantity: 67,
          unitPrice: 0,
          totalPrice: 0,
        },
      ],
    } as unknown as PurchaseOrderPO;

    const approvalHtml = renderToStaticMarkup(
      <POApprovalModal po={zeroPricePo} onClose={() => { }} onSuccess={() => { }} />
    );
    expect(approvalHtml).toContain(">Close<");
    expect(approvalHtml).not.toContain(">Cancel<");
    expect(approvalHtml).toContain("disabled=\"\"");
    expect(approvalHtml).toContain("Enter a confirmed quantity and total price greater than ₱0.00");

    const deliveryHtml = renderToStaticMarkup(
      <CreateDeliveryModal open initialPo={zeroPricePo} onClose={() => { }} onSuccess={() => { }} />
    );
    expect(deliveryHtml).toContain("Planned Dispatch Date");

    const approvedPo = {
      ...zeroPricePo,
      status: "Approved",
      hasRemainingToSchedule: true,
    } as unknown as PurchaseOrderPO;
    const approvedDetailsHtml = renderToStaticMarkup(
      <PODetailsModal
        po={approvedPo}
        onClose={() => { }}
        onCancel={() => { }}
        onCreateDelivery={() => { }}
      />
    );
    expect(approvedDetailsHtml).not.toContain("Cancel Purchase Order");
    expect(approvedDetailsHtml).toContain("Schedule Delivery");

    const orderedPo = {
      ...zeroPricePo,
      status: "Ordered",
      hasRemainingToSchedule: false,
    } as unknown as PurchaseOrderPO;
    const orderedDetailsHtml = renderToStaticMarkup(
      <PODetailsModal
        po={orderedPo}
        onClose={() => { }}
        onCancel={() => { }}
        onCreateDelivery={() => { }}
      />
    );
    expect(orderedDetailsHtml).not.toContain("Schedule Delivery");

    const partiallyDeliveredPo = {
      ...zeroPricePo,
      status: "Partially Delivered",
      hasRemainingToSchedule: true,
    } as unknown as PurchaseOrderPO;
    const partialDetailsHtml = renderToStaticMarkup(
      <PODetailsModal
        po={partiallyDeliveredPo}
        onClose={() => { }}
        onCancel={() => { }}
        onCreateDelivery={() => { }}
      />
    );
    expect(partialDetailsHtml).toContain("Schedule Delivery");

    const tableHtml = renderToStaticMarkup(
      <POTable orders={[approvedPo]} onView={() => { }} onCancel={() => { }} />
    );
    expect(tableHtml).not.toContain("Cancel Purchase Order");

    const rejectedDisc = {
      discrepancyId: 1,
      discrepancyNumber: "DSC-2026-0001",
      discrepancyType: "Rejected",
      grnNumber: "GRN-2026-0001",
      poNumber: "PO-2026-0016",
      itemName: "Nestea",
      orderedQuantity: 67,
      currentReceivedQty: 50,
      discrepancyQuantity: 17,
      status: "Open",
    } as unknown as Discrepancy;
    const discHtml = renderToStaticMarkup(
      <DiscrepancyDetailsModal
        discrepancy={rejectedDisc}
        open
        onClose={() => { }}
        onResolved={() => { }}
      />
    );
    expect(discHtml).toContain("Wait for Replacement Delivery");

    const scheduledDelivery = {
      deliveryId: 6,
      deliveryNumber: "DLV-2026-0006",
      poId: 16,
      poNumber: "PO-2026-0016",
      supplierName: "Jo Ann Inc.",
      status: "Scheduled",
      scheduledDate: "2026-11-12",
      items: [],
    } as unknown as Delivery;
    const deliveryDetailsHtml = renderToStaticMarkup(
      <DeliveryDetailsModal
        delivery={scheduledDelivery}
        onClose={() => { }}
        onArrive={() => { }}
        onCancel={() => { }}
      />
    );
    expect(deliveryDetailsHtml).toContain("Cancel Delivery");
    expect(deliveryDetailsHtml.indexOf("Cancel Delivery")).toBeLessThan(deliveryDetailsHtml.indexOf(">Close<"));
    expect(deliveryDetailsHtml.indexOf(">Close<")).toBeLessThan(deliveryDetailsHtml.indexOf("Confirm Arrival"));
  });
});

describe("Inventory status badges and Category HasExpiry UI", () => {
  it("renders uniform fixed-width status badges across Ingredients and Finished Goods tables", () => {
    const baseItems = [
      {
        inventoryId: 1,
        itemId: 1,
        itemName: "Sugar",
        supplyNo: "SPL-0001",
        categoryName: "Ingredients",
        uomName: "Pack",
        stockUomName: "Pack",
        stockUomAbbr: "pk",
        locationId: 1,
        locationName: "Commissary",
        currentStock: 100,
        reservedQuantity: 0,
        minStockLevel: 10,
        maxStockLevel: 120,
        isLowStock: false,
        stockStatus: "In Stock",
        lotCount: 1,
      },
      {
        inventoryId: 2,
        itemId: 2,
        itemName: "Milk",
        supplyNo: "SPL-0002",
        categoryName: "Ingredients",
        uomName: "Bottle",
        stockUomName: "Bottle",
        stockUomAbbr: "btl",
        locationId: 1,
        locationName: "Commissary",
        currentStock: 5,
        reservedQuantity: 0,
        minStockLevel: 20,
        maxStockLevel: 100,
        isLowStock: true,
        stockStatus: "Low Stock",
        lotCount: 1,
      },
      {
        inventoryId: 3,
        itemId: 3,
        itemName: "PPE Mask",
        supplyNo: "SPL-0003",
        categoryName: "Tools & Supplies",
        uomName: "Box",
        stockUomName: "Box",
        stockUomAbbr: "box",
        locationId: 1,
        locationName: "Commissary",
        currentStock: 0,
        reservedQuantity: 0,
        minStockLevel: 5,
        maxStockLevel: 50,
        isLowStock: true,
        stockStatus: "Out of Stock",
        lotCount: 0,
      },
    ];

    const ingHtml = renderToStaticMarkup(
      <InventoryTable items={baseItems} currentPage={1} pageSize={10} />
    );
    const fgHtml = renderToStaticMarkup(
      <InventoryTable items={baseItems} currentPage={1} pageSize={10} isFinishedGoods />
    );

    for (const html of [ingHtml, fgHtml]) {
      expect(html).toContain("min-w-[96px] justify-center whitespace-nowrap");
      expect(html).toContain("bg-badge-success");
      expect(html).toContain("bg-badge-warning");
      expect(html).toContain("bg-badge-destructive");
    }
  });

  it("renders CategoryModal HasExpiry checkbox and CategoryTable Expiry column", () => {
    const newCatHtml = renderToStaticMarkup(
      <CategoryModal open editingCategory={null} onClose={() => { }} onSave={() => { }} />
    );
    expect(newCatHtml).toContain("This category has an expiry date");
    expect(newCatHtml).toContain("checked");

    const tableHtml = renderToStaticMarkup(
      <CategoryTable
        items={[
          { categoryId: 1, categoryName: "Ingredients", description: "", isActive: true, hasExpiry: true, itemCount: 5 },
          { categoryId: 2, categoryName: "Tools & Supplies", description: "", isActive: true, hasExpiry: false, itemCount: 2 },
        ]}
        currentPage={1}
        pageSize={10}
        canConfigure
        onEdit={() => { }}
      />
    );
    expect(tableHtml).toContain("Has Expiry");
    expect(tableHtml).toContain("No Expiry");
  });

  it("hides Expiry columns when all rows lack expiry and shows No Expiry when mixed", () => {
    const baseLot = {
      locationId: 1,
      locationName: "Commissary",
      sourceType: "Purchase",
      supplierId: null,
      supplierName: "Acme",
      supplierLotNo: null,
      receivedDate: "2026-11-12",
      isExpired: false,
      status: "Available",
      isOpeningBalance: false,
      unitCost: 100,
    };

    const nonExpiryLotsHtml = renderToStaticMarkup(
      <LotsTable
        items={[
          {
            ...baseLot,
            lotId: 1,
            lotCode: "LOT-PPE-1",
            itemId: 1,
            itemName: "Face Mask",
            uomName: "box",
            expiryDate: null,
            quantityReceived: 10,
            quantityRemaining: 10,
          },
        ]}
        currentPage={1}
        pageSize={10}
      />
    );
    expect(nonExpiryLotsHtml).not.toContain(">EXPIRY<");

    const mixedLotsHtml = renderToStaticMarkup(
      <LotsTable
        items={[
          {
            ...baseLot,
            lotId: 1,
            lotCode: "LOT-PPE-1",
            itemId: 1,
            itemName: "Face Mask",
            uomName: "box",
            expiryDate: null,
            quantityReceived: 10,
            quantityRemaining: 10,
          },
          {
            ...baseLot,
            lotId: 2,
            lotCode: "LOT-MLK-1",
            itemId: 2,
            itemName: "Milk",
            uomName: "btl",
            expiryDate: "2027-01-10",
            quantityReceived: 20,
            quantityRemaining: 20,
          },
        ]}
        currentPage={1}
        pageSize={10}
      />
    );
    expect(mixedLotsHtml).toContain(">EXPIRY<");
    expect(mixedLotsHtml).toContain("No Expiry");

    const grnNonExpiryHtml = renderToStaticMarkup(
      <GrnDetailsModal
        open
        onClose={() => { }}
        onUpdated={() => { }}
        onPosted={() => { }}
        grn={{
          grnId: 1,
          grnNumber: "GRN-2026-0001",
          receivedDate: "2026-11-12",
          status: "Draft",
          physicalQuantityVerified: true,
          expiryDatesChecked: false,
          items: [
            {
              itemId: 1,
              itemName: "Mixer",
              orderedQuantity: 1,
              previouslyReceivedQuantity: 0,
              declaredQuantity: 1,
              deliveredQuantity: 1,
              varianceQuantity: 0,
              purchaseUomName: "unit",
              expiryDate: null,
            },
          ],
        } as unknown as GRN}
      />
    );
    expect(grnNonExpiryHtml).not.toContain("Expiry Date");

    const stockInNonExpiryHtml = renderToStaticMarkup(
      <StockInDetailsModal
        open
        onClose={() => { }}
        onSuccess={() => { }}
        stockIn={{
          stockInId: 1,
          stockInNumber: "SI-2026-0001",
          status: "Committed",
          grnId: 1,
          grnNumber: "GRN-2026-0001",
          createdAt: "2026-11-12",
          lines: [
            {
              lineId: 1,
              itemId: 1,
              itemName: "Mixer",
              purchaseUomName: "unit",
              quantityToStock: 1,
              lotId: 1,
              lotCode: "LOT-MIX-1",
              expiryDate: null,
            },
          ],
        } as unknown as StockIn}
      />
    );
    expect(stockInNonExpiryHtml).not.toContain("Expiry Date");
  });

  it("matches resources-suppliers modal typography, aligns Target Output Quantity, and puts calendar icon on far right in ProductionRequestModal", () => {
    const html = renderToStaticMarkup(
      <ProductionRequestModal open onClose={() => { }} onSuccess={() => { }} />
    );

    expect(html).toContain("font-sans");
    expect(html).not.toContain("font-mono");
    // Labels use block text-xs font-semibold like CategoryModal / SupplyModal
    expect(html).toContain('class="block text-xs font-semibold text-foreground">Target Output Quantity</label>');
    // Target Output Quantity input uses h-10 text-sm and normal placeholder weight
    expect(html).toContain("placeholder:font-normal");
    expect(html).toContain("Select recipe first");
    // Required Date hides native middle calendar indicator and places lucide Calendar icon at right-3
    expect(html).toContain("pr-9");
    expect(html).toContain("right-3 top-1/2");
    expect(html).toContain("lucide-calendar");
    // Reason / Batch Purpose is constrained and Close button has no icon beside Submit for Approval
    expect(html).toContain("sm:max-w-md");
    expect(html).toContain("justify-end");
    expect(html).not.toContain("lucide-x");
    expect(html).toContain(">Close</button>");
    expect(html).not.toContain(">Cancel<");

    // View mode does not duplicate product/request summary card
    const viewHtml = renderToStaticMarkup(
      <ProductionRequestModal
        open
        onClose={() => { }}
        onSuccess={() => { }}
        initialRequest={{
          prodReqId: 4,
          reqNumber: "PRQ-2026-0004",
          productId: 1,
          productName: "Toffee Jam",
          variant: "301 Milliliters Jar",
          recipeId: 1,
          recipeName: "Tof Jeam",
          quantity: 67,
          yieldUom: "pcs",
          priority: "Medium",
          requiredDate: "2026-11-13",
          requiredTime: "08:00",
          reason: "Regular Stock Replenishment",
          status: "Pending Approval",
        } as any}
      />
    );
    expect(viewHtml).not.toContain("Request No: PRQ-2026-0004");
    expect(viewHtml).toContain("Pending Approval");
    expect(viewHtml).toContain(">Close</button>");
  });
});

