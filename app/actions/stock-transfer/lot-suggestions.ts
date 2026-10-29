"use server";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/portal/staff";
import { resourceResult } from "@/lib/resources/result";
import { read, refuse } from "@/lib/stock-transfer/operations";
export async function suggestLots(query = "") {
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
          { IsSystemLocation: true },
          { LocationType: { contains: "Commissary", mode: "insensitive" } },
          { LocationName: { contains: "Commissary", mode: "insensitive" } },
        ],
      },
    });

    if (!commissary) {
      return refuse("Commissary location could not be identified.");
    }

    const lots = await prisma.inventoryLots.findMany({
      where: {
        ItemId: product.ItemId,
              LocationId: commissary.LocationId,
              OR: [{ ExpiryDate: null }, { ExpiryDate: { gt: new Date() } }],
        Status: { in: ["Active", "Available"] },
        QuantityRemaining: { gt: 0 },
      },
      orderBy: [{ ExpiryDate: "asc" }, { LotId: "asc" }],
    });

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
