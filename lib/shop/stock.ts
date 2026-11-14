import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

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

export async function sellableLots(tx: Prisma.TransactionClient, id: number, warehouseId: number) {
  const product = await tx.finishedProducts.findUnique({ where: { ProductId: id }, include: { Items: true } });
  if (!product?.Items.IsActive) throw new StockRefusal(404, "product_not_found", "This product Size is unavailable.");
  const variants = await tx.finishedProducts.count({ where: { ItemId: product.ItemId } });
  const lots = await tx.inventoryLots.findMany({
    where: {
      ItemId: product.ItemId, LocationId: warehouseId,
      Status: { in: ["Active", "Available"] }, QuantityRemaining: { gt: 0 },
      OR: [{ ExpiryDate: null }, { ExpiryDate: { gt: new Date() } }],
      // Shared Items do not imply shared Sizes. Unlinked opening stock is safe only for a single Size.
      ...(variants > 1 ? { ProductionBatches: { some: { ProductId: id } } } : {}),
    },
    orderBy: [{ ExpiryDate: "asc" }, { LotId: "asc" }],
  });
  return { product, lots };
}

/** Both lot availability and reconciled Item inventory bound what checkout may promise. */
export async function stockAvailability(tx: Prisma.TransactionClient, id: number, warehouseId: number) {
  const { product, lots } = await sellableLots(tx, id, warehouseId);
  const inventory = await tx.inventories.findUnique({
    where: { ItemId_LocationId: { ItemId: product.ItemId, LocationId: warehouseId } },
  });
  // Include every reservation of the shared Item, across Sizes and even held/expired lots.
  const totals = await tx.inventoryLots.aggregate({
    where: { ItemId: product.ItemId, LocationId: warehouseId }, _sum: { ReservedQuantity: true },
  });
  let quantity = new Prisma.Decimal(0), reserved = new Prisma.Decimal(0), available = new Prisma.Decimal(0);
  for (const lot of lots) {
    quantity = quantity.plus(lot.QuantityRemaining);
    reserved = reserved.plus(lot.ReservedQuantity);
    available = available.plus(Prisma.Decimal.max(0, lot.QuantityRemaining.minus(lot.ReservedQuantity)));
  }
  const reconciled = Prisma.Decimal.max(0, inventory?.CurrentStock ?? 0);
  quantity = Prisma.Decimal.min(quantity, reconciled);
  available = Prisma.Decimal.min(available, Prisma.Decimal.max(0, reconciled.minus(totals._sum.ReservedQuantity ?? 0)));
  return { product, lots, quantity, reserved, available };
}

export async function readStock(id: number) {
  return prisma.$transaction(async tx => {
    const warehouseId = await warehouse(tx);
    const { quantity, reserved, available } = await stockAvailability(tx, id, warehouseId);
    return { warehouseId, productId: id, quantity: quantity.toNumber(), reserved: reserved.toNumber(), available: available.toNumber() };
  }, { isolationLevel: "RepeatableRead" });
}
