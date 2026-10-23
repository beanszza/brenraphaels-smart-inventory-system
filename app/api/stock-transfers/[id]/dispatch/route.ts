import { requireRouteModule } from "@/lib/portal/staff";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const access = await requireRouteModule(request, "Stock Transfer");
  if (!access.ok) return access.response;

  try {
    const params = await props.params;
    const userRole = request.headers.get("x-user-role")?.toLowerCase();
    if (userRole === "admin") {
      return NextResponse.json(
        { success: false, message: "Admins are not permitted to dispatch stock transfers." },
        { status: 403 }
      );
    }

    const transferId = parseInt(params.id, 10);
    if (isNaN(transferId)) {
      return NextResponse.json({ success: false, message: "Invalid transfer ID." }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const { driverName, vehiclePlate, courierName, notes } = body;

    const transfer = await prisma.stockTransfers.findUnique({
      where: { TransferId: transferId },
      include: {
        FinishedProducts: true,
      },
    });

    if (!transfer) {
      return NextResponse.json({ success: false, message: "Stock transfer not found." }, { status: 404 });
    }

    if (transfer.Status !== "Scheduled") {
      return NextResponse.json(
        {
          success: false,
          message: `Cannot dispatch transfer in '${transfer.Status}' status. Only 'Scheduled' transfers can be dispatched.`,
        },
        { status: 400 }
      );
    }

    const transferQty = Number(transfer.TransferQuantity);
    const itemId = transfer.FinishedProducts.ItemId;
    const sourceLocId = transfer.SourceLocationId;

    // Execute atomic transaction for inventory deduction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Fetch active commissary lots sorted FEFO
      const lots = await tx.inventoryLots.findMany({
        where: {
          ItemId: itemId,
          Status: { in: ["Active", "Available"] },
          QuantityRemaining: { gt: 0 },
        },
        orderBy: [{ ExpiryDate: "asc" }, { LotId: "asc" }],
      });

      let remainingToDeduct = transferQty;
      const lotDeductions: Array<{ lotId: number; deducted: number }> = [];

      for (const lot of lots) {
        if (remainingToDeduct <= 0) break;

        const currentRem = Number(lot.QuantityRemaining);
        const toDeduct = Math.min(currentRem, remainingToDeduct);

        await tx.inventoryLots.update({
          where: { LotId: lot.LotId },
          data: {
            QuantityRemaining: { decrement: toDeduct },
            Status: currentRem - toDeduct <= 0 ? "Depleted" : "Active",
          },
        });

        lotDeductions.push({ lotId: lot.LotId, deducted: toDeduct });
        remainingToDeduct -= toDeduct;
      }

      if (remainingToDeduct > 0.001) {
        throw new Error(
          `Insufficient commissary stock to dispatch ${transferQty} units. Shortage of ${remainingToDeduct.toFixed(2)} units.`
        );
      }

      // 2. Update Inventories table for Commissary location
      const inventory = await tx.inventories.findUnique({
        where: {
          ItemId_LocationId: {
            ItemId: itemId,
            LocationId: sourceLocId,
          },
        },
      });

      if (inventory) {
        await tx.inventories.update({
          where: {
            ItemId_LocationId: {
              ItemId: itemId,
              LocationId: sourceLocId,
            },
          },
          data: {
            CurrentStock: { decrement: transferQty },
          },
        });
      }

      // 3. Mark transfer as Dispatched
      const updatedTransfer = await tx.stockTransfers.update({
        where: { TransferId: transferId },
        data: {
          Status: "Dispatched",
          DispatchedDate: new Date(),
          DriverName: driverName || transfer.DriverName,
          VehiclePlate: vehiclePlate || transfer.VehiclePlate,
          CourierName: courierName || transfer.CourierName,
          Notes: notes ? (transfer.Notes ? `${transfer.Notes} | ${notes}` : notes) : transfer.Notes,
        },
      });

      // 4. Update parent STR if present
      if (transfer.RequestId) {
        const remainingScheduled = await tx.stockTransfers.count({
          where: {
            RequestId: transfer.RequestId,
            Status: { in: ["Pending", "Scheduled"] },
            TransferId: { not: transferId },
          },
        });

        if (remainingScheduled === 0) {
          await tx.stockTransferRequests.update({
            where: { RequestId: transfer.RequestId },
            data: { Status: "Dispatched" },
          });
        }
      }

      return { updatedTransfer, lotDeductions };
    });

    return NextResponse.json({
      success: true,
      message: "Transfer dispatched successfully and commissary stock deducted.",
      data: {
        transferId: result.updatedTransfer.TransferId,
        transferNumber: result.updatedTransfer.TransferNumber,
        status: result.updatedTransfer.Status,
        dispatchedDate: result.updatedTransfer.DispatchedDate?.toISOString(),
        lotDeductions: result.lotDeductions,
      },
    });
  } catch (error: any) {
    console.error("Error in PUT /api/stock-transfers/[id]/dispatch:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to dispatch stock transfer" },
      { status: 500 }
    );
  }
}
