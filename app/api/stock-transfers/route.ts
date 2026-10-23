import { requireRouteModule } from "@/lib/portal/staff";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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

export async function GET(request: NextRequest) {
  const access = await requireRouteModule(request, "Stock Transfer");
  if (!access.ok) return access.response;

  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") || "10", 10)));
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

    return NextResponse.json({
      success: true,
      data: transfers.map(mapTransfer),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error: any) {
    console.error("Error in GET /api/stock-transfers:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to fetch stock transfers" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const access = await requireRouteModule(request, "Stock Transfer");
  if (!access.ok) return access.response;

  try {
    const userRole = request.headers.get("x-user-role")?.toLowerCase();
    if (userRole === "admin") {
      return NextResponse.json(
        { success: false, message: "Admins are not permitted to schedule stock transfers." },
        { status: 403 }
      );
    }

    const body = await request.json();
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
      return NextResponse.json(
        { success: false, message: "Request ID, Product, Quantity, and Scheduled Date are required." },
        { status: 400 }
      );
    }

    const str = await prisma.stockTransferRequests.findUnique({
      where: { RequestId: Number(requestId) },
      include: {
        StockTransferRequestItems: true,
      },
    });

    if (!str) {
      return NextResponse.json(
        { success: false, message: "Stock Transfer Request not found." },
        { status: 404 }
      );
    }

    if (str.Status !== "Approved") {
      return NextResponse.json(
        {
          success: false,
          message: `Only Approved requests can be scheduled. Current request status is '${str.Status}'.`,
        },
        { status: 400 }
      );
    }

    // Identify Commissary source location
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
        { success: false, message: "Commissary source location not found." },
        { status: 400 }
      );
    }

    // Generate formal Transfer Number: STF-YYYY-XXXX
    const year = new Date().getFullYear();
    const seq = await prisma.documentSequences.upsert({
      where: { DocType_Year: { DocType: "StockTransfer", Year: year } },
      update: { LastNumber: { increment: 1 } },
      create: { DocType: "StockTransfer", Year: year, LastNumber: 1 },
    });
    const transferNumber = `STF-${year}-${String(seq.LastNumber).padStart(4, "0")}`;

    const transfer = await prisma.stockTransfers.create({
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
        CreatedBy: access.staff.username,
      },
      include: TRANSFER_INCLUDE,
    });

    return NextResponse.json(
      {
        success: true,
        message: "Stock transfer scheduled successfully.",
        data: mapTransfer(transfer),
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Error in POST /api/stock-transfers:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to schedule stock transfer" },
      { status: 500 }
    );
  }
}
