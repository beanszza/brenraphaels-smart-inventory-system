"use server";
/* eslint-disable @typescript-eslint/no-explicit-any -- Retain existing transfer DTOs during migration. */
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/portal/staff";
import { resourceResult } from "@/lib/resources/result";
import { read, mutate, refuse, validateInput, saved } from "@/lib/stock-transfer/operations";
import { notifyApprovalRequested } from "@/lib/stock-transfer/notify";
export async function listRequests(query = "") {
  await requireModule("Stock Transfer");
  return read(async () => {

    const searchParams = new URLSearchParams(query);
    const search = searchParams.get("search")?.trim() || "";
    const status = searchParams.get("status")?.trim() || "";
    const priority = searchParams.get("priority")?.trim() || "";
    const page = Math.max(1, (parseInt(searchParams.get("page") || "1", 10) || 1));
    const pageSize = Math.min(100, Math.max(1, (parseInt(searchParams.get("pageSize") || "10", 10) || 10)));

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

    return resourceResult({
      success: true,
      data,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });

  });
}
export async function createRequest(body: any = {}) {
  const staff = await requireModule("Stock Transfer");
  return mutate(staff, async (tx) => {
validateInput(body);
    const { toLocationId, requiredDate, priority = "Normal", reason, items } = body;

    if (!toLocationId || !items || !Array.isArray(items) || items.length === 0) {
      return refuse("Destination location and at least one item are required.");
    }

    if (!requiredDate) {
      return refuse("Required Date is required.");
    }

    // Identify Commissary source location
    const commissary = await tx.locations.findFirst({
      where: {
        OR: [
          { IsSystemLocation: true },
          { LocationType: { contains: "Commissary", mode: "insensitive" } },
          { LocationName: { contains: "Commissary", mode: "insensitive" } },
        ],
      },
    });

    if (!commissary) refuse("Commissary source location not found.");
    const commissaryId = commissary.LocationId;

    // Process items and check availability + FEFO lots
    const preparedItems = await Promise.all(
      items.map(async (itm: { productId: number; requestedQuantity: number; notes?: string }) => {
        const qty = Number(itm.requestedQuantity);
        if (isNaN(qty) || qty <= 0) {
          throw new Error("Item quantity must be greater than zero.");
        }

        const product = await tx.finishedProducts.findUnique({
          where: { ProductId: itm.productId },
          include: { Items: true },
        });

        if (!product) {
          throw new Error(`Finished product with ID ${itm.productId} not found.`);
        }

        // Available lots in commissary
        let availableQty = 0;
        const suggestedLots: Array<{ lotId: number; lotCode: string; expiryDate: string | null; qty: number }> = [];

        if (commissaryId) {
          const lots = await tx.inventoryLots.findMany({
            where: {
              ItemId: product.ItemId,
              LocationId: commissary.LocationId,
              OR: [{ ExpiryDate: null }, { ExpiryDate: { gt: new Date() } }],
              Status: { in: ["Active", "Available"] },
              QuantityRemaining: { gt: 0 },
            },
            orderBy: [{ ExpiryDate: "asc" }, { LotId: "asc" }],
          });

          let remainingToAllocate = qty;
          for (const lot of lots) {
            const rem = Math.max(0, Number(lot.QuantityRemaining) - Number(lot.ReservedQuantity || 0));
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
    const seq = await tx.documentSequences.upsert({
      where: { DocType_Year: { DocType: "STR", Year: year } },
      update: { LastNumber: { increment: 1 } },
      create: { DocType: "STR", Year: year, LastNumber: 1 },
    });
    const requestNumber = `STR-${year}-${String(seq.LastNumber).padStart(4, "0")}`;

    // Create record with items
    const createdRequest = await (async () => {
      const str = await tx.stockTransferRequests.create({
        data: {
          RequestNumber: requestNumber,
          ToLocationId: Number(toLocationId),
          RequestedBy: staff.username,
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
    })();

    return saved(staff, "stock-transfer-request", createdRequest.RequestId, createdRequest.RequestNumber || String(createdRequest.RequestId), "created", resourceResult({
        success: true,
        message: "Stock transfer request created successfully.",
        data: {
          requestId: createdRequest.RequestId,
          requestNumber: createdRequest.RequestNumber,
          status: createdRequest.Status,
        },
      }), () => notifyApprovalRequested(staff, createdRequest.RequestNumber));

  });
}
