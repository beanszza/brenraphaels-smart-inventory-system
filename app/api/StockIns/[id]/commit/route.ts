import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const id = parseInt(params.id, 10);
    const body = await request.json().catch(() => ({}));

    const stockIn = await prisma.stockIns.findUnique({
      where: { StockInId: id },
      include: {
        StockInLines: true,
      },
    });

    if (!stockIn) {
      return NextResponse.json({ success: false, message: `Stock-In ${id} not found.` }, { status: 404 });
    }

    if (stockIn.Status !== "Approved") {
      return NextResponse.json({ success: false, message: `Only Stock-Ins in Approved status can be committed. Current status: ${stockIn.Status}.` }, { status: 400 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      // 1. Advance Stock-In status
      const result = await tx.stockIns.update({
        where: { StockInId: id },
        data: {
          Status: "Committed",
          CommittedBy: body.committerName || "System User",
          CommittedAt: new Date(),
          Notes: body.notes ? (stockIn.Notes ? `${stockIn.Notes}\nCommit Note: ${body.notes}` : `Commit Note: ${body.notes}`) : stockIn.Notes,
        },
      });

      // 2. Identify default warehouse location
      const defaultLocation = await tx.locations.findFirst({
        where: {
          OR: [
            { LocationType: "Warehouse" },
            { IsSystemLocation: true, LocationName: { contains: "Warehouse", mode: "insensitive" } },
            { LocationId: 5 },
          ],
        },
      });
      const targetLocationId = defaultLocation ? defaultLocation.LocationId : 5;

      // 3. Process stock-in lines into Inventories and InventoryLots
      for (const line of stockIn.StockInLines) {
        // Upsert inventory on hand
        await tx.inventories.upsert({
          where: {
            ItemId_LocationId: {
              ItemId: line.ItemId,
              LocationId: targetLocationId,
            },
          },
          update: {
            CurrentStock: {
              increment: line.QuantityToStock,
            },
          },
          create: {
            ItemId: line.ItemId,
            LocationId: targetLocationId,
            CurrentStock: line.QuantityToStock,
          },
        });

        // Find or create InventoryLots record
        let lot = await tx.inventoryLots.findFirst({
          where: { LotCode: line.LotCode, ItemId: line.ItemId },
        });

        if (!lot) {
          lot = await tx.inventoryLots.create({
            data: {
              LotCode: line.LotCode,
              ItemId: line.ItemId,
              LocationId: targetLocationId,
              SourceType: "GoodsReceipt",
              GrnLineId: line.GrnItemId,
              ReceivedDate: stockIn.CreatedAt,
              ExpiryDate: line.ExpiryDate,
              IsExpiryEstimated: false,
              QuantityReceived: line.QuantityToStock,
              QuantityRemaining: line.QuantityToStock,
              ReservedQuantity: 0,
              UomId: line.PurchaseUomId || 1,
              UnitCost: 0,
              Status: "Available",
              IsOpeningBalance: false,
            },
          });
        } else {
          await tx.inventoryLots.update({
            where: { LotId: lot.LotId },
            data: {
              QuantityRemaining: {
                increment: line.QuantityToStock,
              },
            },
          });
        }

        // Mark line as committed and link lot
        await tx.stockInLines.update({
          where: { StockInLineId: line.StockInLineId },
          data: {
            CommittedToInventory: true,
            InventoryLotId: lot.LotId,
          },
        });
      }

      // 4. Advance GoodsReceipt to FullyPutAway
      if (stockIn.GrnId) {
        await tx.goodsReceipts.update({
          where: { GrnId: stockIn.GrnId },
          data: { Status: "FullyPutAway" },
        });
      }

      return result;
    });

    return NextResponse.json({ success: true, data: updated, message: "Stock-In committed to inventory successfully." });
  } catch (error: any) {
    console.error("Error committing Stock-In:", error);
    return NextResponse.json({ success: false, message: `An error occurred: ${error.message}` }, { status: 500 });
  }
}

