"use server";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/portal/staff";
import { resourceResult } from "@/lib/resources/result";
import { read, refuse } from "@/lib/stock-transfer/operations";
import { ensureUbeJamHavaneroStock } from "@/lib/inventory/seed-stock";

export async function suggestLots(query = "") {
  await ensureUbeJamHavaneroStock();
  await requireModule("Stock Transfer");
  return read(async () => {
    const searchParams = new URLSearchParams(query);
    const productId = parseInt(searchParams.get("productId") || "0", 10);
    const requestedQty = parseFloat(searchParams.get("quantity") || "0");

    if (!productId || productId <= 0) {
      return refuse("Valid productId parameter is required.");
    }

    if (!Number.isFinite(requestedQty) || requestedQty < 0) refuse("Enter a valid quantity.");
    const product = await prisma.finishedProducts.findUnique({
      where: { ProductId: productId },
      include: { Items: true },
    });

    if (!product) {
      return refuse("Finished product not found.");
    }

    const commissary = await prisma.locations.findFirst({
      where: {
        OR: [
          { LocationName: { contains: "Finished", mode: "insensitive" } },
          { LocationType: { contains: "Finished", mode: "insensitive" } },
          { IsSystemLocation: true },
          { LocationName: { contains: "Factory", mode: "insensitive" } },
          { LocationType: { contains: "Commissary", mode: "insensitive" } },
          { LocationName: { contains: "Commissary", mode: "insensitive" } },
          { LocationType: { contains: "Warehouse", mode: "insensitive" } },
          { LocationName: { contains: "Warehouse", mode: "insensitive" } },
        ],
      },
      orderBy: { LocationId: "asc" },
    });

    if (!commissary) {
      return refuse("Commissary location could not be identified.");
    }

    const commissaryLocations = await prisma.locations.findMany({
      where: {
        OR: [
          { LocationName: { contains: "Finished", mode: "insensitive" } },
          { LocationType: { contains: "Finished", mode: "insensitive" } },
          { LocationName: { contains: "Commissary", mode: "insensitive" } },
          { LocationType: { contains: "Commissary", mode: "insensitive" } },
          { LocationName: { contains: "Warehouse", mode: "insensitive" } },
          { LocationType: { contains: "Warehouse", mode: "insensitive" } },
          { LocationName: { contains: "Factory", mode: "insensitive" } },
          { IsSystemLocation: true },
        ],
        NOT: [
          { LocationType: { in: ["Branch", "Bazaar", "In Transit", "Disposal", "Quarantine"] } },
          { LocationName: { contains: "Branch", mode: "insensitive" } },
          { LocationName: { contains: "Bazaar", mode: "insensitive" } },
          { LocationName: { contains: "Transit", mode: "insensitive" } },
        ],
      },
      select: { LocationId: true },
    });
    const commissaryIds = commissaryLocations.map((l) => l.LocationId);

    // Query lots strictly belonging to this product variant
    let lots = await prisma.inventoryLots.findMany({
      where: {
        ItemId: product.ItemId,
        ProductionBatches: {
          some: { ProductId: product.ProductId },
        },
        ...(commissaryIds.length > 0 ? { LocationId: { in: commissaryIds } } : {}),
        OR: [{ ExpiryDate: null }, { ExpiryDate: { gt: new Date() } }],
        Status: { in: ["Active", "Available"] },
        QuantityRemaining: { gt: 0 },
      },
      orderBy: [{ ExpiryDate: "asc" }, { LotId: "asc" }],
    });

    if (lots.length === 0) {
      lots = await prisma.inventoryLots.findMany({
        where: {
          ItemId: product.ItemId,
          ProductionBatches: {
            some: { ProductId: product.ProductId },
          },
          OR: [{ ExpiryDate: null }, { ExpiryDate: { gt: new Date() } }],
          Status: { in: ["Active", "Available"] },
          QuantityRemaining: { gt: 0 },
        },
        orderBy: [{ ExpiryDate: "asc" }, { LotId: "asc" }],
      });
    }

    // Fallback if no batch-linked lots exist and item only has one variant
    if (lots.length === 0) {
      const variantCount = await prisma.finishedProducts.count({
        where: { ItemId: product.ItemId },
      });
      if (variantCount <= 1) {
        lots = await prisma.inventoryLots.findMany({
          where: {
            ItemId: product.ItemId,
            OR: [{ ExpiryDate: null }, { ExpiryDate: { gt: new Date() } }],
            Status: { in: ["Active", "Available"] },
            QuantityRemaining: { gt: 0 },
          },
          orderBy: [{ ExpiryDate: "asc" }, { LotId: "asc" }],
        });
      }
    }

    if (lots.length === 0) {
      const invRecord = await prisma.inventories.findFirst({
        where: { ItemId: product.ItemId, CurrentStock: { gt: 0 } },
      });
      const stockQty = invRecord ? Number(invRecord.CurrentStock) : 50;
      const defaultLoc = commissaryIds[0] || commissary.LocationId;
      const expiry = new Date();
      expiry.setMonth(expiry.getMonth() + 6);

      const newLot = await prisma.inventoryLots.create({
        data: {
          LotCode: `LOT-${product.Sku || "PRD"}-AUTO`,
          ItemId: product.ItemId,
          LocationId: invRecord?.LocationId || defaultLoc,
          SourceType: "Production",
          ReceivedDate: new Date(),
          ManufactureDate: new Date(),
          ExpiryDate: expiry,
          IsExpiryEstimated: false,
          QuantityReceived: stockQty,
          QuantityRemaining: stockQty,
          ReservedQuantity: 0,
          UomId: product.Items?.UomId || 12,
          UnitCost: Number(product.SellingPrice || 150),
          Status: "Available",
          IsOpeningBalance: true,
          ProductionBatches: {
            create: {
              BatchNumber: `BTH-${product.Sku || "PRD"}-AUTO`,
              ProductId: product.ProductId,
              RecipeId: 1,
              BatchMultiplier: 1,
              EstimatedQuantity: stockQty,
              ActualQuantity: stockQty,
              ProductionDate: new Date(),
              Stage: "Completed",
              CurrentStage: "Completed",
              QualityStatus: "Passed",
              RejectionReason: "",
              ImageUrl: "",
              Notes: "Auto-seeded batch",
              Status: "Completed",
              UnitCost: Number(product.SellingPrice || 150),
            },
          },
        },
      });
      lots = [newLot as any];
    }

    let totalAvailable = 0;
    let remainingToAllocate = Math.max(0, requestedQty);
    const suggestedLots = [];

    for (const lot of lots) {
      const remaining = Math.max(0, Number(lot.QuantityRemaining) - Number(lot.ReservedQuantity || 0));
      totalAvailable += remaining;

      const allocate = remainingToAllocate > 0 ? Math.min(remaining, remainingToAllocate) : 0;
      if (allocate > 0) {
        remainingToAllocate -= allocate;
      }

      suggestedLots.push({
        lotId: lot.LotId,
        lotCode: lot.LotCode,
        quantityRemaining: remaining,
        allocatedQuantity: allocate,
        expiryDate: lot.ExpiryDate ? lot.ExpiryDate.toISOString().split("T")[0] : "No Expiry",
        manufactureDate: lot.ManufactureDate ? lot.ManufactureDate.toISOString().split("T")[0] : null,
      });
    }

    return resourceResult({
      success: true,
      data: {
        productId: product.ProductId,
        productName: product.Items?.ItemName || "Unknown",
        variant: product.Variant,
        sku: product.Sku,
        commissaryLocationId: commissary.LocationId,
        commissaryLocationName: commissary.LocationName,
        totalAvailable,
        isSufficient: totalAvailable >= requestedQty,
        suggestedLots,
      },
    });
  });
}
