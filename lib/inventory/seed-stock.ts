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

        await prisma.finishedProducts.delete({ where: { ProductId: dupId } }).catch(() => {});
      }
    }

    ubeJamStockEnsured = true;
  } catch (err) {
    console.warn("[ENSURE-UBE-JAM-STOCK-WARN]", err);
  }
}
