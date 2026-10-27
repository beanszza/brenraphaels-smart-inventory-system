"use server";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/portal/staff";
import { resourceResult } from "@/lib/resources/result";
import { read } from "@/lib/inventory/mutate";

export async function traceBackward(query = "") {
  await requireModule("Inventory");
  return read(async () => {
    const searchParams = new URLSearchParams(query);
    const batchId = searchParams.get("batchId") || "";

    if (!batchId) {
      return resourceResult({ success: false, message: "batchId query param is required." });
    }

    // Support both numeric ID and batch number string
    const numericId = parseInt(batchId, 10);
    const batch = await prisma.productionBatches.findFirst({
      where: isNaN(numericId)
        ? { BatchNumber: batchId }
        : { OR: [{ BatchId: numericId }, { BatchNumber: batchId }] },
      include: {
        FinishedProducts: { include: { Items: true } },
        Recipes: true,
        BatchConsumptions: {
          include: {
            Items: { include: { Category: true } },
            InventoryLots: {
              include: { Suppliers: true, Locations: true },
            },
            UnitOfMeasures: true,
          },
        },
      },
    });

    if (!batch) {
      return resourceResult({ success: false, message: `Batch "${batchId}" not found.` });
    }

    const data = {
      batchId: batch.BatchId,
      batchNumber: batch.BatchNumber,
      productName: batch.FinishedProducts?.Items?.ItemName ?? "",
      recipeName: batch.Recipes?.RecipeName ?? "",
      status: batch.Status,
      productionDate: batch.ProductionDate?.toISOString() ?? null,
      ingredients: batch.BatchConsumptions.map((bc) => ({
        consumptionId: bc.BatchConsumptionId,
        itemId: bc.ItemId,
        itemName: bc.Items?.ItemName ?? "",
        categoryName: bc.Items?.Category?.CategoryName ?? "",
        requiredQuantity: Number(bc.RequiredQuantity),
        quantityUsed: Number(bc.QuantityUsed),
        uomAbbr: bc.UnitOfMeasures?.Abbreviation ?? "",
        lotId: bc.LotId ?? null,
        lotCode: bc.InventoryLots?.LotCode ?? null,
        supplierName: bc.InventoryLots?.Suppliers?.CompanyName ?? "",
        locationName: bc.InventoryLots?.Locations?.LocationName ?? "",
        unitCost: Number(bc.UnitCost),
      })),
    };

    return resourceResult({ success: true, data });
  });
}
