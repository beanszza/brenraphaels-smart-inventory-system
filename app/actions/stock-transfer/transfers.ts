"use server";
/* eslint-disable @typescript-eslint/no-explicit-any -- Retain existing transfer DTOs during migration. */
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/portal/staff";
import { resourceResult } from "@/lib/resources/result";
import { read, mutate, refuse, validateInput, saved } from "@/lib/stock-transfer/operations";
const TRANSFER_INCLUDE = {
  FinishedProducts: { include: { Items: true } },
  Locations_StockTransfers_SourceLocationIdToLocations: true,
  Locations_StockTransfers_DestLocationIdToLocations: true,
  StockTransferRequests: true,
};

function mapTransfer(t: any) {
  return {
    transferId: t.TransferId,
    transferNumber: t.TransferNumber,
    requestId: t.RequestId ?? null,
    requestNumber: t.StockTransferRequests?.RequestNumber ?? null,
    productId: t.ProductId,
    productName: t.FinishedProducts?.Items?.ItemName ?? "Unknown Product",
    variant: t.FinishedProducts?.Variant ?? "",
    sku: t.FinishedProducts?.Sku ?? "",
    sourceLocationId: t.SourceLocationId,
    sourceLocationName: t.Locations_StockTransfers_SourceLocationIdToLocations?.LocationName ?? "Commissary",
    destLocationId: t.DestLocationId,
    destLocationName: t.Locations_StockTransfers_DestLocationIdToLocations?.LocationName ?? "",
    transferQuantity: Number(t.TransferQuantity),
    status: t.Status,
    scheduledDate: t.ScheduledDate?.toISOString() ?? null,
    transferDate: t.TransferDate?.toISOString() ?? null,
    dispatchedDate: t.DispatchedDate?.toISOString() ?? null,
    receivedDate: t.ReceivedDate?.toISOString() ?? null,
    driverName: t.DriverName ?? "",
    vehiclePlate: t.VehiclePlate ?? "",
    courierName: t.CourierName ?? "",
    proofOfReceipt: t.ProofOfReceipt ?? "",
    priority: t.Priority ?? "Normal",
    notes: t.Notes ?? "",
    receivedBy: t.ReceivedBy ?? "",
    createdAt: t.CreatedAt?.toISOString() ?? t.TransferDate?.toISOString() ?? null,
  };
}

export async function listTransfers(query = "") {
  await requireModule("Stock Transfer");
  return read(async () => {

    const searchParams = new URLSearchParams(query);
    const page = Math.max(1, (parseInt(searchParams.get("page") || "1", 10) || 1));
    const pageSize = Math.min(100, Math.max(1, (parseInt(searchParams.get("pageSize") || "10", 10) || 10)));
    const status = searchParams.get("status")?.trim() || "";
    const search = searchParams.get("search")?.trim() || "";

    const where: any = {};

    if (status && status !== "All") {
      where.Status = status;
    }

    if (search) {
      where.OR = [
        { TransferNumber: { contains: search, mode: "insensitive" } },
        { DriverName: { contains: search, mode: "insensitive" } },
        { VehiclePlate: { contains: search, mode: "insensitive" } },
        { CourierName: { contains: search, mode: "insensitive" } },
        {
          FinishedProducts: {
            Items: {
              ItemName: { contains: search, mode: "insensitive" },
            },
          },
        },
        {
          Locations_StockTransfers_DestLocationIdToLocations: {
            LocationName: { contains: search, mode: "insensitive" },
          },
        },
        {
          StockTransferRequests: {
            RequestNumber: { contains: search, mode: "insensitive" },
          },
        },
      ];
    }

    const [total, transfers] = await Promise.all([
      prisma.stockTransfers.count({ where }),
      prisma.stockTransfers.findMany({
        where,
        include: TRANSFER_INCLUDE,
        orderBy: { TransferId: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return resourceResult({
      success: true,
      data: transfers.map(mapTransfer),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });

  });
}
export async function scheduleTransfer(body: any = {}) {
  const staff = await requireModule("Stock Transfer");
  return mutate(staff, async (tx) => {
validateInput(body);
    const {
      requestId,
      productId,
      transferQuantity,
      scheduledDate,
      driverName,
      vehiclePlate,
      courierName,
      notes,
    } = body;

    if (!requestId || !productId || !transferQuantity || !scheduledDate) {
      return refuse("Request ID, Product, Quantity, and Scheduled Date are required.");
    }

    const str = await tx.stockTransferRequests.findUnique({
      where: { RequestId: Number(requestId) },
      include: {
        StockTransferRequestItems: true,
      },
    });

    if (!str) {
      return refuse("Stock Transfer Request not found.");
    }

    if (str.Status !== "Approved") {
      return refuse(`Only Approved requests can be scheduled. Current request status is '${str.Status}'.`);
    }

    const requested = str.StockTransferRequestItems.filter(item => item.ProductId === Number(productId));
    if (!requested.length) refuse("The product is not part of this request.");
    const scheduled = await tx.stockTransfers.aggregate({
      where: { RequestId: str.RequestId, ProductId: Number(productId), Status: { not: "Cancelled" } },
      _sum: { TransferQuantity: true },
    });
    const limit = requested.reduce((sum, item) => sum + Number(item.RequestedQuantity), 0);
    if (Number(scheduled._sum.TransferQuantity || 0) + Number(transferQuantity) > limit) refuse("The quantity exceeds the unscheduled request quantity.");

    // Identify Commissary source location
    const commissary = await tx.locations.findFirst({
      where: {
        OR: [
          { IsSystemLocation: true }, { LocationName: { contains: "Factory", mode: "insensitive" } },
          { LocationType: { contains: "Commissary", mode: "insensitive" } },
          { LocationName: { contains: "Commissary", mode: "insensitive" } },
        ],
      },
    });

    if (!commissary) {
      return refuse("Commissary source location not found.");
    }

    // Generate formal Transfer Number: STF-YYYY-XXXX
    const year = new Date().getFullYear();
    const seq = await tx.documentSequences.upsert({
      where: { DocType_Year: { DocType: "StockTransfer", Year: year } },
      update: { LastNumber: { increment: 1 } },
      create: { DocType: "StockTransfer", Year: year, LastNumber: 1 },
    });
    const transferNumber = `STF-${year}-${String(seq.LastNumber).padStart(4, "0")}`;

    const transfer = await tx.stockTransfers.create({
      data: {
        TransferNumber: transferNumber,
        RequestId: str.RequestId,
        ProductId: Number(productId),
        SourceLocationId: commissary.LocationId,
        DestLocationId: str.ToLocationId,
        TransferQuantity: Number(transferQuantity),
        Status: "Scheduled",
        ScheduledDate: new Date(scheduledDate),
        TransferDate: new Date(),
        DriverName: driverName || null,
        VehiclePlate: vehiclePlate || null,
        CourierName: courierName || null,
        Priority: str.Priority,
        Notes: notes || null,
        CreatedBy: staff.username,
      },
      include: TRANSFER_INCLUDE,
    });

    return saved(staff, "stock-transfer", transfer.TransferId, transfer.TransferNumber || String(transfer.TransferId), "created", resourceResult({
        success: true,
        message: "Stock transfer scheduled successfully.",
        data: mapTransfer(transfer),
      }));

  });
}
