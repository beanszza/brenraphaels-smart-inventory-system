import type { Prisma } from "@prisma/client";

const SHOP_WAREHOUSE_TYPES = ["warehouse", "commissary", "finished goods"];

/**
 * Resolves the storage Location for finished goods produced in IMS.
 * Priority:
 * 1. Explicit locationId passed by the caller.
 * 2. Configured shop Warehouse (`IMS_SHOP_WAREHOUSE_ID`) when active and of type
 *    Warehouse, Commissary, or Finished Goods (same rule as `lib/shop/stock.ts`),
 *    so produced stock is immediately visible to CREOMS and the online shop.
 * 3. Fallback to an active Finished Goods location, or the first active location.
 */
export async function resolveFinishedGoodsLocation(
  tx: Prisma.TransactionClient,
  explicitLocationId?: number | null,
) {
  if (explicitLocationId && Number.isSafeInteger(explicitLocationId) && explicitLocationId > 0) {
    return tx.locations.findUnique({ where: { LocationId: explicitLocationId } });
  }

  const setting = process.env.IMS_SHOP_WAREHOUSE_ID?.trim();
  const shopWarehouseId = setting && /^\d+$/.test(setting) ? Number(setting) : NaN;
  if (Number.isSafeInteger(shopWarehouseId) && shopWarehouseId >= 1 && shopWarehouseId <= 2147483647) {
    const shopLocation = await tx.locations.findUnique({ where: { LocationId: shopWarehouseId } });
    if (
      shopLocation?.IsActive &&
      SHOP_WAREHOUSE_TYPES.includes(String(shopLocation.LocationType || "").toLowerCase())
    ) {
      return shopLocation;
    }
  }

  const fgTypeLocation = await tx.locations.findFirst({
    where: {
      IsActive: true,
      LocationType: { contains: "Finished Goods", mode: "insensitive" },
    },
    orderBy: { LocationId: "asc" },
  });
  if (fgTypeLocation) return fgTypeLocation;

  return tx.locations.findFirst({
    where: { IsActive: true },
    orderBy: { LocationId: "asc" },
  });
}
