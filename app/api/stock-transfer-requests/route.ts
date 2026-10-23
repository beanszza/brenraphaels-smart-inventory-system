import { requireRouteModule } from "@/lib/portal/staff";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const access = await requireRouteModule(request, "Stock Transfer");
  if (!access.ok) return access.response;

  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim() || "";
    const status = searchParams.get("status")?.trim() || "";
    const priority = searchParams.get("priority")?.trim() || "";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") || "10", 10)));

    const where: any = {};

    if (status && status !== "All") {
      where.Status = status;
    }

    if (priority && priority !== "All") {
      where.Priority = priority;
    }

    if (search) {
      where.OR = [
        { RequestNumber: { contains: search, mode: "insensitive" } },
        { RequestedBy: { contains: search, mode: "insensitive" } },
        { Reason: { contains: search, mode: "insensitive" } },
        { Locations: { LocationName: { contains: search, mode: "insensitive" } } },
      ];
    }

    const [total, requests] = await Promise.all([
      prisma.stockTransferRequests.count({ where }),
      prisma.stockTransferRequests.findMany({
        where,
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
            select: {
              TransferId: true,
              TransferNumber: true,
              Status: true,
              TransferQuantity: true,
              ScheduledDate: true,
              DispatchedDate: true,
              DriverName: true,
              VehiclePlate: true,
              CourierName: true,
            },
          },
        },
        orderBy: { CreatedAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    const data = requests.map((req) => ({
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
        status: st.Status,
        transferQuantity: Number(st.TransferQuantity),
        scheduledDate: st.ScheduledDate?.toISOString() || null,
        dispatchedDate: st.DispatchedDate?.toISOString() || null,
        driverName: st.DriverName || null,
        vehiclePlate: st.VehiclePlate || null,
        courierName: st.CourierName || null,
      })),
    }));

    return NextResponse.json({
      success: true,
      data,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error: any) {
    console.error("Error in GET /api/stock-transfer-requests:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to fetch stock transfer requests" },
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
        { success: false, message: "Admins are not permitted to create stock transfer requests." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { toLocationId, requiredDate, priority = "Normal", reason, requestedBy = "Inventory Manager", items } = body;

    if (!toLocationId || !items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { success: false, message: "Destination location and at least one item are required." },
        { status: 400 }
      );
    }

    if (!requiredDate) {
      return NextResponse.json(
        { success: false, message: "Required Date is required." },
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

    const commissaryId = commissary?.LocationId;

    // Process items and check availability + FEFO lots
    const preparedItems = await Promise.all(
      items.map(async (itm: { productId: number; requestedQuantity: number; notes?: string }) => {
        const qty = Number(itm.requestedQuantity);
        if (isNaN(qty) || qty <= 0) {
          throw new Error("Item quantity must be greater than zero.");
        }

        const product = await prisma.finishedProducts.findUnique({
          where: { ProductId: itm.productId },
          include: { Items: true },
        });

        if (!product) {
          throw new Error(`Finished product with ID ${itm.productId} not found.`);
        }

        // Available lots in commissary
        let availableQty = 0;
        let suggestedLots: Array<{ lotId: number; lotCode: string; expiryDate: string | null; qty: number }> = [];

        if (commissaryId) {
          const lots = await prisma.inventoryLots.findMany({
            where: {
              ItemId: product.ItemId,
              Status: { in: ["Active", "Available"] },
              QuantityRemaining: { gt: 0 },
            },
            orderBy: [{ ExpiryDate: "asc" }, { LotId: "asc" }],
          });

          let remainingToAllocate = qty;
          for (const lot of lots) {
            const rem = Number(lot.QuantityRemaining);
            availableQty += rem;

            if (remainingToAllocate > 0) {
              const alloc = Math.min(rem, remainingToAllocate);
              suggestedLots.push({
                lotId: lot.LotId,
                lotCode: lot.LotCode,
                expiryDate: lot.ExpiryDate?.toISOString() || null,
                qty: alloc,
              });
              remainingToAllocate -= alloc;
            }
          }
        }

        const isInsufficient = availableQty < qty;

        return {
          productId: itm.productId,
          requestedQuantity: qty,
          availableQuantity: availableQty,
          suggestedLots,
          isInsufficient,
          notes: itm.notes || null,
        };
      })
    );

    // Generate Request Number (STR-YYYY-XXXX)
    const year = new Date().getFullYear();
    const seq = await prisma.documentSequences.upsert({
      where: { DocType_Year: { DocType: "STR", Year: year } },
      update: { LastNumber: { increment: 1 } },
      create: { DocType: "STR", Year: year, LastNumber: 1 },
    });
    const requestNumber = `STR-${year}-${String(seq.LastNumber).padStart(4, "0")}`;

    // Create record with items
    const createdRequest = await prisma.$transaction(async (tx) => {
      const str = await tx.stockTransferRequests.create({
        data: {
          RequestNumber: requestNumber,
          ToLocationId: Number(toLocationId),
          RequestedBy: requestedBy,
          RequestDate: new Date(),
          RequiredDate: new Date(requiredDate),
          Priority: priority,
          Reason: reason || null,
          Status: "Pending Approval",
          StockTransferRequestItems: {
            create: preparedItems.map((pi) => ({
              ProductId: pi.productId,
              RequestedQuantity: pi.requestedQuantity,
              AvailableQuantity: pi.availableQuantity,
              SuggestedLots: pi.suggestedLots,
              IsInsufficient: pi.isInsufficient,
              Notes: pi.notes,
            })),
          },
        },
        include: {
          Locations: true,
          StockTransferRequestItems: {
            include: {
              FinishedProducts: {
                include: { Items: true },
              },
            },
          },
        },
      });

      return str;
    });

    return NextResponse.json(
      {
        success: true,
        message: "Stock transfer request created successfully.",
        data: {
          requestId: createdRequest.RequestId,
          requestNumber: createdRequest.RequestNumber,
          status: createdRequest.Status,
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Error in POST /api/stock-transfer-requests:", error);
    return NextResponse.json(
      { success: false, message: error.message || "Failed to create stock transfer request" },
      { status: 500 }
    );
  }
}
