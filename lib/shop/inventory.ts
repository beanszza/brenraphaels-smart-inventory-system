import { prisma } from "@/lib/prisma";
import { StockRefusal, belongsToSize, candidateLotWhere, sizeAvailability, warehouse } from "./stock";
import { isSeededTestLot } from "./test-lots";

const COUNTED_LOT_STATUSES = ["Available", "Active"];

/** The lot fields sizeFigures reads, so the tab and the shop inventory read select the same ones. */
export const lotSelect = { LotId: true, LotCode: true, QuantityRemaining: true, ReservedQuantity: true, Status: true } as const;

type BatchLot = { LotCode: string; QuantityRemaining: unknown; ReservedQuantity: unknown; Status: string; LotId: number } | null;

/**
 * What the Finished Goods tab shows for one Size: the lots its production batches made, in any location, still
 * Active or Available, less the seeded test lots. The shop and CREOMS count the same lots, but only in the shop Warehouse.
 */
export function sizeFigures(batches: { InventoryLots: BatchLot }[] | undefined): { quantity: number; reserved: number } {
  let quantity = 0, reserved = 0;
  const seen = new Set<number>();
  for (const batch of batches ?? []) {
    const lot = batch.InventoryLots;
    const seeded = !!lot && isSeededTestLot(lot.LotCode);
    if (lot && !seeded && COUNTED_LOT_STATUSES.includes(lot.Status) && !seen.has(lot.LotId)) {
      seen.add(lot.LotId);
      quantity += Number(lot.QuantityRemaining || 0);
      reserved += Number(lot.ReservedQuantity || 0);
    }
  }
  return { quantity, reserved };
}

export function productIds(raw: string | null): number[] {
  const ids = (raw ?? "").split(",").filter(Boolean).map(Number);
  if (ids.length === 0 || ids.length > 200 || ids.some(id => !Number.isSafeInteger(id) || id < 1 || id > 2147483647)) {
    throw new StockRefusal(400, "invalid_products", "Ask for between 1 and 200 product ids.");
  }
  return [...new Set(ids)];
}

/** The Finished Goods tab's figures per Size, in any location. A Size the IMS does not know is left out. */
export async function readTabFigures(ids: number[]) {
  const rows = await prisma.finishedProducts.findMany({
    where: { ProductId: { in: ids } },
    select: {
      ProductId: true,
      ProductionBatches: { select: { InventoryLots: { select: lotSelect } } },
    },
    orderBy: { ProductId: "asc" },
  });
  return rows.map(row => ({ productId: row.ProductId, ...sizeFigures(row.ProductionBatches) }));
}

/**
 * Read-only stock per Size for CREOMS's Stock page: what the shop can sell from the shop Warehouse, by the same rule as
 * checkout (belongsToSize and sizeAvailability), so CREOMS and the shop can never disagree. A Size the IMS does not know
 * is left out; one it no longer sells has nothing to sell. A handful of reads for the whole list, so 200 Sizes answer fast.
 */
export async function readInventory(ids: number[]) {
  return prisma.$transaction(async tx => {
    const warehouseId = await warehouse(tx);
    const rows = await tx.finishedProducts.findMany({
      where: { ProductId: { in: ids } }, select: { ProductId: true, ItemId: true, Items: { select: { IsActive: true } } }, orderBy: { ProductId: "asc" },
    });
    const itemIds = [...new Set(rows.map(row => row.ItemId))];
    const [lots, sizeCounts, inventories, reservedByItem] = await Promise.all([
      tx.inventoryLots.findMany({
        where: candidateLotWhere(itemIds, warehouseId),
        select: { ItemId: true, QuantityRemaining: true, ReservedQuantity: true, ProductionBatches: { select: { ProductId: true } } },
      }),
      tx.finishedProducts.groupBy({ by: ["ItemId"], where: { ItemId: { in: itemIds } }, _count: { _all: true } }),
      tx.inventories.findMany({ where: { ItemId: { in: itemIds }, LocationId: warehouseId }, select: { ItemId: true, CurrentStock: true } }),
      tx.inventoryLots.groupBy({ by: ["ItemId"], where: { ItemId: { in: itemIds }, LocationId: warehouseId }, _sum: { ReservedQuantity: true } }),
    ]);
    const sizesOf = new Map(sizeCounts.map(entry => [entry.ItemId, entry._count._all]));
    const stockOf = new Map(inventories.map(entry => [entry.ItemId, entry.CurrentStock]));
    const heldOf = new Map(reservedByItem.map(entry => [entry.ItemId, entry._sum.ReservedQuantity]));
    const products = rows.map(({ ProductId: productId, ItemId: itemId, Items: item }) => {
      if (!item.IsActive) return { productId, quantity: 0, reserved: 0, available: 0 };
      const own = lots.filter(lot => lot.ItemId === itemId && belongsToSize(lot, productId, sizesOf.get(itemId) === 1));
      const { quantity, reserved, available } = sizeAvailability(own, stockOf.get(itemId), heldOf.get(itemId));
      return { productId, quantity: quantity.toNumber(), reserved: reserved.toNumber(), available: available.toNumber() };
    });
    return { products };
  }, { isolationLevel: "RepeatableRead" });
}
