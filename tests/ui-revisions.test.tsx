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
import type { Delivery, PurchaseOrderPO } from "@/components/orders-procurement/types";
import type { Discrepancy } from "@/components/receiving/types";

vi.mock("@/lib/orders/client", () => ({ procurement: {} }));
vi.mock("@/app/actions/orders/screens", () => ({ requisitionSupplies: vi.fn() }));
vi.mock("@/app/actions/orders/orders", () => ({
  listOrders: vi.fn(),
  approvePurchaseOrder: vi.fn(),
}));
vi.mock("@/app/actions/orders/deliveries", () => ({ listDeliveries: vi.fn() }));
vi.mock("@/context/StaffContext", () => ({
  useStaff: () => ({ name: "Staff", username: "staff" }),
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
    expect(approvalHtml).toContain(`min="${getTodayDateString()}"`);
    expect(approvalHtml).toContain(`max="${getMaxFutureDateString()}"`);
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
        onClose={() => {}}
        onCancel={() => {}}
        onApproveWithForm={() => {}}
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
      <PODetailsModal po={approvedPo} onClose={() => {}} />
    );
    expect(approvedHtml).toContain("UNIT PRICE");
    expect(approvedHtml).toContain("TOTAL AMOUNT DUE");
  });

  it("enforces Close button and required positive prices in POApprovalModal, removes Planned Dispatch Date, and hides Cancel/Schedule Delivery appropriately", () => {
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
      <POApprovalModal po={zeroPricePo} onClose={() => {}} onSuccess={() => {}} />
    );
    expect(approvalHtml).toContain(">Close<");
    expect(approvalHtml).not.toContain(">Cancel<");
    expect(approvalHtml).toContain("disabled=\"\"");
    expect(approvalHtml).toContain("Enter a confirmed quantity and total price greater than ₱0.00");

    const deliveryHtml = renderToStaticMarkup(
      <CreateDeliveryModal open initialPo={zeroPricePo} onClose={() => {}} onSuccess={() => {}} />
    );
    expect(deliveryHtml).not.toContain("Planned Dispatch Date");

    const approvedPo = {
      ...zeroPricePo,
      status: "Approved",
      hasRemainingToSchedule: true,
    } as unknown as PurchaseOrderPO;
    const approvedDetailsHtml = renderToStaticMarkup(
      <PODetailsModal
        po={approvedPo}
        onClose={() => {}}
        onCancel={() => {}}
        onCreateDelivery={() => {}}
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
        onClose={() => {}}
        onCancel={() => {}}
        onCreateDelivery={() => {}}
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
        onClose={() => {}}
        onCancel={() => {}}
        onCreateDelivery={() => {}}
      />
    );
    expect(partialDetailsHtml).toContain("Schedule Delivery");

    const tableHtml = renderToStaticMarkup(
      <POTable orders={[approvedPo]} onView={() => {}} onCancel={() => {}} />
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
        onClose={() => {}}
        onResolved={() => {}}
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
        onClose={() => {}}
        onArrive={() => {}}
        onCancel={() => {}}
      />
    );
    expect(deliveryDetailsHtml).toContain("Cancel Delivery");
    expect(deliveryDetailsHtml.indexOf("Cancel Delivery")).toBeLessThan(deliveryDetailsHtml.indexOf(">Close<"));
    expect(deliveryDetailsHtml.indexOf(">Close<")).toBeLessThan(deliveryDetailsHtml.indexOf("Confirm Arrival"));
  });
});

