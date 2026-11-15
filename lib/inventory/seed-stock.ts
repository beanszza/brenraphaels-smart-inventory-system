import { prisma } from "@/lib/prisma";
import { parseVariantComponents, composeVariantName } from "@/lib/production/sku";

let ubeJamStockEnsured = false;

export async function ensureUbeJamHavaneroStock() {
  if (ubeJamStockEnsured) return;
  if (
    typeof (prisma as any)?.items?.findFirst !== "function" ||
    typeof (prisma as any)?.inventories?.upsert !== "function"
  ) {
    return;
  }

  try {
    // 1. Clean up duplicate FinishedProducts variants for the same product name + normalized variant
    const allFps = await prisma.finishedProducts.findMany({
      include: { Items: true },
      orderBy: { ProductId: "asc" },
    });

    const seenKeyToProduct = new Map<string, typeof allFps[number]>();
    const duplicateProductIds: number[] = [];

    for (const fp of allFps) {
      const prodName = (fp.Items?.ItemName || "").trim().toLowerCase();
      if (!prodName) continue;
      const parsed = parseVariantComponents(fp.Variant);
      const canonicalVariant = composeVariantName(parsed.contentSize, parsed.uom, parsed.packagingType).toLowerCase();
      const key = `${prodName}|${canonicalVariant}`;

      if (!seenKeyToProduct.has(key)) {
        seenKeyToProduct.set(key, fp);
      } else {
        duplicateProductIds.push(fp.ProductId);
      }
    }

    for (const dupId of duplicateProductIds) {
      const dupFp = allFps.find((f) => f.ProductId === dupId);
      if (!dupFp) continue;
      const prodName = (dupFp.Items?.ItemName || "").trim().toLowerCase();
      const parsed = parseVariantComponents(dupFp.Variant);
      const canonicalVariant = composeVariantName(parsed.contentSize, parsed.uom, parsed.packagingType).toLowerCase();
      const primaryFp = seenKeyToProduct.get(`${prodName}|${canonicalVariant}`);

      if (primaryFp && primaryFp.ProductId !== dupId) {
        // Re-point any dependent records to the primary variant before deleting duplicate
        await (prisma as any).stockTransferRequestItems
          ?.updateMany({ where: { ProductId: dupId }, data: { ProductId: primaryFp.ProductId } })
          .catch(() => {});
        await (prisma as any).stockTransfers
          ?.updateMany({ where: { ProductId: dupId }, data: { ProductId: primaryFp.ProductId } })
          .catch(() => {});
        await (prisma as any).productionRequests
          ?.updateMany({ where: { ProductId: dupId }, data: { ProductId: primaryFp.ProductId } })
          .catch(() => {});
        await (prisma as any).productionBatches
          ?.updateMany({ where: { ProductId: dupId }, data: { ProductId: primaryFp.ProductId } })
          .catch(() => {});
        await (prisma as any).recipes
          ?.updateMany({ where: { ProductId: dupId }, data: { ProductId: primaryFp.ProductId } })
          .catch(() => {});
        if (dupFp.ItemId !== primaryFp.ItemId) {
          await (prisma as any).inventoryLots
            ?.updateMany({ where: { ItemId: dupFp.ItemId }, data: { ItemId: primaryFp.ItemId } })
            .catch(() => {});
        }

        await prisma.finishedProducts.delete({ where: { ProductId: dupId } }).catch(() => {});
      }
    }

    // 1b. Restore any missing Inventories rows for items that have active/available lots
    // (e.g. Ube Halaya items whose Inventories record was wiped by legacy cleanupTestStock)
    const activeLots = await (prisma as any).inventoryLots
      ?.findMany({
        where: {
          Status: { in: ["Available", "Active"] },
          QuantityRemaining: { gt: 0 },
        },
        select: {
          ItemId: true,
          LocationId: true,
          QuantityRemaining: true,
        },
      })
      .catch(() => []);

    if (Array.isArray(activeLots) && activeLots.length > 0) {
      const lotSumByItemLoc = new Map<string, { itemId: number; locationId: number; total: number }>();
      for (const l of activeLots) {
        const key = `${l.ItemId}|${l.LocationId}`;
        const existing = lotSumByItemLoc.get(key) || { itemId: l.ItemId, locationId: l.LocationId, total: 0 };
        existing.total += Number(l.QuantityRemaining || 0);
        lotSumByItemLoc.set(key, existing);
      }

      for (const entry of lotSumByItemLoc.values()) {
        const existingInv = await (prisma as any).inventories
          ?.findFirst({
            where: { ItemId: entry.itemId, LocationId: entry.locationId },
          })
          .catch(() => null);

        if (!existingInv) {
          await (prisma as any).inventories
            ?.create({
              data: {
                ItemId: entry.itemId,
                LocationId: entry.locationId,
                CurrentStock: entry.total,
              },
            })
            .catch(() => {});
        }
      }
    }

    // 2. Migrate any legacy STF-YYYY-XXXX TransferNumbers to their parent STR RequestNumber
    // and sync parent STR Status to "Completed" if all its transfers are already Completed/Received
    const transfersWithRequests = await (prisma as any).stockTransfers
      ?.findMany({
        where: { RequestId: { not: null } },
        include: { StockTransferRequests: true },
      })
      .catch(() => []);

    if (Array.isArray(transfersWithRequests)) {
      const requestIdsToComplete = new Set<number>();
      for (const st of transfersWithRequests) {
        const parentStrNum = st.StockTransferRequests?.RequestNumber;
        if (parentStrNum && st.TransferNumber !== parentStrNum) {
          await (prisma as any).stockTransfers
            ?.update({
              where: { TransferId: st.TransferId },
              data: { TransferNumber: parentStrNum },
            })
            .catch(() => {});
        }
        if (
          st.RequestId &&
          (st.Status === "Completed" || st.Status === "Received") &&
          st.StockTransferRequests?.Status !== "Completed"
        ) {
          requestIdsToComplete.add(st.RequestId);
        }
      }

      for (const reqId of requestIdsToComplete) {
        await (prisma as any).stockTransferRequests
          ?.update({
            where: { RequestId: reqId },
            data: { Status: "Completed" },
          })
          .catch(() => {});
      }
    }

    ubeJamStockEnsured = true;
  } catch (err) {
    console.warn("[ENSURE-UBE-JAM-STOCK-WARN]", err);
  }
}
