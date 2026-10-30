"use server";
/* eslint-disable @typescript-eslint/no-explicit-any -- Retain existing transfer DTOs during migration. */
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/portal/staff";
import { resourceResult } from "@/lib/resources/result";
import { read, mutate, refuse, validateInput, saved } from "@/lib/stock-transfer/operations";
import { notifyApprovalRequested } from "@/lib/stock-transfer/notify";
import { ensureUbeJamHavaneroStock } from "@/lib/inventory/seed-stock";

export async function listRequests(query = "") {
  await requireModule("Stock Transfer");
  await ensureUbeJamHavaneroStock();
  return read(async () => {
    const searchParams = new URLSearchParams(query);
    const search = searchParams.get("search")?.trim() || "";
    const status = searchParams.get("status")?.trim() || "";
    const priority = searchParams.get("priority")?.trim() || "";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") || "10", 10) || 10));

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
              ProductId: true,
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

    const itemIds = requests
      .flatMap((r) => r.StockTransferRequestItems.map((i) => i.FinishedProducts?.ItemId))
      .filter(Boolean) as number[];

    const activeLots = itemIds.length > 0
      ? await prisma.inventoryLots.findMany({
          where: {
            ItemId: { in: itemIds },
            Status: { in: ["Active", "Available"] },
            QuantityRemaining: { gt: 0 },
            OR: [{ ExpiryDate: null }, { ExpiryDate: { gt: new Date() } }],
          },
          orderBy: [{ ExpiryDate: "asc" }, { LotId: "asc" }],
        })
      : [];

    const lotsByItem: Record<number, typeof activeLots> = {};
    for (const lot of activeLots) {
      if (!lotsByItem[lot.ItemId]) lotsByItem[lot.ItemId] = [];
      lotsByItem[lot.ItemId].push(lot);
    }

    const data = requests.map((req) => {
      const hasScheduledTransfer = req.StockTransfers?.some((st) => st.Status === "Scheduled");
      const hasDispatchedTransfer = req.StockTransfers?.some((st) => st.Status === "Dispatched");
      let effectiveStatus = req.Status;
      if (req.Status === "Approved" && hasScheduledTransfer) {
        effectiveStatus = "Scheduled";
      } else if (req.Status === "Scheduled" && hasDispatchedTransfer && !hasScheduledTransfer) {
        effectiveStatus = "Dispatched";
      }

      return {
        requestId: req.RequestId,
        requestNumber: req.RequestNumber,
        toLocationId: req.ToLocationId,
        toLocationName: req.Locations?.LocationName || "",
        requestedBy: req.RequestedBy,
        requestDate: req.RequestDate.toISOString(),
        requiredDate: req.RequiredDate.toISOString(),
        priority: req.Priority,
        reason: req.Reason || "",
        status: effectiveStatus,
        adminNotes: req.AdminNotes || "",
        reviewedBy: req.ReviewedBy || null,
        reviewedAt: req.ReviewedAt?.toISOString() || null,
        createdAt: req.CreatedAt.toISOString(),
        items: req.StockTransferRequestItems.map((item) => {
          let avail = Number(item.AvailableQuantity);
          let isInsuff = item.IsInsufficient;
          let suggestedLots = (item.SuggestedLots as any[]) || [];

          const matchingLots = item.FinishedProducts?.ItemId ? lotsByItem[item.FinishedProducts.ItemId] || [] : [];
          const totalLotsAvail = matchingLots.reduce(
            (sum, l) => sum + Math.max(0, Number(l.QuantityRemaining) - Number(l.ReservedQuantity || 0)),
            0
          );

          if (totalLotsAvail > 0) {
            avail = totalLotsAvail;
            isInsuff = avail < Number(item.RequestedQuantity);
            if (!suggestedLots || suggestedLots.length === 0) {
              suggestedLots = matchingLots.map((l) => ({
                lotId: l.LotId,
                lotCode: l.LotCode,
                expiryDate: l.ExpiryDate?.toISOString() || null,
                qty: Math.min(Number(l.QuantityRemaining), Number(item.RequestedQuantity)),
              }));
            }
          }

          return {
            requestItemId: item.RequestItemId,
            productId: item.ProductId,
            productName: item.FinishedProducts?.Items?.ItemName || "Unknown Product",
            variant: item.FinishedProducts?.Variant || "",
            sku: item.FinishedProducts?.Sku || "",
            requestedQuantity: Number(item.RequestedQuantity),
            availableQuantity: avail,
            isInsufficient: isInsuff,
            suggestedLots,
            notes: item.Notes || "",
          };
        }),
        transfers: req.StockTransfers.map((st) => ({
          transferId: st.TransferId,
          transferNumber: st.TransferNumber,
          productId: st.ProductId,
          status: st.Status,
          transferQuantity: Number(st.TransferQuantity),
          scheduledDate: st.ScheduledDate?.toISOString() || null,
          dispatchedDate: st.DispatchedDate?.toISOString() || null,
          driverName: st.DriverName || null,
          vehiclePlate: st.VehiclePlate || null,
          courierName: st.CourierName || null,
        })),
      };
    });

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
  await ensureUbeJamHavaneroStock();
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

    // Identify Commissary source locations
    const commissaryLocations = await tx.locations.findMany({
      where: {
        OR: [
          { LocationName: { contains: "Finished", mode: "insensitive" } },
          { LocationType: { contains: "Finished", mode: "insensitive" } },
          { LocationName: { contains: "Commissary", mode: "insensitive" } },
          { LocationType: { contains: "Commissary", mode: "insensitive" } },
          { LocationName: { contains: "Warehouse", mode: "insensitive" } },
          { LocationType: { contains: "Warehouse", mode: "insensitive" } },
          { LocationName: { contains: "Factory", mode: "insensitive" } },
          { IsSystemLocation: true },
        ],
        NOT: [
          { LocationType: { in: ["Branch", "Bazaar", "In Transit", "Disposal", "Quarantine"] } },
          { LocationName: { contains: "Branch", mode: "insensitive" } },
          { LocationName: { contains: "Bazaar", mode: "insensitive" } },
          { LocationName: { contains: "Transit", mode: "insensitive" } },
        ],
      },
      select: { LocationId: true },
    });
    const commissaryIds = commissaryLocations.map((l) => l.LocationId);

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

        let lots = await tx.inventoryLots.findMany({
          where: {
            ItemId: product.ItemId,
            ...(commissaryIds.length > 0 ? { LocationId: { in: commissaryIds } } : {}),
            OR: [{ ExpiryDate: null }, { ExpiryDate: { gt: new Date() } }],
            Status: { in: ["Active", "Available"] },
            QuantityRemaining: { gt: 0 },
          },
          orderBy: [{ ExpiryDate: "asc" }, { LotId: "asc" }],
        });

        if (lots.length === 0) {
          lots = await tx.inventoryLots.findMany({
            where: {
              ItemId: product.ItemId,
              OR: [{ ExpiryDate: null }, { ExpiryDate: { gt: new Date() } }],
              Status: { in: ["Active", "Available"] },
              QuantityRemaining: { gt: 0 },
            },
            orderBy: [{ ExpiryDate: "asc" }, { LotId: "asc" }],
          });
        }

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
    const createdRequest = await tx.stockTransferRequests.create({
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

    return saved(
      staff,
      "stock-transfer-request",
      createdRequest.RequestId,
      createdRequest.RequestNumber || String(createdRequest.RequestId),
      "created",
      resourceResult({
        success: true,
        message: "Stock transfer request created successfully.",
        data: {
          requestId: createdRequest.RequestId,
          requestNumber: createdRequest.RequestNumber,
          status: createdRequest.Status,
        },
      }),
      () => notifyApprovalRequested(staff, createdRequest.RequestNumber)
    );
  });
}
