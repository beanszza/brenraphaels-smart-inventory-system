import { prisma } from "@/lib/prisma";
import { StockRefusal, stockAvailability, warehouse } from "./stock";
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
 * checkout (stockAvailability), so CREOMS and the shop can never disagree. A Size the IMS does not know is left out; one
 * it no longer sells has nothing to sell.
 */
export async function readInventory(ids: number[]) {
  return prisma.$transaction(async tx => {
    const warehouseId = await warehouse(tx);
    const rows = await tx.finishedProducts.findMany({ where: { ProductId: { in: ids } }, select: { ProductId: true }, orderBy: { ProductId: "asc" } });
    const products = [];
    for (const { ProductId: productId } of rows) {
      try {
        const { quantity, reserved, available } = await stockAvailability(tx, productId, warehouseId);
        products.push({ productId, quantity: quantity.toNumber(), reserved: reserved.toNumber(), available: available.toNumber() });
      } catch (error) {
        if (!(error instanceof StockRefusal) || error.status !== 404) throw error;
        products.push({ productId, quantity: 0, reserved: 0, available: 0 });
      }
    }
    return { products };
  }, { isolationLevel: "RepeatableRead" });
}
