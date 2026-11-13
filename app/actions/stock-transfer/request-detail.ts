"use server";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/portal/staff";
import { resourceResult } from "@/lib/resources/result";
import { read, refuse, positiveId, safeIsoDate } from "@/lib/stock-transfer/operations";
import { resolveStaffName } from "@/lib/orders/dto";
export async function getRequest(idInput: number) {
  await requireModule("Stock Transfer");
  return read(async () => {

    const requestId = positiveId(idInput);
    if (isNaN(requestId)) {
      return refuse("Invalid request ID.");
    }

    const req = await prisma.stockTransferRequests.findUnique({
      where: { RequestId: requestId },
      include: {
        Locations: true,
        StockTransferRequestItems: {
          include: {
            FinishedProducts: {
              include: { Items: true },
            },
          },
        },
        StockTransfers: {
          include: {
            FinishedProducts: {
              include: { Items: true },
            },
          },
        },
      },
    });

    if (!req) {
      return refuse("Stock transfer request not found.");
    }

    const knownStaffList = await prisma.knownStaff
      .findMany({ select: { StaffId: true, Username: true, Name: true } })
      .catch(() => []);
    const nameMap = new Map<string, string>();
    for (const s of knownStaffList) {
      if (s.StaffId && s.Name) nameMap.set(s.StaffId.trim(), s.Name.trim());
      if (s.Username && s.Name) nameMap.set(s.Username.trim(), s.Name.trim());
    }
    const resolveName = (u: string | null | undefined): string => {
      if (!u) return "";
      const t = u.trim();
      return nameMap.get(t) || resolveStaffName(t) || t;
    };

    const data = {
      requestId: req.RequestId,
      requestNumber: req.RequestNumber,
      toLocationId: req.ToLocationId,
      toLocationName: req.Locations?.LocationName || "",
      requestedBy: resolveName(req.RequestedBy),
      requestDate: safeIsoDate(req.RequestDate) || new Date().toISOString(),
      requiredDate: safeIsoDate(req.RequiredDate) || new Date().toISOString(),
      priority: req.Priority,
      reason: req.Reason || "",
      status: req.Status,
      adminNotes: req.AdminNotes || "",
      reviewedBy: req.ReviewedBy ? resolveName(req.ReviewedBy) : null,
      reviewedAt: safeIsoDate(req.ReviewedAt),
      createdAt: safeIsoDate(req.CreatedAt) || new Date().toISOString(),
      items: req.StockTransferRequestItems.map((item) => ({
        requestItemId: item.RequestItemId,
        productId: item.ProductId,
        productName: item.FinishedProducts?.Items?.ItemName || "Unknown Product",
        variant: item.FinishedProducts?.Variant || "",
        sku: item.FinishedProducts?.Sku || "",
        requestedQuantity: Number(item.RequestedQuantity),
        availableQuantity: Number(item.AvailableQuantity),
        isInsufficient: item.IsInsufficient,
        suggestedLots: item.SuggestedLots,
        notes: item.Notes || "",
      })),
      transfers: (req.StockTransfers || []).map((st) => ({
        transferId: st.TransferId,
        transferNumber: st.TransferNumber || "",
        productId: st.ProductId,
        productName: st.FinishedProducts?.Items?.ItemName || "Unknown Product",
        status: st.Status,
        transferQuantity: Number(st.TransferQuantity || 0),
        scheduledDate: safeIsoDate(st.ScheduledDate),
        dispatchedDate: safeIsoDate(st.DispatchedDate),
        courierName: st.CourierName || null,
        vehiclePlate: st.VehiclePlate || null,
        driverName: st.DriverName || null,
      })),
    };

    return resourceResult({ success: true, data });

  });
}
