import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "All";

    const where: any = {};
    if (status !== "All") {
      where.Status = status;
    }

    const stockIns = await prisma.stockIns.findMany({
      where,
      orderBy: { CreatedAt: "desc" },
      include: {
        StockInLines: {
          include: {
            Items: { include: { Category: true } },
            UnitOfMeasures: true
          }
        },
        GoodsReceipts: {
          include: {
            Deliveries: {
              include: {
                PurchaseOrders: { include: { Suppliers: true } }
              }
            }
          }
        }
      }
    });

    const data = stockIns.map((s: typeof stockIns[number]) => ({
      stockInId: s.StockInId,
      stockInNumber: s.StockInNumber,
      grnId: s.GrnId,
      grnNumber: s.GoodsReceipts?.GrnNumber || "",
      supplierId: s.GoodsReceipts?.Deliveries?.PurchaseOrders?.SupplierId || 0,
      supplierName: s.GoodsReceipts?.Deliveries?.PurchaseOrders?.Suppliers?.CompanyName || "",
      poNumber: s.GoodsReceipts?.Deliveries?.PurchaseOrders?.PoNumber || "",
      status: s.Status === "Pending Approval" ? "PendingApproval" : s.Status,
      createdBy: s.CreatedBy,
      createdAt: s.CreatedAt,
      submittedBy: s.SubmittedBy,
      submittedAt: s.SubmittedAt,
      approvedBy: s.ApprovedBy,
      approvedAt: s.ApprovedAt,
      rejectedBy: s.RejectedBy,
      rejectedAt: s.RejectedAt,
      rejectionReason: s.RejectionReason,
      committedBy: s.CommittedBy,
      committedAt: s.CommittedAt,
      notes: s.Notes,
      lines: s.StockInLines.map((l: typeof s.StockInLines[number]) => ({
        stockInLineId: l.StockInLineId,
        stockInId: l.StockInId,
        grnItemId: l.GrnItemId,
        itemId: l.ItemId,
        itemName: l.Items?.ItemName || "",
        itemCode: l.Items?.ItemCode || "",
        categoryName: l.Items?.Category?.CategoryName || "",
        purchaseUomId: l.PurchaseUomId,
        purchaseUomName: l.UnitOfMeasures?.Abbreviation || "Unit",
        quantityToStock: Number(l.QuantityToStock),
        currentStockBeforeCommit: Number(l.CurrentStockBeforeCommit),
        lotCode: l.LotCode,
        expiryDate: l.ExpiryDate,
        committedToInventory: l.CommittedToInventory,
        inventoryLotId: l.InventoryLotId,
        notes: l.Notes
      }))
    }));

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error("Error fetching StockIns:", error);
    return NextResponse.json({ success: false, message: `An error occurred: ${error.message}` }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (!body.grnId) {
      return NextResponse.json({ success: false, message: "Goods Receipt Note is required." }, { status: 400 });
    }

    if (!body.lines || body.lines.length === 0) {
      return NextResponse.json({ success: false, message: "At least one item line is required." }, { status: 400 });
    }

    const year = new Date().getFullYear();

    // Collision-free StockInNumber sequence calculation
    const latestStockIns = await prisma.stockIns.findMany({
      where: { StockInNumber: { startsWith: `SIN-${year}-` } },
      select: { StockInNumber: true },
    });

    let maxNum = 0;
    latestStockIns.forEach((s) => {
      const match = s.StockInNumber.match(/SIN-\d{4}-(\d+)/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    });

    const currentSeq = await prisma.documentSequences.findUnique({
      where: { DocType_Year: { DocType: "StockIn", Year: year } },
    });

    const nextNumber = Math.max(maxNum, currentSeq?.LastNumber || 0) + 1;

    await prisma.documentSequences.upsert({
      where: { DocType_Year: { DocType: "StockIn", Year: year } },
      update: { LastNumber: nextNumber },
      create: { DocType: "StockIn", Year: year, LastNumber: nextNumber },
    });

    const stockInNumber = `SIN-${year}-${String(nextNumber).padStart(4, "0")}`;
    const initialStatus = body.submitForApproval ? "PendingApproval" : "Draft";

    const newStockIn = await prisma.stockIns.create({
      data: {
        StockInNumber: stockInNumber,
        GrnId: Number(body.grnId),
        Status: initialStatus,
        CreatedBy: "System User",
        CreatedAt: new Date(),
        SubmittedBy: body.submitForApproval ? "System User" : null,
        SubmittedAt: body.submitForApproval ? new Date() : null,
        Notes: body.notes || null,
        StockInLines: {
          create: body.lines.map((l: any) => ({
            GrnItemId: l.grnItemId ? Number(l.grnItemId) : null,
            ItemId: Number(l.itemId),
            PurchaseUomId: l.purchaseUomId ? Number(l.purchaseUomId) : null,
            QuantityToStock: Number(l.quantityToStock),
            CurrentStockBeforeCommit: Number(l.currentStockBeforeCommit || 0),
            LotCode: l.lotCode,
            ExpiryDate: l.expiryDate ? new Date(l.expiryDate) : null,
            CommittedToInventory: false,
            Notes: l.notes || null,
          })),
        },
      },
      include: {
        StockInLines: {
          include: {
            Items: { include: { Category: true } },
            UnitOfMeasures: true,
          },
        },
        GoodsReceipts: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Stock-In report created successfully.",
      data: newStockIn,
    });
  } catch (error: any) {
    console.error("Error creating Stock-In:", error);
    return NextResponse.json({ success: false, message: `An error occurred: ${error.message}` }, { status: 500 });
  }
}

