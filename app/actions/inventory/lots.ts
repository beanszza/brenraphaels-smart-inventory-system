"use server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/portal/staff";
import { resourceResult } from "@/lib/resources/result";
import { read, pageNumber, positiveId } from "@/lib/inventory/mutate";
import { ensureInitialInventoryStock } from "@/lib/inventory/initial-stock";

export async function listLots(query = "") {
  await requireModule("Inventory");
  await ensureInitialInventoryStock();
  return read(async () => {
    const searchParams = new URLSearchParams(query);
    const page = pageNumber(searchParams.get("page"), 1, 1000000);
    const pageSize = pageNumber(searchParams.get("pageSize"), 10, 500);
    const status = searchParams.get("status") || "";
    const search = searchParams.get("search") || "";
    const itemId = searchParams.get("itemId") ? positiveId(searchParams.get("itemId")!) : null;

    const where: Prisma.InventoryLotsWhereInput = {};

    if (status) {
      if (status === "Reserved") {
        where.ReservedQuantity = { gt: 0 };
      } else {
        where.Status = status;
      }
    }

    if (itemId) {
      where.ItemId = itemId;
    }

    if (search) {
      where.OR = [
        { LotCode: { contains: search, mode: "insensitive" } },
        { Items: { ItemName: { contains: search, mode: "insensitive" } } },
      ];
    }

    const [total, lots] = await Promise.all([
      prisma.inventoryLots.count({ where }),
      prisma.inventoryLots.findMany({
        where,
        include: {
          Items: {
            include: {
              Category: true,
              UnitOfMeasures_Items_StockUomIdToUnitOfMeasures: true,
            },
          },
          Locations: true,
          Suppliers: true,
          UnitOfMeasures: true,
          ProductionReqLotReservations: {
            where: { IsReleased: false },
            include: {
              ProductionRequests: {
                select: { ReqNumber: true, Status: true },
              },
            },
          },
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: [{ ExpiryDate: "asc" }, { LotId: "asc" }],
      }),
    ]);

    const now = new Date();
    const data = lots.map((lot) => {
      const item = lot.Items;
      const uom = lot.UnitOfMeasures ?? item.UnitOfMeasures_Items_StockUomIdToUnitOfMeasures;
      const expiryDate = lot.ExpiryDate ? lot.ExpiryDate.toISOString().split("T")[0] : null;
      const daysToExpiry = expiryDate
        ? Math.ceil((new Date(expiryDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        : null;

      const remaining = Number(lot.QuantityRemaining);
      const reserved = Number(lot.ReservedQuantity || 0);
      const available = Math.max(0, remaining - reserved);
      const reservations = (lot.ProductionReqLotReservations || []).map((r) => ({
        reservationId: r.ReservationId,
        reqNumber: r.ProductionRequests?.ReqNumber || "",
        reservedQuantity: Number(r.ReservedQuantity),
        status: r.ProductionRequests?.Status || "",
      }));

      return {
        lotId: lot.LotId,
        lotCode: lot.LotCode,
        itemId: lot.ItemId,
        itemName: item?.ItemName ?? "",
        itemCode: item?.ItemCode ?? "",
        categoryName: item?.Category?.CategoryName ?? "",
        locationId: lot.LocationId,
        locationName: lot.Locations?.LocationName ?? "",
        supplierId: lot.SupplierId ?? null,
        supplierName: lot.Suppliers?.CompanyName ?? "",
        supplierLotNo: lot.SupplierLotNo ?? "",
        sourceType: lot.SourceType,
        quantityReceived: Number(lot.QuantityReceived),
        quantityRemaining: remaining,
        reservedQuantity: reserved,
        availableQuantity: available,
        reservations,
        uomId: uom?.UomId ?? null,
        uomAbbreviation: uom?.Abbreviation ?? "",
        unitCost: Number(lot.UnitCost),
        status: lot.Status,
        holdReason: lot.HoldReason ?? "",
        receivedDate: lot.ReceivedDate.toISOString(),
        manufactureDate: lot.ManufactureDate?.toISOString().split("T")[0] ?? null,
        expiryDate,
        isExpiryEstimated: lot.IsExpiryEstimated,
        daysToExpiry,
        isExpiringSoon: daysToExpiry !== null && daysToExpiry <= 30 && daysToExpiry >= 0,
        isExpired: daysToExpiry !== null && daysToExpiry < 0,
        isOpeningBalance: lot.IsOpeningBalance,
        grnLineId: lot.GrnLineId ?? null,
      };
    });

    return resourceResult({
      success: true,
      data: {
        items: data,
        totalCount: total,
        totalPages: Math.ceil(total / pageSize),
        page,
        pageSize,
      },
    });
  });
}
