import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  listWriteOffs,
  getWriteOffFormData,
  createWriteOff,
  approveWriteOff,
  rejectWriteOff,
  cancelWriteOff,
  removeWriteOffFromInventory,
} from "@/app/actions/inventory/write-offs";
import ViewInventory from "@/components/pages/ViewInventory";
import { StaffProvider } from "@/context/StaffContext";
import type { Staff } from "@/lib/portal/client";

const state = vi.hoisted(() => ({
  staff: {
    id: "ims-mgr-1",
    name: "Vince Neil",
    username: "2026-VM-007",
    email: "madejavinceneil@example.com",
  } as Staff,
  lastSeq: 0,
  lotRemaining: 50,
  lotReserved: 10,
  lotStatus: "Available",
  inventoryStock: 50,
  swoStatus: "Pending Approval",
  writeOffRows: [] as any[],
  ledgersCreated: [] as any[],
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
  redirect: (url: string) => {
    throw new Error(`Redirect: ${url}`);
  },
}));
vi.mock("@/lib/portal/staff", () => ({
  requireModule: async () => state.staff,
}));
vi.mock("@/lib/audit", () => ({
  auditVersion: () => "v1",
  recordAudit: vi.fn(),
}));
vi.mock("@/lib/inventory/write-off-notify", () => ({
  notifyWriteOffApprovalRequested: vi.fn().mockResolvedValue(undefined),
  notifyWriteOffRequester: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/prisma", () => {
  const makeLot = () => ({
    LotId: 101,
    LotCode: "LOT-UBE-2026-0001",
    ItemId: 10,
    LocationId: 1,
    QuantityRemaining: state.lotRemaining,
    ReservedQuantity: state.lotReserved,
    UnitCost: 120,
    UomId: 1,
    Status: state.lotStatus,
    ExpiryDate: new Date("2026-12-31"),
    Items: {
      ItemId: 10,
      ItemName: "Ube Halaya Base",
      ItemCode: "SPL-0010",
      IsActive: true,
      UomId: 1,
      IsExpiryTracked: true,
      Category: {
        CategoryId: 1,
        CategoryName: "Raw Materials",
        Description: "Active",
        HasExpiry: true,
      },
      Uom: { UomId: 1, Name: "Kilogram", Abbreviation: "kg" },
      UnitOfMeasures_Items_StockUomIdToUnitOfMeasures: {
        UomId: 1,
        Name: "Kilogram",
        Abbreviation: "kg",
      },
    },
    UnitOfMeasures: { UomId: 1, Name: "Kilogram", Abbreviation: "kg" },
    ProductionBatches: [],
  });

  const makeSwoRow = (overrides: Record<string, any> = {}) => {
    const base = state.writeOffRows[state.writeOffRows.length - 1] || {
      WriteOffId: 1,
      SwoNumber: `SWO-2026-${String(state.lastSeq || 1).padStart(4, "0")}`,
      Status: state.swoStatus,
      RequestedBy: "2026-VM-007",
      RequestedByName: "Vince Neil",
      RequestedAt: new Date("2026-11-16T00:00:00Z"),
      GeneralRemarks: "Damaged during handling",
      ApprovedBy: null,
      ApprovedByName: null,
      ApprovedAt: null,
      ApprovalNotes: null,
      RejectedBy: null,
      RejectedByName: null,
      RejectedAt: null,
      RejectionReason: null,
      CancelledBy: null,
      CancelledByName: null,
      CancelledAt: null,
      CancelReason: null,
      RemovedBy: null,
      RemovedByName: null,
      RemovedAt: null,
      TotalValue: 1800,
      UpdatedAt: new Date("2026-11-16T00:00:00Z"),
      StockWriteOffItems: [
        {
          WriteOffItemId: 1,
          WriteOffId: 1,
          ItemId: 10,
          ProductId: null,
          ItemType: "Raw Materials",
          ItemName: "Ube Halaya Base",
          ItemCode: "SPL-0010",
          VariantName: "",
          UomId: 1,
          UomName: "kg",
          HasExpiry: true,
          StockWriteOffLines: [
            {
              LineId: 1,
              WriteOffItemId: 1,
              LotId: 101,
              LotCode: "LOT-UBE-2026-0001",
              ExpiryDate: new Date("2026-12-31"),
              AvailableBefore: 40,
              Quantity: 15,
              UnitCost: 120,
              Reason: "Damaged",
              ReasonOther: null,
              Disposition: "Disposal / Destruction",
              DispositionOther: null,
              Remarks: "Torn packaging in storage",
              LedgerId: null,
            },
          ],
          StockWriteOffPhotos: [],
        },
      ],
    };
    const merged = { ...base, ...overrides };
    state.swoStatus = merged.Status;
    if (state.writeOffRows.length > 0) {
      state.writeOffRows[state.writeOffRows.length - 1] = merged;
    } else {
      state.writeOffRows.push(merged);
    }
    return merged;
  };

  const client: any = {
    documentSequences: {
      findUnique: async () =>
        state.lastSeq > 0 ? { LastNumber: state.lastSeq } : null,
      upsert: async () => {
        state.lastSeq += 1;
        return { DocType: "StockWriteOff", Year: 2026, LastNumber: state.lastSeq };
      },
    },
    categories: {
      findMany: async () => [
        {
          CategoryId: 1,
          CategoryName: "Raw Materials",
          Description: "Active",
          HasExpiry: true,
        },
        {
          CategoryId: 2,
          CategoryName: "Tools and Supplies",
          Description: "Active",
          HasExpiry: false,
        },
      ],
    },
    inventoryLots: {
      findMany: async () => [makeLot()],
      findUnique: async () => makeLot(),
      update: async ({ data }: any) => {
        if (data.QuantityRemaining?.decrement) {
          state.lotRemaining -= data.QuantityRemaining.decrement;
        }
        if (data.ReservedQuantity?.increment) {
          state.lotReserved += data.ReservedQuantity.increment;
        }
        if (data.ReservedQuantity?.decrement) {
          state.lotReserved -= data.ReservedQuantity.decrement;
        }
        if (data.Status) {
          state.lotStatus = data.Status;
        }
        return makeLot();
      },
    },
    inventories: {
      findUnique: async () => ({
        InventoryId: 1,
        ItemId: 10,
        LocationId: 1,
        CurrentStock: state.inventoryStock,
      }),
      update: async ({ data }: any) => {
        if (typeof data.CurrentStock === "number") {
          state.inventoryStock = data.CurrentStock;
        }
        return { CurrentStock: state.inventoryStock };
      },
    },
    stockLedgers: {
      create: async ({ data }: any) => {
        const entry = { LedgerId: BigInt(state.ledgersCreated.length + 1), ...data };
        state.ledgersCreated.push(entry);
        return entry;
      },
    },
    stockWriteOffLines: {
      groupBy: async () => [],
      update: async () => ({}),
    },
    stockWriteOffs: {
      findMany: async () => state.writeOffRows,
      findUnique: async () =>
        state.writeOffRows.length > 0
          ? state.writeOffRows[state.writeOffRows.length - 1]
          : makeSwoRow(),
      create: async ({ data }: any) => {
        const created = makeSwoRow({
          WriteOffId: state.writeOffRows.length + 1,
          SwoNumber: data.SwoNumber,
          Status: data.Status,
          RequestedBy: data.RequestedBy,
          RequestedByName: data.RequestedByName,
          GeneralRemarks: data.GeneralRemarks,
          TotalValue: data.TotalValue,
        });
        return created;
      },
      update: async ({ data }: any) => makeSwoRow(data),
    },
  };
  client.$transaction = async (work: (tx: any) => Promise<any>) => work(client);
  return { prisma: client };
});

const imsManagerStaff: Staff = {
  id: "ims-mgr-1",
  name: "Vince Neil",
  username: "2026-VM-007",
  email: "madejavinceneil@example.com",
};

const adminStaff: Staff = {
  id: "admin-1",
  name: "Jude Nitram",
  username: "2026-ADMIN-001",
  email: "admin@example.com",
};

const headCookStaff: Staff = {
  id: "cook-1",
  name: "Bren Ralph",
  username: "2026-BD-009",
  email: "headcook@example.com",
};

beforeEach(() => {
  state.staff = imsManagerStaff;
  state.lastSeq = 0;
  state.lotRemaining = 50;
  state.lotReserved = 10;
  state.lotStatus = "Available";
  state.inventoryStock = 50;
  state.swoStatus = "Pending Approval";
  state.writeOffRows = [];
  state.ledgersCreated = [];
});

describe("Stock Write-Off Lifecycle & Role Enforcement", () => {
  it("computes unreserved available quantity (50 remaining - 10 reserved = 40 available)", async () => {
    const res = await getWriteOffFormData();
    expect(res.success).toBe(true);
    const data = res.data as any;
    expect(data.nextSwoNumberPreview).toContain("SWO-");
    expect(data.items[0].lots[0].availableQuantity).toBe(40);
    // Tools and Supplies has HasExpiry = false
    const toolsCat = data.itemTypes.find((t: any) => t.name === "Tools and Supplies");
    expect(toolsCat?.hasExpiry).toBe(false);
  });

  it("blocks non-IMS/non-Admin accounts (e.g. Head Cook) from accessing Stock Write-Off", async () => {
    state.staff = headCookStaff;
    expect(await listWriteOffs()).toMatchObject({
      success: false,
      message: expect.stringContaining("Only the Inventory Manager and Administrator"),
    });
    expect(
      await createWriteOff({
        items: [
          {
            itemType: "Raw Materials",
            itemId: 10,
            lots: [
              {
                lotId: 101,
                quantity: 5,
                reason: "Expired",
                disposition: "Disposal / Destruction",
                remarks: "Expired stock",
              },
            ],
          },
        ],
      })
    ).toMatchObject({ success: false });
  });

  it("issues unique SWO numbers and never reuses rejected or cancelled SWO numbers", async () => {
    const payload = {
      generalRemarks: "Batch check",
      items: [
        {
          itemType: "Raw Materials",
          itemId: 10,
          lots: [
            {
              lotId: 101,
              quantity: 15,
              reason: "Damaged",
              disposition: "Disposal / Destruction",
              remarks: "Torn packaging in storage",
            },
          ],
        },
      ],
    };

    // 1. IMS Manager creates SWO #1 -> SWO-YYYY-0001 (reserves 15 on lot)
    state.staff = imsManagerStaff;
    const initialReserved = state.lotReserved;
    const first = await createWriteOff(payload);
    expect(first.success).toBe(true);
    expect(state.lotReserved).toBe(initialReserved + 15);
    const swo1 = (first.data as any).swoNumber as string;
    expect(swo1).toMatch(/^SWO-\d{4}-0001$/);

    // 2. Admin rejects SWO #1 -> SWO-YYYY-0001 is retired and reservation is released
    state.staff = adminStaff;
    const rejected = await rejectWriteOff(1, "Photo unclear, please re-verify lot");
    expect(rejected.success).toBe(true);
    expect((rejected.data as any).status).toBe("Rejected");
    expect(state.lotReserved).toBe(initialReserved);

    // 3. IMS Manager creates SWO #2 -> must issue SWO-YYYY-0002 (never reuse 0001)
    state.staff = imsManagerStaff;
    const second = await createWriteOff(payload);
    expect(second.success).toBe(true);
    expect(state.lotReserved).toBe(initialReserved + 15);
    const swo2 = (second.data as any).swoNumber as string;
    expect(swo2).toMatch(/^SWO-\d{4}-0002$/);
    expect(swo2).not.toBe(swo1);

    // 4. IMS Manager cancels SWO #2 while Pending Approval -> SWO-YYYY-0002 is retired and reservation is released
    const cancelled = await cancelWriteOff(2, "Selected wrong lot number");
    expect(cancelled.success).toBe(true);
    expect((cancelled.data as any).status).toBe("Cancelled");
    expect(state.lotReserved).toBe(initialReserved);

    // 5. IMS Manager creates SWO #3 -> must issue SWO-YYYY-0003
    const third = await createWriteOff(payload);
    expect(third.success).toBe(true);
    expect(state.lotReserved).toBe(initialReserved + 15);
    const swo3 = (third.data as any).swoNumber as string;
    expect(swo3).toMatch(/^SWO-\d{4}-0003$/);
  });

  it("enforces full approval -> Remove Items in Inventory flow, deducting lot & inventory and recording StockLedgers", async () => {
    const payload = {
      items: [
        {
          itemType: "Raw Materials",
          itemId: 10,
          lots: [
            {
              lotId: 101,
              quantity: 15,
              reason: "Damaged",
              disposition: "Disposal / Destruction",
              remarks: "Torn packaging in storage",
            },
          ],
        },
      ],
    };

    // IMS Manager creates SWO
    state.staff = imsManagerStaff;
    const created = await createWriteOff(payload);
    expect(created.success).toBe(true);

    // IMS Manager cannot approve their own request
    expect(await approveWriteOff(1)).toMatchObject({
      success: false,
      message: expect.stringContaining("Only the Administrator"),
    });

    // Admin approves
    state.staff = adminStaff;
    const approved = await approveWriteOff(1, "Verified and approved for write-off");
    expect(approved.success).toBe(true);
    expect((approved.data as any).status).toBe("Approved");

    // Once Approved, IMS Manager CANNOT cancel it anymore
    state.staff = imsManagerStaff;
    expect(await cancelWriteOff(1, "Changed mind")).toMatchObject({
      success: false,
      message: expect.stringContaining("Only requests in Pending Approval status can be cancelled"),
    });

    // Admin cannot click Remove from Inventory (view-only on Approved tab)
    state.staff = adminStaff;
    expect(await removeWriteOffFromInventory(1)).toMatchObject({
      success: false,
      message: expect.stringContaining("Only the Inventory Manager"),
    });

    // IMS Manager removes items from inventory -> deducts 15 from lot (50 -> 35) and inventory (50 -> 35)
    state.staff = imsManagerStaff;
    const removed = await removeWriteOffFromInventory(1);
    expect(removed.success).toBe(true);
    expect((removed.data as any).status).toBe("Removed");
    expect(state.lotRemaining).toBe(35);
    expect(state.lotReserved).toBe(10);
    expect(state.inventoryStock).toBe(35);
    expect(state.ledgersCreated).toHaveLength(1);
    expect(state.ledgersCreated[0]).toMatchObject({
      MovementType: "WRITE_OFF",
      Quantity: -15,
      ReferenceType: "StockWriteOff",
    });
  });

  it("renders STOCK WRITE-OFF tab for IMS Manager and Admin, and hides it for Head Cook", () => {
    const renderFor = (staff: Staff) =>
      renderToStaticMarkup(
        <StaffProvider staff={staff}>
          <ViewInventory
            initialInventories={[]}
            initialLots={[]}
            initialTotal={0}
            initialCategories={[{ categoryId: 1, categoryName: "Raw Materials" }]}
            initialWriteOffs={[]}
            asOf="2026-11-16T00:00:00.000Z"
          />
        </StaffProvider>
      );

    expect(renderFor(imsManagerStaff)).toContain("STOCK WRITE-OFF");
    expect(renderFor(adminStaff)).toContain("STOCK WRITE-OFF");
    expect(renderFor(headCookStaff)).not.toContain("STOCK WRITE-OFF");
  });
});
