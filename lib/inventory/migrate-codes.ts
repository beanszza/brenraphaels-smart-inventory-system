import { prisma } from "@/lib/prisma";
import { buildBaseVariantSku } from "@/lib/production/sku";
import { formatLotCode, getLotCategoryCode, getLotItemAbbreviation } from "@/lib/inventory/lot-code";

let legacyCodesMigrated = false;

const NEW_SKU_REGEX = /^[A-Z0-9]{3}-[A-Z0-9]{3}-[A-Z0-9]{3}-[A-Z0-9]+(-\d+)?$/;
const NEW_LOT_REGEX = /^(RM|PM|WIP|FG)-[A-Z0-9]{3}-\d{6}-\d{2,}$/;

export async function migrateLegacySkusAndLots() {
  if (legacyCodesMigrated) return;
  if (
    typeof (prisma as any)?.$transaction !== "function" ||
    typeof (prisma as any)?.finishedProducts?.findMany !== "function" ||
    typeof (prisma as any)?.inventoryLots?.findMany !== "function"
  ) {
    return;
  }

  try {
    const [fps, lots] = await Promise.all([
      prisma.finishedProducts.findMany({
        include: { Items: true },
        orderBy: { ProductId: "asc" },
      }),
      prisma.inventoryLots.findMany({
        include: { Items: { include: { Category: true } } },
        orderBy: [{ ReceivedDate: "asc" }, { LotId: "asc" }],
      }),
    ]);

    const fpsToUpdate = fps.filter((fp) => !NEW_SKU_REGEX.test((fp.Sku || "").trim().toUpperCase()));
    const lotsToUpdate = lots.filter((l) => !NEW_LOT_REGEX.test((l.LotCode || "").trim().toUpperCase()));

    if (fpsToUpdate.length === 0 && lotsToUpdate.length === 0) {
      legacyCodesMigrated = true;
      return;
    }

    await prisma.$transaction(async (tx) => {
      // 1. Migrate legacy SKUs to [PRODUCT]-[VARIANT]-[PACKAGING]-[WEIGHT]
      if (fpsToUpdate.length > 0) {
        const usedSkus = new Set(fps.map((f) => (f.Sku || "").trim().toUpperCase()));
        for (const fp of fpsToUpdate) {
          const oldSku = (fp.Sku || "").trim().toUpperCase();
          usedSkus.delete(oldSku);
          const base = buildBaseVariantSku(fp.Items?.ItemName || "", fp.Variant || "");
          let candidate = base;
          let counter = 2;
          while (usedSkus.has(candidate)) {
            candidate = `${base}-${counter++}`;
          }
          usedSkus.add(candidate);
          await tx.finishedProducts.update({
            where: { ProductId: fp.ProductId },
            data: { Sku: candidate },
          });
        }
      }

      // 2. Migrate legacy LotCodes to [CATEGORY]-[ITEM]-[YYMMDD]-[BATCH#]
      if (lotsToUpdate.length > 0) {
        const usedLotLocKeys = new Set(
          lots.map((l) => `${(l.LotCode || "").trim().toUpperCase()}|${l.LocationId}`)
        );
        const seqMap = new Map<string, number>();

        for (const lot of lotsToUpdate) {
          const oldCode = lot.LotCode;
          const oldKey = `${(oldCode || "").trim().toUpperCase()}|${lot.LocationId}`;
          usedLotLocKeys.delete(oldKey);

          const categoryName =
            lot.SourceType === "Production"
              ? "Finished Goods"
              : lot.Items?.Category?.CategoryName || "Raw Material";
          const itemName = lot.Items?.ItemName || "Item";
          const date = lot.ManufactureDate || lot.ReceivedDate || new Date();

          const cat = getLotCategoryCode(categoryName);
          const itemAbbr = getLotItemAbbreviation(itemName);
          const yy = String(date.getFullYear()).slice(-2);
          const mm = String(date.getMonth() + 1).padStart(2, "0");
          const dd = String(date.getDate()).padStart(2, "0");
          const bucketKey = `${cat}|${itemAbbr}|${yy}${mm}${dd}|${lot.LocationId}`;

          let seq = (seqMap.get(bucketKey) || 0) + 1;
          let newCode = formatLotCode(categoryName, itemName, date, seq);
          while (usedLotLocKeys.has(`${newCode}|${lot.LocationId}`)) {
            seq++;
            newCode = formatLotCode(categoryName, itemName, date, seq);
          }
          seqMap.set(bucketKey, seq);
          usedLotLocKeys.add(`${newCode}|${lot.LocationId}`);

          await tx.inventoryLots.update({
            where: { LotId: lot.LotId },
            data: { LotCode: newCode },
          });

          // Keep historical LotCode text references in sync
          await tx.materialIssuanceScans.updateMany({
            where: { LotId: lot.LotId },
            data: { LotCode: newCode },
          });
          await tx.stockInLines.updateMany({
            where: { ItemId: lot.ItemId, LotCode: oldCode },
            data: { LotCode: newCode },
          });
          await tx.putAwayTransactions.updateMany({
            where: { LotCode: oldCode },
            data: { LotCode: newCode },
          });
          await tx.recallRecords.updateMany({
            where: { TargetLotCode: oldCode },
            data: { TargetLotCode: newCode },
          });
        }
      }
    }, { isolationLevel: "Serializable" });

    legacyCodesMigrated = true;
  } catch (err) {
    console.warn("[MIGRATE-LEGACY-CODES-WARN]", err);
  }
}

