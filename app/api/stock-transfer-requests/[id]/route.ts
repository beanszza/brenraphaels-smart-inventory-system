import { requireRouteModule } from "@/lib/portal/staff";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const access = await requireRouteModule(_request, "Stock Transfer");
  if (!access.ok) return access.response;

  try {
    const params = await props.params;
    const requestId = parseInt(params.id, 10);
    if (isNaN(requestId)) {
      return NextResponse.json({ success: false, message: "Invalid request ID." }, { status: 400 });
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
      return NextResponse.json({ success: false, message: "Stock transfer request not found." }, { status: 404 });
    }

    const data = {
      requestId: req.RequestId,
      requestNumber: req.RequestNumber,
      toLocationId: req.ToLocationId,
      toLocationName: req.Locations?.LocationName || "",
      requestedBy: req.RequestedBy,
      requestDate: req.RequestDate.toISOString(),
      requiredDate: req.RequiredDate.toISOString(),
      priority: req.Priority,
      reason: req.Reason || "",
      status: req.Status,
      adminNotes: req.AdminNotes || "",
      reviewedBy: req.ReviewedBy || null,
      reviewedAt: req.ReviewedAt?.toISOString() || null,
      createdAt: req.CreatedAt.toISOString(),
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
      transfers: req.StockTransfers.map((st) => ({
        transferId: st.TransferId,
        transferNumber: st.TransferNumber,
        productId: st.ProductId,
        productName: st.FinishedProducts?.Items?.ItemName || "Unknown Product",
        status: st.Status,
        transferQuantity: Number(st.TransferQuantity),
        scheduledDate: st.ScheduledDate?.toISOString() || null,
        dispatchedDate: st.DispatchedDate?.toISOString() || null,
        courierName: st.CourierName || null,
        vehiclePlate: st.VehiclePlate || null,
        driverName: st.DriverName || null,
      })),
    };

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error("Error in GET /api/stock-transfer-requests/[id]:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to fetch stock transfer request" },
      { status: 500 }
    );
  }
}
