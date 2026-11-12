"use server";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/portal/staff";
import { resourceResult } from "@/lib/resources/result";
import { read } from "@/lib/inventory/mutate";

export async function traceForward(query = "") {
  await requireModule("Inventory");
  return read(async () => {
    const searchParams = new URLSearchParams(query);
    const lotCode = searchParams.get("lotCode") || "";

    if (!lotCode) {
      return resourceResult({ success: false, message: "lotCode query param is required." });
    }

    const lot = await prisma.inventoryLots.findFirst({
      where: { LotCode: lotCode },
      include: {
        Items: { include: { Category: true } },
        Suppliers: true,
        Locations: true,
        GoodsReceiptItems: {
          include: { GoodsReceipts: true },
        },
        BatchConsumptions: {
          include: {
            ProductionBatches: {
              include: {
                FinishedProducts: { include: { Items: true } },
                Recipes: true,
                InventoryLots: true,
              },
            },
          },
        },
      },
    });

    if (!lot) {
      return resourceResult({ success: false, message: `Lot code "${lotCode}" not found.` });
    }

    const data = {
      lotCode: lot.LotCode,
      itemId: lot.ItemId,
      itemName: lot.Items?.ItemName ?? "",
      categoryName: lot.Items?.Category?.CategoryName ?? "",
      supplierId: lot.SupplierId ?? null,
      supplierName: lot.Suppliers?.CompanyName ?? "",
      locationName: lot.Locations?.LocationName ?? "",
      receivedDate: lot.ReceivedDate.toISOString(),
      expiryDate: lot.ExpiryDate?.toISOString().split("T")[0] ?? null,
      quantityReceived: Number(lot.QuantityReceived),
      quantityRemaining: Number(lot.QuantityRemaining),
      status: lot.Status,
      grnNumber: lot.GoodsReceiptItems?.[0]?.GoodsReceipts?.GrnNumber ?? null,
      usedInBatches: lot.BatchConsumptions.map((bc) => {
        const batch = bc.ProductionBatches;
        const fgLot = batch?.InventoryLots;
        const productName = batch?.FinishedProducts?.Items?.ItemName ?? "";
        return {
          batchId: bc.BatchId,
          batchNumber: batch?.BatchNumber ?? "",
          productName,
          recipeName: batch?.Recipes?.RecipeName ?? "",
          productionDate: batch?.ProductionDate?.toISOString() ?? null,
          quantityUsed: Number(bc.QuantityUsed),
          status: batch?.Status ?? "",
          fgLots: fgLot
            ? [
                {
                  fgLotCode: fgLot.LotCode,
                  productName,
                  expiryDate: fgLot.ExpiryDate ? fgLot.ExpiryDate.toISOString() : null,
                  status: fgLot.Status,
                  shipments: [],
                },
              ]
            : [],
        };
      }),
    };

    return resourceResult({ success: true, data });
  });
}
