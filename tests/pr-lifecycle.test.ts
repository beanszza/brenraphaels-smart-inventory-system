import { describe, expect, it, vi } from "vitest";
import {
  normalizePrPriority,
  sortRequisitionsByPriority,
  syncRequisitionLifecycle,
} from "@/lib/orders/requisition-lifecycle";

describe("PR priority normalization and sorting", () => {
  it("normalizes legacy Normal/Urgent priorities to Medium/High", () => {
    expect(normalizePrPriority("Low")).toBe("Low");
    expect(normalizePrPriority("Normal")).toBe("Medium");
    expect(normalizePrPriority("Medium")).toBe("Medium");
    expect(normalizePrPriority("High")).toBe("High");
    expect(normalizePrPriority("Urgent")).toBe("High");
  });

  it("sorts High priority first, then Medium, then Low (newest first within same tier)", () => {
    const sorted = sortRequisitionsByPriority([
      { prId: 1, priority: "Low" },
      { prId: 2, priority: "Medium" },
      { prId: 3, priority: "High" },
      { prId: 4, priority: "Urgent" },
      { prId: 5, priority: "Normal" },
    ]);
    expect(sorted.map((r) => r.prId)).toEqual([4, 3, 5, 2, 1]);
  });
});

describe("PR -> PO -> Stock-In lifecycle state transitions", () => {
  function buildMockTx(state: {
    prStatus: string;
    prItems: Array<{ ItemId: number; RequestedQuantity: number }>;
    orders: Array<{
      PoId: number;
      Status: string;
      PurchaseOrderItems: Array<{ PoItemId: number; ItemId: number; PoItemQuantity: number }>;
      Deliveries?: Array<{ DeliveryId: number; Status: string; GoodsReceipts?: Array<{ GrnId: number; Status: string }> }>;
      GoodsReceipts?: Array<{
        GrnId: number;
        Status: string;
        GoodsReceiptItems?: Array<{ GrnItemId: number; PoItemId: number; ItemId: number; DeliveredQuantity: number }>;
        StockIns?: Array<{
          StockInId: number;
          Status: string;
          StockInLines?: Array<{ GrnItemId: number | null; ItemId: number; QuantityToStock: number; CommittedToInventory: boolean }>;
        }>;
      }>;
      Discrepancies?: Array<{
        DiscrepancyId: number;
        ItemId: number;
        DiscrepancyQuantity: number;
        Status: string;
        ResolutionType: string | null;
        RtvId: number | null;
        LossReportId: number | null;
      }>;
      LossReports?: Array<{ LossReportId: number; IsAcknowledged: boolean }>;
    }>;
  }) {
    const update = vi.fn(async ({ data }: { data: { Status: string } }) => {
      state.prStatus = data.Status;
      return { PrId: 1, Status: data.Status };
    });
    const tx = {
      purchaseRequisitions: {
        findUnique: async () => ({
          PrId: 1,
          Status: state.prStatus,
          PurchaseRequisitionItems: state.prItems,
        }),
        update,
      },
      purchaseOrders: {
        findMany: async () => state.orders,
      },
      returnToVendors: {
        findMany: async () => [],
      },
    } as any;
    return { tx, update };
  }

  it("keeps PR Approved on partial PO (40 of 80kg) and marks ConvertedToPO once all 80kg are ordered", async () => {
    const state = {
      prStatus: "Approved",
      prItems: [{ ItemId: 10, RequestedQuantity: 80 }],
      orders: [
        {
          PoId: 1,
          Status: "Approved",
          PurchaseOrderItems: [{ PoItemId: 1, ItemId: 10, PoItemQuantity: 40 }],
          Deliveries: [],
          GoodsReceipts: [],
          Discrepancies: [],
          LossReports: [],
        },
      ],
    };
    const { tx, update } = buildMockTx(state);
    await syncRequisitionLifecycle(tx, 1);
    expect(state.prStatus).toBe("Approved");
    expect(update).not.toHaveBeenCalled();

    // Second supplier covers the remaining 40kg
    state.orders.push({
      PoId: 2,
      Status: "Pending Approval",
      PurchaseOrderItems: [{ PoItemId: 2, ItemId: 10, PoItemQuantity: 40 }],
      Deliveries: [],
      GoodsReceipts: [],
      Discrepancies: [],
      LossReports: [],
    });
    await syncRequisitionLifecycle(tx, 1);
    expect(state.prStatus).toBe("ConvertedToPO");
  });

  it("closes PR only after all deliveries, GRNs, QA, discrepancies/losses, and Stock-Ins complete", async () => {
    const state: Parameters<typeof buildMockTx>[0] = {
      prStatus: "ConvertedToPO",
      prItems: [{ ItemId: 10, RequestedQuantity: 80 }],
      orders: [
        {
          PoId: 1,
          Status: "Ordered",
          PurchaseOrderItems: [{ PoItemId: 1, ItemId: 10, PoItemQuantity: 80 }],
          Deliveries: [{ DeliveryId: 1, Status: "Arrived", GoodsReceipts: [{ GrnId: 1, Status: "FullyPutAway" }] }],
          GoodsReceipts: [
            {
              GrnId: 1,
              Status: "FullyPutAway",
              GoodsReceiptItems: [{ GrnItemId: 1, PoItemId: 1, ItemId: 10, DeliveredQuantity: 70 }],
              StockIns: [
                {
                  StockInId: 1,
                  Status: "Committed",
                  StockInLines: [{ GrnItemId: 1, ItemId: 10, QuantityToStock: 70, CommittedToInventory: true }],
                },
              ],
            },
          ],
          Discrepancies: [
            {
              DiscrepancyId: 1,
              ItemId: 10,
              DiscrepancyQuantity: 10,
              Status: "Open",
              ResolutionType: null,
              RtvId: null,
              LossReportId: null,
            },
          ],
          LossReports: [],
        },
      ],
    };
    const { tx } = buildMockTx(state);

    // 1. Discrepancy still Open -> stays ConvertedToPO
    await syncRequisitionLifecycle(tx, 1);
    expect(state.prStatus).toBe("ConvertedToPO");

    // 2. Resolved as NewDelivery (waiting for re-delivery) -> stays ConvertedToPO
    state.orders[0].Discrepancies![0].Status = "Resolved";
    state.orders[0].Discrepancies![0].ResolutionType = "NewDelivery";
    await syncRequisitionLifecycle(tx, 1);
    expect(state.prStatus).toBe("ConvertedToPO");

    // 3. Resolved as LossReport (or CloseRemaining) with no pending LossReport ack -> transitions to Closed
    state.orders[0].Discrepancies![0].ResolutionType = "LossReport";
    await syncRequisitionLifecycle(tx, 1);
    expect(state.prStatus).toBe("Closed");
  });
});

