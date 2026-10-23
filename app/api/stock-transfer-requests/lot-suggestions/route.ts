import { requireRouteModule } from "@/lib/portal/staff";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const access = await requireRouteModule(request, "Stock Transfer");
  if (!access.ok) return access.response;

  try {
    const { searchParams } = new URL(request.url);
    const productId = parseInt(searchParams.get("productId") || "0", 10);
    const requestedQty = parseFloat(searchParams.get("quantity") || "0");

    if (!productId || productId <= 0) {
      return NextResponse.json(
        { success: false, message: "Valid productId parameter is required." },
        { status: 400 }
      );
    }

    const product = await prisma.finishedProducts.findUnique({
      where: { ProductId: productId },
      include: { Items: true },
    });

    if (!product) {
      return NextResponse.json(
        { success: false, message: "Finished product not found." },
        { status: 404 }
      );
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
      return NextResponse.json(
        { success: false, message: "Commissary location could not be identified." },
        { status: 404 }
      );
    }

    const lots = await prisma.inventoryLots.findMany({
      where: {
        ItemId: product.ItemId,
        Status: { in: ["Active", "Available"] },
        QuantityRemaining: { gt: 0 },
      },
      orderBy: [{ ExpiryDate: "asc" }, { LotId: "asc" }],
    });

    let totalAvailable = 0;
    let remainingToAllocate = Math.max(0, requestedQty);
    const suggestedLots = [];

    for (const lot of lots) {
      const remaining = Number(lot.QuantityRemaining);
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

    return NextResponse.json({
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
  } catch (error: any) {
    console.error("Error in GET /api/stock-transfer-requests/lot-suggestions:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to fetch lot suggestions" },
      { status: 500 }
    );
  }
}
