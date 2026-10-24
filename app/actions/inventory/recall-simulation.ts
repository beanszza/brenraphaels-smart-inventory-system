"use server";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/portal/staff";
import { resourceResult } from "@/lib/resources/result";
import { read } from "@/lib/inventory/mutate";

export async function simulateRecall(query = "") {
  await requireModule("Inventory");
  return read(async () => {
    const searchParams = new URLSearchParams(query);
    const lotCode = searchParams.get("lotCode") || "";

    if (!lotCode) {
      return resourceResult({ success: false, message: "lotCode is required." });
    }

    const lot = await prisma.inventoryLots.findFirst({
      where: { LotCode: lotCode },
      include: {
        Items: true,
        Suppliers: true,
        BatchConsumptions: {
          include: {
            ProductionBatches: {
              include: { FinishedProducts: { include: { Items: true } } },
            },
          },
        },
      },
    });

    if (!lot) {
      return resourceResult({ success: false, message: `Lot "${lotCode}" not found.` });
    }

    const affectedBatches = lot.BatchConsumptions.map((bc) => ({
      batchId: bc.BatchId,
      batchNumber: bc.ProductionBatches?.BatchNumber ?? "",
      productName: bc.ProductionBatches?.FinishedProducts?.Items?.ItemName ?? "",
      batchStatus: bc.ProductionBatches?.Status ?? "",
      quantityUsed: Number(bc.QuantityUsed),
    }));

    return resourceResult({
      success: true,
      data: {
        lotCode,
        itemName: lot.Items?.ItemName ?? "",
        supplierName: lot.Suppliers?.CompanyName ?? "",
        quantityReceived: Number(lot.QuantityReceived),
        quantityRemaining: Number(lot.QuantityRemaining),
        currentStatus: lot.Status,
        affectedBatchCount: affectedBatches.length,
        affectedBatches,
        estimatedRecallScope: `${affectedBatches.length} batch(es) affected`,
      },
    });
  });
}
