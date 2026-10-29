"use server";
/* eslint-disable @typescript-eslint/no-explicit-any -- Retain existing transfer DTOs during migration. */
import { requireModule } from "@/lib/portal/staff";
import { resourceResult } from "@/lib/resources/result";
import { mutate, refuse, positiveId, validateInput, saved } from "@/lib/stock-transfer/operations";
import { dispatchTransferManifestToPos } from "@/lib/pos/client";
export async function dispatchTransfer(idInput: number, body: any = {}) {
  const staff = await requireModule("Stock Transfer");
  return mutate(staff, async (tx) => {
validateInput(body);
    const transferId = positiveId(idInput);
    if (isNaN(transferId)) {
      return refuse("Invalid transfer ID.");
    }
    const { driverName, vehiclePlate, courierName, notes } = body;

    const transfer = await tx.stockTransfers.findUnique({
      where: { TransferId: transferId },
      include: {
        FinishedProducts: { include: { Items: true } },
        Locations_StockTransfers_SourceLocationIdToLocations: true,
        Locations_StockTransfers_DestLocationIdToLocations: true,
      },
    });

    if (!transfer) {
      return refuse("Stock transfer not found.");
    }

    if (transfer.Status !== "Scheduled") {
      return refuse(`Cannot dispatch transfer in '${transfer.Status}' status. Only 'Scheduled' transfers can be dispatched.`);
    }

    const transferQty = Number(transfer.TransferQuantity);
    if (!Number.isFinite(transferQty) || transferQty <= 0) refuse("Invalid transfer quantity.");
    const itemId = transfer.FinishedProducts.ItemId;
    const sourceLocId = transfer.SourceLocationId;

    // Execute atomic transaction for inventory deduction
    const result = await (async () => {
      // 1. Fetch active commissary lots sorted FEFO
      const lots = await tx.inventoryLots.findMany({
        where: {
          ItemId: itemId,
          LocationId: sourceLocId,
          OR: [{ ExpiryDate: null }, { ExpiryDate: { gt: new Date() } }],
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
        const available = Math.max(0, currentRem - Number(lot.ReservedQuantity || 0));
        const toDeduct = Math.min(available, remainingToDeduct);
        if (toDeduct <= 0) continue;

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
        refuse(
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

      if (!inventory || Number(inventory.CurrentStock) < transferQty) refuse("Insufficient source inventory.");
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
    })();

    // Post transfer manifest to POS (SCMS ➔ POS)
    dispatchTransferManifestToPos({
      transferId: transfer.TransferNumber || `TRANS-${transfer.TransferId}`,
      sourceLocation: {
        locationId: String(transfer.SourceLocationId),
        locationName:
          transfer.Locations_StockTransfers_SourceLocationIdToLocations?.LocationName ||
          "Commissary Warehouse",
      },
      destinationLocation: {
        branchId: String(transfer.DestLocationId),
        branchName:
          transfer.Locations_StockTransfers_DestLocationIdToLocations?.LocationName ||
          "Store Branch",
      },
      transferDate: new Date().toISOString(),
      status: "In Transit",
      products: [
        {
          productId: transfer.FinishedProducts?.Items?.ItemCode || `SCM-PRD-${transfer.ProductId}`,
          sku: transfer.FinishedProducts?.Sku || `SKU-${transfer.ProductId}`,
          productName: transfer.FinishedProducts?.Items?.ItemName || "Finished Product",
          quantity: transferQty,
        },
      ],
    }).catch((err) => {
      console.warn("[POS-TRANSFER-DISPATCH-WARN]", err?.message);
    });

    return saved(staff, "stock-transfer", transfer.TransferId, transfer.TransferNumber || String(transfer.TransferId), "updated", resourceResult({
      success: true,
      message: "Transfer dispatched successfully and commissary stock deducted.",
      data: {
        transferId: result.updatedTransfer.TransferId,
        transferNumber: result.updatedTransfer.TransferNumber,
        status: result.updatedTransfer.Status,
        dispatchedDate: result.updatedTransfer.DispatchedDate?.toISOString(),
        lotDeductions: result.lotDeductions,
      },
    }));

  });
}
