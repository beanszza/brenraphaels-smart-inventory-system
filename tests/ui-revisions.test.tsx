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
import { POApprovalModal } from "@/components/orders-procurement/po/POApprovalModal";
import type { PurchaseOrderPO } from "@/components/orders-procurement/types";

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
      <SearchInput placeholder="Search supplies..." value="" onChange={() => {}} />
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
        onClose={() => {}}
      />
    );

    expect(html.indexOf("Priority")).toBeLessThan(html.indexOf("Purpose"));
    expect(html).not.toContain("font-mono");
    expect(html).toContain(`max="${getMaxFutureDateString()}"`);
  });

  it("removes font-mono and applies dynamic date caps in CreateDeliveryModal and POApprovalModal", () => {
    const deliveryHtml = renderToStaticMarkup(
      <CreateDeliveryModal open onClose={() => {}} onSuccess={() => {}} />
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
      <POApprovalModal po={po} onClose={() => {}} onSuccess={() => {}} />
    );
    expect(approvalHtml).not.toContain("font-mono");
    expect(approvalHtml).toContain(`min="${getTodayDateString()}"`);
    expect(approvalHtml).toContain(`max="${getMaxFutureDateString()}"`);
  });

  it("renders updated CreatePOModal search bar and removes Back to Requisitions copy", () => {
    const html = renderToStaticMarkup(
      <CreatePOModal open onClose={() => {}} onSuccess={() => {}} />
    );
    expect(html).toContain('placeholder="Search requisitions..."');
    expect(html).toContain("bg-secondary/50");
    expect(html).not.toContain("Back to Requisitions");
    expect(html).not.toContain(">ACTION<");
  });
});

