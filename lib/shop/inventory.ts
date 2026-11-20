import { prisma } from "@/lib/prisma";
import { StockRefusal } from "./stock";

type BatchLot = { LotCode: string; QuantityRemaining: unknown; ReservedQuantity: unknown; Status: string; LotId: number } | null;

/**
 * What the Finished Goods tab shows for one Size: the lots its production batches made, in any location, still
 * Active or Available, less the seeded test lots. The tab and CREOMS both use this, so their numbers cannot differ.
 */
export function sizeFigures(batches: { InventoryLots: BatchLot }[] | undefined): { quantity: number; reserved: number } {
  let quantity = 0, reserved = 0;
  const seen = new Set<number>();
  for (const batch of batches ?? []) {
    const lot = batch.InventoryLots;
    const seeded = typeof lot?.LotCode === "string" && (lot.LotCode.startsWith("LOT-UJH-2026-") || lot.LotCode.startsWith("LOT-UBH-2026-"));
    if (lot && !seeded && (lot.Status === "Available" || lot.Status === "Active") && !seen.has(lot.LotId)) {
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

/** Read-only stock per Size for CREOMS's Stock page. A Size the IMS does not know is left out. */
export async function readInventory(ids: number[]) {
  const rows = await prisma.finishedProducts.findMany({
    where: { ProductId: { in: ids } },
    select: {
      ProductId: true,
      ProductionBatches: { select: { InventoryLots: { select: { LotId: true, LotCode: true, QuantityRemaining: true, ReservedQuantity: true, Status: true } } } },
    },
    orderBy: { ProductId: "asc" },
  });
  return {
    products: rows.map(row => {
      const { quantity, reserved } = sizeFigures(row.ProductionBatches);
      return { productId: row.ProductId, quantity, reserved, available: Math.max(0, quantity - reserved) };
    }),
  };
}
