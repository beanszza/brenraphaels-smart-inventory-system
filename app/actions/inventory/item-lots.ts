"use server";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/portal/staff";
import { resourceResult } from "@/lib/resources/result";
import { read, positiveId } from "@/lib/inventory/mutate";

export async function listItemLots(itemIdInput: number, productIdInput?: number) {
  await requireModule("Inventory");
  return read(async () => {
    const itemId = positiveId(itemIdInput);
    const productId = productIdInput ? positiveId(productIdInput) : undefined;

    const whereClause: any = {
      ItemId: itemId,
      Status: { in: ["Available", "Active"] },
      QuantityRemaining: { gt: 0 },
    };

    if (productId) {
      whereClause.ProductionBatches = {
        some: {
          ProductId: productId,
        },
      };
    }

    const lots = await prisma.inventoryLots.findMany({
      where: whereClause,
      include: {
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
      orderBy: [{ ExpiryDate: "asc" }, { LotId: "asc" }],
    });

    const now = new Date();
    const data = lots.map((lot) => {
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
        locationId: lot.LocationId,
        locationName: lot.Locations?.LocationName ?? "",
        supplierId: lot.SupplierId ?? null,
        supplierName: lot.Suppliers?.CompanyName ?? "",
        supplierLotNo: lot.SupplierLotNo ?? "",
        quantityReceived: Number(lot.QuantityReceived),
        quantityRemaining: remaining,
        reservedQuantity: reserved,
        availableQuantity: available,
        reservations,
        uomAbbreviation: lot.UnitOfMeasures?.Abbreviation ?? "",
        unitCost: Number(lot.UnitCost),
        status: lot.Status,
        receivedDate: lot.ReceivedDate.toISOString(),
        expiryDate,
        daysToExpiry,
        isExpiringSoon: daysToExpiry !== null && daysToExpiry <= 30 && daysToExpiry >= 0,
      };
    });

    return resourceResult({ success: true, data });
  });
}
