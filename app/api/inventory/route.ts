import { requireRouteModule } from "@/lib/portal/staff";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const access = await requireRouteModule(request, "Inventory");
  if (!access.ok) return access.response;

  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const pageSize = Math.min(1000, Math.max(1, parseInt(searchParams.get("pageSize") || "10", 10)));
    const categoryName = searchParams.get("categoryName") || "";
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "All";

    const where: any = {};

    const itemsFilter: any = {};

    if (categoryName && categoryName !== "All") {
      itemsFilter.Category = {
        CategoryName: {
          contains: categoryName,
          mode: "insensitive",
        },
      };
    }

    if (status === "Active") {
      itemsFilter.IsActive = true;
    } else if (status === "Inactive") {
      itemsFilter.IsActive = false;
    }

    if (search) {
      itemsFilter.OR = [
        { ItemName: { contains: search, mode: "insensitive" } },
        { ItemCode: { contains: search, mode: "insensitive" } },
      ];
    }

    if (Object.keys(itemsFilter).length > 0) {
      where.Items = itemsFilter;
    }

    const [total, records] = await Promise.all([
      prisma.inventories.count({ where }),
      prisma.inventories.findMany({
        where,
        include: {
          Items: {
            include: {
              Category: true,
              UnitOfMeasures_Items_StockUomIdToUnitOfMeasures: true,
              Uom: true,
            },
          },
          Locations: true,
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { Items: { ItemName: "asc" } },
      }),
    ]);

    const itemIds = records.map((r) => r.ItemId);

    const [lotAggregations, finishedProductRows] = await Promise.all([
      prisma.inventoryLots.groupBy({
        by: ["ItemId"],
        where: {
          ItemId: { in: itemIds },
          Status: { in: ["Available", "Active"] },
        },
        _sum: {
          ReservedQuantity: true,
        },
      }),
      // Fetch finished product variants for all items in the current page along with their lots
      prisma.finishedProducts.findMany({
        where: { ItemId: { in: itemIds } },
        select: {
          ProductId: true,
          ItemId: true,
          Variant: true,
          Sku: true,
          ProductionBatches: {
            select: {
              InventoryLots: {
                select: {
                  QuantityRemaining: true,
                  ReservedQuantity: true,
                  Status: true,
                },
              },
            },
          },
        },
        orderBy: { ProductId: "asc" },
      }),
    ]);

    const reservedMap: Record<number, number> = {};
    for (const agg of lotAggregations) {
      reservedMap[agg.ItemId] = Number(agg._sum.ReservedQuantity || 0);
    }

    // Map itemId -> list of variants with accurate variant stock
    const variantsMap: Record<
      number,
      Array<{ productId: number; variant: string; sku: string; currentStock: number; reservedStock: number }>
    > = {};
    for (const fp of finishedProductRows) {
      if (!variantsMap[fp.ItemId]) variantsMap[fp.ItemId] = [];
      let variantStock = 0;
      let variantReserved = 0;
      fp.ProductionBatches?.forEach((batch) => {
        const lot = batch.InventoryLots;
        if (lot && (lot.Status === "Available" || lot.Status === "Active")) {
          variantStock += Number(lot.QuantityRemaining || 0);
          variantReserved += Number(lot.ReservedQuantity || 0);
        }
      });

      variantsMap[fp.ItemId].push({
        productId: fp.ProductId,
        variant: fp.Variant || "",
        sku: fp.Sku || "",
        currentStock: variantStock,
        reservedStock: variantReserved,
      });
    }

    const data = records.map((inv) => {
      const item = inv.Items;
      const location = inv.Locations;
      const uom = item.UnitOfMeasures_Items_StockUomIdToUnitOfMeasures ?? item.Uom;
      const currentStock = Number(inv.CurrentStock);
      const reservedStock = reservedMap[item.ItemId] || 0;
      const availableStock = Math.max(0, currentStock - reservedStock);
      const minStock = Number(item.MinStockLevel);
      const maxStock = Number(item.MaxStockLevel);

      return {
        inventoryId: inv.InventoryId,
        itemId: item.ItemId,
        itemCode: item.ItemCode,
        itemName: item.ItemName,
        categoryId: item.CategoryId,
        categoryName: item.Category?.CategoryName ?? "",
        locationId: inv.LocationId,
        locationName: location?.LocationName ?? "",
        currentStock,
        reservedStock,
        availableStock,
        minStockLevel: minStock,
        maxStockLevel: maxStock,
        uomId: uom?.UomId ?? item.StockUomId,
        uomName: uom?.Name ?? uom?.Abbreviation ?? "",
        uomAbbreviation: uom?.Abbreviation ?? "",
        isLowStock: currentStock <= minStock,
        isOverStock: maxStock > 0 && currentStock > maxStock,
        isLotTracked: item.IsLotTracked,
        isExpiryTracked: item.IsExpiryTracked,
        isActive: item.IsActive,
        // Populated for finished goods only; empty array for raw materials / ingredients
        finishedProductVariants: variantsMap[item.ItemId] ?? [],
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        items: data,
        totalCount: total,
        totalPages: Math.ceil(total / pageSize),
        page,
        pageSize,
      },
    });
  } catch (error: any) {
    console.error("GET /api/inventory error:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
