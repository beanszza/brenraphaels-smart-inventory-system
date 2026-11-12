"use server";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/portal/staff";
import { resourceResult } from "@/lib/resources/result";
import { read } from "@/lib/inventory/mutate";
import { formatBatchNumber } from "@/lib/production/production-batches";

export async function traceBackward(query = "") {
  await requireModule("Inventory");
  return read(async () => {
    const searchParams = new URLSearchParams(query);
    const batchId = searchParams.get("batchId") || "";

    if (!batchId) {
      return resourceResult({ success: false, message: "batchId query param is required." });
    }

    // Support numeric BatchId, BatchNumber string, or Finished Goods LotCode
    const numericId = parseInt(batchId, 10);
    const suffixMatch = batchId.match(/^BTH-[A-Z0-9]+-(\d{8}-\d+)$/i);
    const batchOrConditions: any[] = [
      { BatchNumber: batchId },
      { InventoryLots: { LotCode: batchId } },
      ...(suffixMatch ? [{ BatchNumber: { endsWith: `-${suffixMatch[1]}` } }] : []),
    ];
    const batch = await prisma.productionBatches.findFirst({
      where: isNaN(numericId)
        ? { OR: batchOrConditions }
        : { OR: [{ BatchId: numericId }, ...batchOrConditions] },
      include: {
        FinishedProducts: { include: { Items: true } },
        Recipes: true,
        InventoryLots: true,
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
      return resourceResult({ success: false, message: `Batch or FG lot "${batchId}" not found.` });
    }

    const ingredientLots = batch.BatchConsumptions.map((bc) => ({
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
      receivedDate: bc.InventoryLots?.ReceivedDate?.toISOString() ?? null,
      unitCost: Number(bc.UnitCost),
    }));

    const productName = batch.FinishedProducts?.Items?.ItemName ?? "";
    const formattedBatchNo = formatBatchNumber(batch.BatchNumber, productName);
    const data = {
      batchId: batch.BatchId,
      batchNumber: formattedBatchNo,
      fgLotCode: batch.InventoryLots?.LotCode ?? null,
      productName,
      recipeName: batch.Recipes?.RecipeName ?? "",
      status: batch.Status,
      productionDate: batch.ProductionDate?.toISOString() ?? null,
      ingredients: ingredientLots,
      producedInBatches: [
        {
          batchId: batch.BatchId,
          batchNumber: formattedBatchNo,
          recipeName: batch.Recipes?.RecipeName ?? "",
          productionDate: batch.ProductionDate?.toISOString() ?? null,
          status: batch.Status,
          ingredientLots,
        },
      ],
    };

    return resourceResult({ success: true, data });
  });
}
