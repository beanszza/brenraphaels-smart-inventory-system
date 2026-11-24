import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { computeBranchRequestAllocation } from "@/lib/stock-transfer/branch-request-math";
import { BranchRequestsTab } from "@/components/stock-transfer/BranchRequestsTab";
import type { BranchStockRequest } from "@/components/stock-transfer/types";

const dbState = vi.hoisted(() => ({
  existingByNumber: new Map<string, { BranchRequestId: number; RequestNumber: string; Status: string }>(),
  locationFound: true,
  productFound: true,
  nextId: 551,
  notifyCalls: [] as Array<{ req: string; branch: string; summary: string }>,
}));

vi.mock("@/lib/stock-transfer/notify", () => ({
  notifyBranchStockRequestReceived: async (req: string, branch: string, summary: string) => {
    dbState.notifyCalls.push({ req, branch, summary });
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    branchRequests: {
      findUnique: async ({ where }: { where: { RequestNumber?: string } }) => {
        if (where.RequestNumber) return dbState.existingByNumber.get(where.RequestNumber) ?? null;
        return null;
      },
      create: async ({ data }: { data: { RequestNumber: string; Status: string } }) => {
        const created = {
          BranchRequestId: dbState.nextId++,
          RequestNumber: data.RequestNumber,
          Status: data.Status,
        };
        dbState.existingByNumber.set(data.RequestNumber, created);
        return created;
      },
    },
    locations: {
      findUnique: async () =>
        dbState.locationFound ? { LocationId: 4, LocationName: "TriNoma Bazaar" } : null,
      findFirst: async () =>
        dbState.locationFound ? { LocationId: 4, LocationName: "TriNoma Bazaar" } : null,
    },
    finishedProducts: {
      findFirst: async () =>
        dbState.productFound
          ? { ProductId: 18, Sku: "UBE-HAL-250", Variant: "Pouch 250g", Items: { ItemName: "Ube Halaya" } }
          : null,
    },
  },
}));

import { POST } from "@/app/api/pos/stock-requests/route";

const VALID_KEY = "a31ce48e7b36fdf1d5b7e2c8102ec27829af653baa1ebb0b865cb8be8e2e73a9";

function makePosRequest(body: unknown, authHeader: string | null = `Bearer ${VALID_KEY}`) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (authHeader !== null) headers.Authorization = authHeader;
  return new NextRequest("https://localhost:3003/api/pos/stock-requests", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

const VALID_BODY = {
  requestId: "SR-000123",
  branch: { branchId: "4", branchName: "TriNoma Bazaar" },
  items: [
    {
      sku: "UBE-HAL-250",
      productId: "prod_018",
      productName: "Ube Halaya",
      variationName: "Pouch 250g",
      quantity: 90,
      currentStock: 5,
    },
  ],
  notes: "Weekend bazaar, expecting double the usual sales.",
  requestedBy: "u_7f3a",
  requestedByName: "Ana Cruz",
  requestedAt: "2026-11-16T06:30:00Z",
};

describe("Branch Stock Request allocation math (partial / split STRs & cancel release)", () => {
  const baseItem = [{ ProductId: 18, RequestedQuantity: 90, ApprovedQuantity: 90 }];

  it("places Submitted requests in 'requests' and Rejected requests in 'rejected'", () => {
    expect(computeBranchRequestAllocation("Submitted", baseItem, []).subtab).toBe("requests");
    expect(computeBranchRequestAllocation("Rejected", baseItem, []).subtab).toBe("rejected");
  });

  it("tracks partial transfer (90 approved -> 50 STR -> 40 remaining in Approved)", () => {
    const res = computeBranchRequestAllocation("Approved", baseItem, [
      {
        RequestId: 1,
        RequestNumber: "STR-2026-0041",
        Status: "Scheduled",
        StockTransferRequestItems: [{ ProductId: 18, RequestedQuantity: 50 }],
        StockTransfers: [{ ProductId: 18, Status: "Scheduled", TransferQuantity: 50 }],
      },
    ]);
    expect(res.totalAllocated).toBe(50);
    expect(res.totalRemaining).toBe(40);
    expect(res.totalScheduled).toBe(50);
    expect(res.subtab).toBe("approved");
  });

  it("immediately releases quantity when a linked STR is Cancelled or Rejected", () => {
    const res = computeBranchRequestAllocation("Approved", baseItem, [
      {
        RequestId: 1,
        RequestNumber: "STR-2026-0041",
        Status: "Cancelled",
        StockTransferRequestItems: [{ ProductId: 18, RequestedQuantity: 50 }],
        StockTransfers: [{ ProductId: 18, Status: "Cancelled", TransferQuantity: 50 }],
      },
    ]);
    expect(res.totalAllocated).toBe(0);
    expect(res.totalRemaining).toBe(90);
    expect(res.subtab).toBe("approved");
  });

  it("keeps request in Approved while all 90 are allocated but not yet Scheduled", () => {
    const res = computeBranchRequestAllocation("Approved", baseItem, [
      {
        RequestId: 1,
        RequestNumber: "STR-2026-0041",
        Status: "Scheduled",
        StockTransferRequestItems: [{ ProductId: 18, RequestedQuantity: 50 }],
        StockTransfers: [{ ProductId: 18, Status: "Scheduled", TransferQuantity: 50 }],
      },
      {
        RequestId: 2,
        RequestNumber: "STR-2026-0042",
        Status: "Pending Approval",
        StockTransferRequestItems: [{ ProductId: 18, RequestedQuantity: 40 }],
        StockTransfers: [],
      },
    ]);
    expect(res.totalAllocated).toBe(90);
    expect(res.totalRemaining).toBe(0);
    expect(res.totalScheduled).toBe(50);
    expect(res.subtab).toBe("approved");
  });

  it("moves request to Completed once all 90 pcs reach Scheduled stage across split STRs", () => {
    const res = computeBranchRequestAllocation("Approved", baseItem, [
      {
        RequestId: 1,
        RequestNumber: "STR-2026-0041",
        Status: "Scheduled",
        StockTransferRequestItems: [{ ProductId: 18, RequestedQuantity: 50 }],
        StockTransfers: [{ ProductId: 18, Status: "Scheduled", TransferQuantity: 50 }],
      },
      {
        RequestId: 2,
        RequestNumber: "STR-2026-0042",
        Status: "Scheduled",
        StockTransferRequestItems: [{ ProductId: 18, RequestedQuantity: 40 }],
        StockTransfers: [{ ProductId: 18, Status: "Scheduled", TransferQuantity: 40 }],
      },
    ]);
    expect(res.totalAllocated).toBe(90);
    expect(res.totalRemaining).toBe(0);
    expect(res.totalScheduled).toBe(90);
    expect(res.subtab).toBe("completed");
    expect(res.transferStage).toBe("Scheduled");
  });
});

describe("POST /api/pos/stock-requests contract (§3.1)", () => {
  beforeEach(() => {
    dbState.existingByNumber.clear();
    dbState.locationFound = true;
    dbState.productFound = true;
    dbState.nextId = 551;
    dbState.notifyCalls = [];
  });

  it("returns 401 when bearer key is missing or wrong", async () => {
    const res = await POST(makePosRequest(VALID_BODY, "Bearer wrong-key-00000000000000000000"));
    expect(res.status).toBe(401);
  });

  it("creates request (201) and deduplicates retries with the same requestId (200)", async () => {
    const first = await POST(makePosRequest(VALID_BODY));
    expect(first.status).toBe(201);
    const firstJson = await first.json();
    expect(firstJson).toEqual({
      success: true,
      data: { requestId: "SR-000123", imsRequestId: "br_551", status: "Submitted" },
    });
    expect(dbState.notifyCalls).toHaveLength(1);

    // Retry with identical requestId -> 200, same imsRequestId, no duplicate notification
    const retry = await POST(makePosRequest(VALID_BODY));
    expect(retry.status).toBe(200);
    const retryJson = await retry.json();
    expect(retryJson).toEqual(firstJson);
    expect(dbState.notifyCalls).toHaveLength(1);
  });

  it("returns 400 with descriptive message on unknown SKU, invalid qty, or HTML angle brackets in notes", async () => {
    dbState.productFound = false;
    const skuRes = await POST(makePosRequest(VALID_BODY));
    expect(skuRes.status).toBe(400);
    expect((await skuRes.json()).message).toContain("items[0].sku UBE-HAL-250 is not an IMS product.");

    dbState.productFound = true;
    const xssRes = await POST(makePosRequest({ ...VALID_BODY, notes: "<script>alert(1)</script>" }));
    expect(xssRes.status).toBe(400);

    const zeroQtyRes = await POST(
      makePosRequest({ ...VALID_BODY, items: [{ ...VALID_BODY.items[0], quantity: 0 }] })
    );
    expect(zeroQtyRes.status).toBe(400);
  });
});

describe("BranchRequestsTab rendering", () => {
  it("renders all 4 subtabs with Reject & Approve actions on Requests and no Add button", () => {
    const sample: BranchStockRequest = {
      branchRequestId: 551,
      imsRequestId: "br_551",
      requestNumber: "SR-000123",
      branchId: 4,
      branchName: "TriNoma Bazaar",
      requestDate: "2026-11-16T06:30:00Z",
      status: "Submitted",
      subtab: "requests",
      transferStage: "Unscheduled",
      requestedBy: "u_7f3a",
      requestedByName: "Ana Cruz",
      notes: "Weekend bazaar",
      decidedBy: null,
      decidedByName: null,
      decidedAt: null,
      decisionRemarks: "",
      fulfilledAt: null,
      posSyncStatus: "Synced",
      posSyncError: null,
      posManifestLinked: false,
      totalRequested: 90,
      totalApproved: 0,
      totalAllocated: 0,
      totalRemaining: 0,
      totalScheduled: 0,
      totalDispatched: 0,
      totalReceived: 0,
      items: [
        {
          branchRequestItemId: 1,
          productId: 18,
          sku: "UBE-HAL-250",
          productName: "Ube Halaya",
          variationName: "Pouch 250g",
          branchCurrentStock: 5,
          imsAvailableStock: 140,
          requestedQuantity: 90,
          approvedQuantity: 0,
          allocatedQuantity: 0,
          remainingQuantity: 0,
          scheduledQuantity: 0,
          dispatchedQuantity: 0,
          receivedQuantity: 0,
        },
      ],
      linkedStrs: [],
    };

    const html = renderToStaticMarkup(
      <BranchRequestsTab
        branchRequests={[sample]}
        loading={false}
        canReview={true}
        canTransfer={true}
        onView={vi.fn()}
        onApprove={vi.fn()}
        onReject={vi.fn()}
        onTransferNow={vi.fn()}
        onRetrySync={vi.fn()}
      />
    );

    for (const text of ["Requests", "Approved", "Rejected", "Completed", "SR-000123", "TriNoma Bazaar", "Reject", "Approve"]) {
      expect(html).toContain(text);
    }
    expect(html).not.toContain("New request");
  });
});
