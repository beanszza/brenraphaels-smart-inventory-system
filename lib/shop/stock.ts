import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { SEEDED_TEST_LOT_PREFIXES } from "./test-lots";

export class StockRefusal extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}

export function productId(value: unknown): number {
  const id = typeof value === "string" && /^\d+$/.test(value) ? Number(value) : value;
  if (typeof id !== "number" || !Number.isSafeInteger(id) || id < 1 || id > 2147483647) {
    throw new StockRefusal(400, "invalid_product", "Select a valid product Size.");
  }
  return id;
}

export async function warehouse(tx: Prisma.TransactionClient) {
  const setting = process.env.IMS_SHOP_WAREHOUSE_ID;
  const id = setting && /^\d+$/.test(setting) ? Number(setting) : NaN;
  if (!Number.isSafeInteger(id) || id < 1 || id > 2147483647) throw new StockRefusal(503, "warehouse_unavailable", "The shop Warehouse has not been configured.");
  const location = await tx.locations.findUnique({ where: { LocationId: id } });
  if (!location?.IsActive || !["warehouse", "commissary", "finished goods"].includes(location.LocationType.toLowerCase())) {
    throw new StockRefusal(503, "warehouse_unavailable", "The shop Warehouse is unavailable.");
  }
  return id;
}

/** The lots the shop may count for an Item in the shop Warehouse, before deciding which Size each belongs to. */
export const candidateLotWhere = (itemIds: number[], warehouseId: number): Prisma.InventoryLotsWhereInput => ({
  ItemId: { in: itemIds }, LocationId: warehouseId,
  Status: { in: ["Active", "Available"] }, QuantityRemaining: { gt: 0 },
  OR: [{ ExpiryDate: null }, { ExpiryDate: { gt: new Date() } }],
  NOT: SEEDED_TEST_LOT_PREFIXES.map(prefix => ({ LotCode: { startsWith: prefix } })),
});

/**
 * Whether a lot in the shop Warehouse belongs to this Size: one its production batch made, or, for an Item with only one
 * Size, produced stock with no batch record (the Factory's lots). An unlinked lot of an Item shared by several Sizes cannot
 * be told apart, so it is never sold. Stock sent to branches is never in the shop Warehouse, so it never counts.
 */
export function belongsToSize(lot: { ProductionBatches: { ProductId: number }[] }, sizeId: number, oneSize: boolean): boolean {
  if (lot.ProductionBatches.length === 0) return oneSize;
  return lot.ProductionBatches.some(batch => batch.ProductId === sizeId);
}

type FigureLot = { QuantityRemaining: Prisma.Decimal; ReservedQuantity: Prisma.Decimal };

/** The shop's figures for one Size from its lots, bounded by the reconciled Item inventory less every reservation of the Item. */
export function sizeAvailability(lots: FigureLot[], currentStock: Prisma.Decimal.Value | null | undefined, itemReserved: Prisma.Decimal.Value | null | undefined) {
  let quantity = new Prisma.Decimal(0), reserved = new Prisma.Decimal(0), available = new Prisma.Decimal(0);
  for (const lot of lots) {
    quantity = quantity.plus(lot.QuantityRemaining);
    reserved = reserved.plus(lot.ReservedQuantity);
    available = available.plus(Prisma.Decimal.max(0, lot.QuantityRemaining.minus(lot.ReservedQuantity)));
  }
  const reconciled = Prisma.Decimal.max(0, currentStock ?? 0);
  quantity = Prisma.Decimal.min(quantity, reconciled);
  available = Prisma.Decimal.min(available, Prisma.Decimal.max(0, reconciled.minus(itemReserved ?? 0)));
  return { quantity, reserved, available };
}

export async function sellableLots(tx: Prisma.TransactionClient, id: number, warehouseId: number) {
  const product = await tx.finishedProducts.findUnique({ where: { ProductId: id }, include: { Items: true } });
  if (!product?.Items.IsActive) throw new StockRefusal(404, "product_not_found", "This product Size is unavailable.");
  const [candidates, sizes] = await Promise.all([
    tx.inventoryLots.findMany({
      where: candidateLotWhere([product.ItemId], warehouseId),
      include: { ProductionBatches: { select: { ProductId: true } } },
      orderBy: [{ ExpiryDate: "asc" }, { LotId: "asc" }],
    }),
    tx.finishedProducts.count({ where: { ItemId: product.ItemId } }),
  ]);
  return { product, lots: candidates.filter(lot => belongsToSize(lot, id, sizes === 1)) };
}

/**
 * The one rule for what the shop may sell of a Size: what was produced of it and is still in the shop Warehouse (never
 * stock sent to branches), less every reservation, bounded by the reconciled Item inventory. The shop catalog, checkout
 * and CREOMS's Stock page all read it.
 */
export async function stockAvailability(tx: Prisma.TransactionClient, id: number, warehouseId: number) {
  const { product, lots } = await sellableLots(tx, id, warehouseId);
  const inventory = await tx.inventories.findUnique({
    where: { ItemId_LocationId: { ItemId: product.ItemId, LocationId: warehouseId } },
  });
  // Include every reservation of the shared Item, across Sizes and even held/expired lots.
  const totals = await tx.inventoryLots.aggregate({
    where: { ItemId: product.ItemId, LocationId: warehouseId }, _sum: { ReservedQuantity: true },
  });
  return { product, lots, ...sizeAvailability(lots, inventory?.CurrentStock, totals._sum.ReservedQuantity) };
}

export async function readStock(id: number) {
  return prisma.$transaction(async tx => {
    const warehouseId = await warehouse(tx);
    const { quantity, reserved, available } = await stockAvailability(tx, id, warehouseId);
    return { warehouseId, productId: id, quantity: quantity.toNumber(), reserved: reserved.toNumber(), available: available.toNumber() };
  }, { isolationLevel: "RepeatableRead" });
}
