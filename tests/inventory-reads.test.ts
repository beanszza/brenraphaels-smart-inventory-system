import { beforeEach, expect, it, vi } from "vitest";
import { listInventory } from "@/app/actions/inventory/balances";
import { listLots } from "@/app/actions/inventory/lots";
import { listItemLots } from "@/app/actions/inventory/item-lots";
import { listCycleCounts } from "@/app/actions/inventory/counts";
import { listCycleCountItems } from "@/app/actions/inventory/count-items";
import { traceForward } from "@/app/actions/inventory/forward";
import { traceBackward } from "@/app/actions/inventory/backward";
import { simulateRecall } from "@/app/actions/inventory/recall-simulation";
import { getValuation } from "@/app/actions/inventory/valuation";

const fake = vi.hoisted(() => ({ missing: false, databaseFails: false, extraLot: false }));
vi.mock("@/lib/portal/staff", () => ({ requireModule: async () => ({ id: "staff-1", username: "ada", name: "Ada" }) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/prisma", () => {
  const unit = { UomId: 1, Name: "Kilograms", Abbreviation: "kg" };
  const item = { ItemId: 1, ItemCode: "FLOUR", ItemName: "Flour", CategoryId: 1,
    Category: { CategoryName: "Ingredients" }, MinStockLevel: "5", MaxStockLevel: "20", IsActive: true,
    StockUomId: 1, Uom: unit, UnitOfMeasures_Items_StockUomIdToUnitOfMeasures: unit };
  const consumption = { BatchId: 7, BatchConsumptionId: 1, ItemId: 1, LotId: 1, RequiredQuantity: "3", QuantityUsed: "2",
    UnitCost: "10", Items: item, UnitOfMeasures: unit,
    ProductionBatches: { BatchId: 7, BatchNumber: "BATCH-7", Status: "Completed",
      FinishedProducts: { Items: { ItemName: "Bread" } }, Recipes: { RecipeName: "Bread recipe" } },
    InventoryLots: { LotCode: "LOT-1", Suppliers: { CompanyName: "Mill" }, Locations: { LocationName: "Store" } } };
  const lot = { LotId: 1, LotCode: "LOT-1", ItemId: 1, LocationId: 1, SupplierId: 1, QuantityReceived: "10", QuantityRemaining: "8",
    ReservedQuantity: "3", UnitCost: "10", Status: "Available", Items: item, UnitOfMeasures: unit,
    ReceivedDate: new Date("2026-10-01"), ExpiryDate: null, Locations: { LocationName: "Store" }, Suppliers: { CompanyName: "Mill" },
    GoodsReceiptItems: [{ GoodsReceipts: { GrnNumber: "GRN-1" } }], BatchConsumptions: [consumption],
    ProductionReqLotReservations: [{ ReservationId: 1, ReservedQuantity: "3", ProductionRequests: { ReqNumber: "PR-1", Status: "Approved" } }] };
  const counted = { CycleCountItemId: 1, CycleCountId: 1, ItemId: 1, SystemQuantity: "10", CountedQuantity: "8", UnitCost: "10",
    Items: item, InventoryLots: lot, LotId: 1 };
  const db = <T,>(value: T): T => { if (fake.databaseFails) throw new Error("Private DB details"); return value; };
  return { prisma: {
    inventories: { count: async () => db(1), findMany: async () => db([{ InventoryId: 1, ItemId: 1, CurrentStock: "8", Items: item, Locations: lot.Locations, LocationId: 1 }]) },
    inventoryLots: { count: async () => db(1), findMany: async () => db(fake.extraLot ? [lot, { ...lot, LotId: 2, QuantityRemaining: "2", UnitCost: "20", ReceivedDate: new Date("2026-09-01") }] : [lot]),
      findFirst: async () => db(fake.missing ? null : lot),
      groupBy: async () => db([{ ItemId: 1, _sum: { ReservedQuantity: "3" } }]) },
    finishedProducts: { findMany: async () => db([{ ItemId: 1, ProductId: 1, Variant: "Large", Sku: "LARGE", ProductionBatches: [
      { InventoryLots: { QuantityRemaining: "5", ReservedQuantity: "1", Status: "Available" } },
      { InventoryLots: { QuantityRemaining: "100", ReservedQuantity: "0", Status: "OnHold" } },
    ] }]) },
    cycleCounts: { count: async () => db(1), findMany: async () => db([{ CycleCountId: 1, CountNumber: "CC-1", LocationId: 1, Locations: lot.Locations,
      CountDate: new Date("2026-10-01"), Status: "Open", CountedBy: "Legacy Counter", CycleCountItems: [counted],
      TotalSystemValue: "100", TotalCountedValue: "80", TotalVarianceValue: "-20" }]) },
    cycleCountItems: { findMany: async () => db([counted]) },
    productionBatches: { findFirst: async () => db(fake.missing ? null : { BatchId: 7, BatchNumber: "BATCH-7", Status: "Completed",
      FinishedProducts: { Items: { ItemName: "Bread" } }, Recipes: { RecipeName: "Bread recipe" }, BatchConsumptions: [consumption] }) },
  } };
});

beforeEach(() => { fake.missing = false; fake.databaseFails = false; fake.extraLot = false; });

it("preserves inventory pagination, stock units, reservations and finished-product variants", async () => {
  expect(await listInventory("pageSize=1000")).toMatchObject({ success: true, data: {
    page: 1, pageSize: 1000, totalCount: 1, totalPages: 1, items: [{ itemCode: "FLOUR", currentStock: 8, reservedStock: 3,
      availableStock: 5, uomName: "Kilograms", categoryName: "Ingredients", finishedProductVariants: [
        { variant: "Large", currentStock: 5, reservedStock: 1 },
      ] }],
  } });
});

it("preserves lot reservations and serializes decimals and dates", async () => {
  const result = await listLots("pageSize=1000");
  expect(result).toMatchObject({ success: true, data: { pageSize: 500, items: [{ lotCode: "LOT-1", quantityRemaining: 8,
    reservedQuantity: 3, availableQuantity: 5, receivedDate: "2026-10-01T00:00:00.000Z",
    reservations: [{ reqNumber: "PR-1", reservedQuantity: 3 }] }] } });
  expect(JSON.parse(JSON.stringify(result))).toEqual(result);
  expect(await listItemLots(1)).toMatchObject({ success: true, data: [{ lotCode: "LOT-1", availableQuantity: 5 }] });
});

it("preserves cycle-count history and computes item variance", async () => {
  expect(await listCycleCounts()).toMatchObject({ success: true, data: { totalCount: 1, items: [{ countNumber: "CC-1",
    countedBy: "Legacy Counter", totalVarianceValue: -20, itemCount: 1 }] } });
  expect(await listCycleCountItems(1)).toMatchObject({ success: true, data: [{ systemQuantity: 10, countedQuantity: 8, variance: -2, uomAbbr: "kg" }] });
});

it("preserves forward, backward and simulated recall traceability", async () => {
  expect(await traceForward("lotCode=LOT-1")).toMatchObject({ success: true, data: { lotCode: "LOT-1", supplierName: "Mill",
    grnNumber: "GRN-1", usedInBatches: [{ batchNumber: "BATCH-7", productName: "Bread", quantityUsed: 2 }] } });
  expect(await traceBackward("batchId=BATCH-7")).toMatchObject({ success: true, data: { batchNumber: "BATCH-7", ingredients: [
    { lotCode: "LOT-1", itemName: "Flour", quantityUsed: 2, supplierName: "Mill" },
  ] } });
  expect(await simulateRecall("lotCode=LOT-1")).toMatchObject({ success: true, data: { currentStatus: "Available", affectedBatchCount: 1,
    affectedBatches: [{ batchNumber: "BATCH-7", productName: "Bread" }] } });
});

it("preserves weighted inventory valuation", async () => {
  fake.extraLot = true;
  expect(await getValuation()).toMatchObject({ success: true, data: { totalCount: 1, items: [{ itemName: "Flour", onHandQty: 10,
    movingAverageCost: 12, totalValue: 120, lastReceiptCost: 10 }] } });
});

it("returns useful refusals for missing trace targets", async () => {
  fake.missing = true;
  for (const action of [traceForward, traceBackward, simulateRecall]) {
    expect(await action("lotCode=missing&batchId=missing")).toMatchObject({ success: false, message: expect.stringContaining("not found") });
  }
});

it("refuses malformed pagination and record ids", async () => {
  for (const action of [listInventory, listLots, listCycleCounts]) {
    expect(await action("page=NaN")).toMatchObject({ success: false });
    expect(await action("pageSize=0")).toMatchObject({ success: false });
  }
  expect(await listItemLots(-1)).toMatchObject({ success: false });
  expect(await listLots("itemId=1junk")).toMatchObject({ success: false });
});

it("does not expose database errors to Staff", async () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    fake.databaseFails = true;
    const result = await listInventory();
    expect(result.success).toBe(false); expect(result.message).not.toContain("Private DB details"); expect(log).toHaveBeenCalled();
  } finally { log.mockRestore(); }
});
