import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { computeBranchRequestAllocation } from "@/lib/stock-transfer/branch-request-math";
import { BranchRequestsTab } from "@/components/stock-transfer/BranchRequestsTab";
import type { BranchStockRequest } from "@/components/stock-transfer/types";

interface FakeBranchRow {
  BranchRequestId: number;
  RequestNumber: string;
  BranchId: number;
  BranchName: string;
  Status: string;
  DecidedAt?: Date | null;
  ApprovedBy?: string | null;
  DecidedByName?: string | null;
  DecisionRemarks?: string | null;
  PosSyncStatus?: string;
  CancelledBy?: string | null;
  CancelledByName?: string | null;
  CancelledAt?: Date | null;
  CancelReason?: string | null;
  BranchRequestItems: Array<{ ProductId: number; ApprovedQuantity: number }>;
}

const dbState = vi.hoisted(() => ({
  existingByNumber: new Map<string, FakeBranchRow>(),
  locationFound: true,
  locationsList: [
    { LocationId: 1, LocationName: "Main Commissary Factory", IsSystemLocation: true },
    { LocationId: 4, LocationName: "TriNoma Bazaar", IsSystemLocation: false },
    { LocationId: 12, LocationName: "Antipolo Store Branch", IsSystemLocation: false },
  ] as Array<{ LocationId: number; LocationName: string; IsSystemLocation: boolean }>,
  productFound: true,
  fallbackProducts: [] as Array<{ ProductId: number; Sku: string; Variant: string; Items: { ItemName: string; ItemCode: string } }>,
  nextId: 551,
  notifyCalls: [] as Array<{ type: string; req: string; branch: string; detail?: string | null }>,
}));

vi.mock("@/lib/stock-transfer/notify", () => ({
  notifyBranchStockRequestReceived: async (req: string, branch: string, summary: string) => {
    dbState.notifyCalls.push({ type: "received", req, branch, detail: summary });
  },
  notifyBranchStockRequestCancelled: async (req: string, branch: string, reason?: string | null) => {
    dbState.notifyCalls.push({ type: "cancelled", req, branch, detail: reason });
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    branchRequests: {
      findUnique: async ({ where }: { where: { RequestNumber?: string; BranchRequestId?: number } }) => {
        if (where.RequestNumber) return dbState.existingByNumber.get(where.RequestNumber) ?? null;
        if (where.BranchRequestId) {
          for (const row of dbState.existingByNumber.values()) {
            if (row.BranchRequestId === where.BranchRequestId) return row;
          }
        }
        return null;
      },
      create: async ({ data }: { data: { RequestNumber: string; BranchId: number; BranchName: string; Status: string } }) => {
        const created: FakeBranchRow = {
          BranchRequestId: dbState.nextId++,
          RequestNumber: data.RequestNumber,
          BranchId: data.BranchId,
          BranchName: data.BranchName,
          Status: data.Status,
          PosSyncStatus: "Synced",
          BranchRequestItems: [{ ProductId: 18, ApprovedQuantity: 0 }],
        };
        dbState.existingByNumber.set(data.RequestNumber, created);
        return created;
      },
      updateMany: async ({
        where,
        data,
      }: {
        where: { BranchRequestId?: number; Status?: { in: string[] } };
        data: Partial<FakeBranchRow>;
      }) => {
        let count = 0;
        for (const row of dbState.existingByNumber.values()) {
          if (
            row.BranchRequestId === where.BranchRequestId &&
            (!where.Status || where.Status.in.includes(row.Status))
          ) {
            Object.assign(row, data);
            count++;
          }
        }
        return { count };
      },
      update: async ({
        where,
        data,
      }: {
        where: { BranchRequestId: number };
        data: Partial<FakeBranchRow>;
      }) => {
        for (const row of dbState.existingByNumber.values()) {
          if (row.BranchRequestId === where.BranchRequestId) {
            Object.assign(row, data);
            return row;
          }
        }
        return null;
      },
    },
    locations: {
      findUnique: async ({ where }: { where: { LocationId: number } }) => {
        if (!dbState.locationFound) return null;
        return dbState.locationsList.find((l) => l.LocationId === where.LocationId) ?? null;
      },
      findFirst: async ({
        where,
      }: {
        where?: { LocationName?: { equals?: string }; IsSystemLocation?: boolean };
      }) => {
        if (!dbState.locationFound) return null;
        const target = where?.LocationName?.equals?.toLowerCase();
        return (
          dbState.locationsList.find(
            (l) =>
              (!target || l.LocationName.toLowerCase() === target) &&
              (where?.IsSystemLocation === undefined || l.IsSystemLocation === where.IsSystemLocation)
          ) ?? null
        );
      },
    },
    finishedProducts: {
      findFirst: async () =>
        dbState.productFound
          ? { ProductId: 18, Sku: "UBE-HAL-250", Variant: "Pouch 250g", Items: { ItemName: "Ube Halaya" } }
          : null,
      findMany: async () => dbState.fallbackProducts,
    },
  },
}));

import { POST } from "@/app/api/pos/stock-requests/route";
import { PUT as CANCEL_PUT } from "@/app/api/pos/stock-requests/[requestId]/cancel/route";

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

function makeCancelRequest(
  requestId: string,
  body: unknown,
  authHeader: string | null = `Bearer ${VALID_KEY}`
) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (authHeader !== null) headers.Authorization = authHeader;
  return new NextRequest(`https://localhost:3003/api/pos/stock-requests/${requestId}/cancel`, {
    method: "PUT",
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

const VALID_CANCEL_BODY = {
  requestId: "SR-000123",
  reason: "Got stock from the Makati branch instead.",
  cancelledBy: "u_7f3a",
  cancelledByName: "Ana Cruz",
  cancelledAt: "2026-11-16T07:02:00Z",
};

describe("Branch Stock Request allocation math (partial / split STRs, cancel & release)", () => {
  const baseItem = [{ ProductId: 18, RequestedQuantity: 90, ApprovedQuantity: 90 }];

  it("places Submitted in 'requests', Rejected in 'rejected', and Cancelled in 'cancelled'", () => {
    expect(computeBranchRequestAllocation("Submitted", baseItem, []).subtab).toBe("requests");
    expect(computeBranchRequestAllocation("Rejected", baseItem, []).subtab).toBe("rejected");
    expect(computeBranchRequestAllocation("Cancelled", baseItem, []).subtab).toBe("cancelled");
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

describe("POST /api/pos/stock-requests contract (§3.1 & §6.2 #5)", () => {
  beforeEach(() => {
    dbState.existingByNumber.clear();
    dbState.locationFound = true;
    dbState.productFound = true;
    dbState.fallbackProducts = [];
    dbState.nextId = 551;
    dbState.notifyCalls = [];
  });

  it("returns 401 when bearer key is missing or wrong", async () => {
    const res = await POST(makePosRequest(VALID_BODY, "Bearer wrong-key-00000000000000000000"));
    expect(res.status).toBe(401);
  });

  it("creates request (201), accepts multiple open requests for the same item, and deduplicates identical requestId (200)", async () => {
    const first = await POST(makePosRequest(VALID_BODY));
    expect(first.status).toBe(201);
    const firstJson = await first.json();
    expect(firstJson).toEqual({
      success: true,
      data: { requestId: "SR-000123", imsRequestId: "br_551", status: "Submitted" },
    });

    // Duplicate retry with same requestId -> 200 idempotent
    const retry = await POST(makePosRequest(VALID_BODY));
    expect(retry.status).toBe(200);
    expect(await retry.json()).toEqual(firstJson);

    // Second open request for the same item & branch with a new requestId -> 201 (§1.1)
    const second = await POST(makePosRequest({ ...VALID_BODY, requestId: "SR-000124", quantity: 10 }));
    expect(second.status).toBe(201);
    expect(dbState.existingByNumber.size).toBe(2);
  });

  it("matches reformatted POS SKUs (e.g. UHJ-250G-CONTAINER) via fallback productId/variant tokens", async () => {
    dbState.productFound = false;
    dbState.fallbackProducts = [
      {
        ProductId: 42,
        Sku: "UBH-CON-250G",
        Variant: "250g Container",
        Items: { ItemName: "Ube Halaya Jam", ItemCode: "SCM-PRD-0042" },
      },
      {
        ProductId: 43,
        Sku: "UBH-JAR-500G",
        Variant: "500g Jar",
        Items: { ItemName: "Ube Halaya Jam", ItemCode: "SCM-PRD-0042" },
      },
    ];
    const res = await POST(
      makePosRequest({
        ...VALID_BODY,
        requestId: "SR-000200",
        items: [
          {
            sku: "UHJ-250G-CONTAINER",
            productId: "SCM-PRD-0042",
            productName: "Ube Halaya Jam",
            variationName: "Container 250g",
            quantity: 6,
            currentStock: 2,
          },
        ],
      })
    );
    expect(res.status).toBe(201);
  });

  it("returns 400 with descriptive message on unknown SKU, invalid qty, or HTML angle brackets in notes", async () => {
    dbState.productFound = false;
    dbState.fallbackProducts = [];
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

describe("PUT /api/pos/stock-requests/{requestId}/cancel contract (§3.6 & §6.3)", () => {
  beforeEach(() => {
    dbState.existingByNumber.clear();
    dbState.notifyCalls = [];
    dbState.nextId = 551;
  });

  it("returns 401 when bearer key is missing or wrong", async () => {
    const res = await CANCEL_PUT(
      makeCancelRequest("SR-000123", VALID_CANCEL_BODY, "Bearer invalid-key-00000000000000000"),
      { params: Promise.resolve({ requestId: "SR-000123" }) }
    );
    expect(res.status).toBe(401);
  });

  it("returns 404 when IMS never received the requestId", async () => {
    const res = await CANCEL_PUT(makeCancelRequest("SR-999999", { ...VALID_CANCEL_BODY, requestId: "SR-999999" }), {
      params: Promise.resolve({ requestId: "SR-999999" }),
    });
    expect(res.status).toBe(404);
  });

  it("cancels a Submitted request (200), stores metadata, and is idempotent on repeat", async () => {
    dbState.existingByNumber.set("SR-000123", {
      BranchRequestId: 551,
      RequestNumber: "SR-000123",
      BranchId: 4,
      BranchName: "TriNoma Bazaar",
      Status: "Submitted",
      PosSyncStatus: "Synced",
      BranchRequestItems: [{ ProductId: 18, ApprovedQuantity: 0 }],
    });

    const first = await CANCEL_PUT(makeCancelRequest("SR-000123", VALID_CANCEL_BODY), {
      params: Promise.resolve({ requestId: "SR-000123" }),
    });
    expect(first.status).toBe(200);
    expect(await first.json()).toEqual({
      success: true,
      data: { requestId: "SR-000123", status: "Cancelled" },
    });

    const saved = dbState.existingByNumber.get("SR-000123");
    expect(saved?.Status).toBe("Cancelled");
    expect(saved?.CancelledByName).toBe("Ana Cruz");
    expect(saved?.CancelReason).toBe("Got stock from the Makati branch instead.");
    expect(dbState.notifyCalls.filter((c) => c.type === "cancelled")).toHaveLength(1);

    // Repeat cancel -> 200 idempotent, no duplicate notification
    const repeat = await CANCEL_PUT(makeCancelRequest("SR-000123", VALID_CANCEL_BODY), {
      params: Promise.resolve({ requestId: "SR-000123" }),
    });
    expect(repeat.status).toBe(200);
    expect(dbState.notifyCalls.filter((c) => c.type === "cancelled")).toHaveLength(1);
  });

  it("returns 409 Conflict when the request was already Approved or Rejected in IMS", async () => {
    dbState.existingByNumber.set("SR-000123", {
      BranchRequestId: 551,
      RequestNumber: "SR-000123",
      BranchId: 4,
      BranchName: "TriNoma Bazaar",
      Status: "Approved",
      DecidedAt: new Date("2026-11-16T06:58:00Z"),
      PosSyncStatus: "Synced",
      BranchRequestItems: [{ ProductId: 18, ApprovedQuantity: 90 }],
    });

    const res = await CANCEL_PUT(makeCancelRequest("SR-000123", VALID_CANCEL_BODY), {
      params: Promise.resolve({ requestId: "SR-000123" }),
    });
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.message).toContain("SR-000123 was already approved at 06:58 UTC.");
  });

  it("rejects angle brackets in cancel reason with 400", async () => {
    const res = await CANCEL_PUT(
      makeCancelRequest("SR-000123", { ...VALID_CANCEL_BODY, reason: "<script>bad</script>" }),
      { params: Promise.resolve({ requestId: "SR-000123" }) }
    );
    expect(res.status).toBe(400);
  });
});

describe("BranchRequestsTab rendering", () => {
  it("renders all 5 subtabs (including Cancelled), Reject & Approve actions, and multi-open-request badge", () => {
    const makeSample = (id: number, num: string, status: string, subtab: BranchStockRequest["subtab"]): BranchStockRequest => ({
      branchRequestId: id,
      imsRequestId: `br_${id}`,
      requestNumber: num,
      branchId: 4,
      branchName: "TriNoma Bazaar",
      requestDate: "2026-11-16T06:30:00Z",
      status,
      subtab,
      transferStage: "Unscheduled",
      requestedBy: "u_7f3a",
      requestedByName: "Ana Cruz",
      notes: "Weekend bazaar",
      decidedBy: null,
      decidedByName: null,
      decidedAt: null,
      decisionRemarks: "",
      cancelledBy: null,
      cancelledByName: null,
      cancelledAt: null,
      cancelReason: "",
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
          branchRequestItemId: id,
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
    });

    const html = renderToStaticMarkup(
      <BranchRequestsTab
        branchRequests={[
          makeSample(551, "SR-000123", "Submitted", "requests"),
          makeSample(552, "SR-000124", "Submitted", "requests"),
          makeSample(553, "SR-000125", "Cancelled", "cancelled"),
        ]}
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

    for (const text of [
      "Requests",
      "Approved",
      "Rejected",
      "Cancelled",
      "Completed",
      "SR-000123",
      "2 open for this item",
      "TriNoma Bazaar",
      "Reject",
      "Approve",
    ]) {
      expect(html).toContain(text);
    }
    expect(html).not.toContain("New request");
  });

  it("matches POS branchId=1 (Antipolo Store Branch) by name instead of colliding with IMS LocationId=1 Commissary", async () => {
    dbState.existingByNumber.clear();
    dbState.locationFound = true;
    dbState.productFound = true;
    const res = await POST(
      makePosRequest({
        requestId: "SR-000006",
        branch: { branchId: "1", branchName: "Antipolo Store Branch" },
        requestedBy: "u_123",
        requestedByName: "Branch Staff",
        requestedAt: "2026-11-25T15:00:00Z",
        notes: "Restock Toffee Jam",
        items: [
          {
            productId: "SCM-PRD-0018",
            sku: "UBE-HAL-250",
            productName: "Ube Halaya",
            variationName: "Pouch 250g",
            quantity: 15,
            currentStock: 0,
          },
        ],
      })
    );
    expect(res.status).toBe(201);
    const savedRow = dbState.existingByNumber.get("SR-000006");
    expect(savedRow?.BranchId).toBe(12);
    expect(savedRow?.BranchName).toBe("Antipolo Store Branch");
  });
});
