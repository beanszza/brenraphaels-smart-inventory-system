import { prisma } from "@/lib/prisma";
import type { Staff } from "@/lib/portal/client";
import { resourceResult } from "@/lib/resources/result";
import { mutate as receivingMutate, read, refuse, positiveId, validateInput } from "@/lib/receiving/mutate";
import { stockInNotifications } from "@/lib/stock-ins/notify";
import { mutate as inventoryMutate } from "@/lib/inventory/mutate";
import type { NotesInput, StockInInput } from "@/lib/receiving/inputs";

export function stockInActions(module: "Inventory" | "Goods Receiving", staff: Staff) {
  const mutate = module === "Inventory" ? inventoryMutate : receivingMutate;
  const { notifyApprovalRequested, notifyRequester } = stockInNotifications(module);

  async function createStockIn(body: StockInInput) {
    return mutate(staff, async tx => {
      validateInput(body);
      const grnId = positiveId(body.grnId);
      if (!Array.isArray(body.lines) || !body.lines.length) refuse("Include at least one stock-in line.");
      const grn = await tx.goodsReceipts.findUnique({ where: { GrnId: grnId }, include: { GoodsReceiptItems: true } });
      if (!grn || !["QaCompleted", "Received", "PartiallyPutAway"].includes(grn.Status)) refuse("Select a receipt that has passed QA.");
      if (new Set(body.lines.map(line => line.grnItemId)).size !== body.lines.length) refuse("Each receipt line may appear only once.");
      const lines = [];
      for (const line of body.lines) {
        const source = grn.GoodsReceiptItems.find(item => item.GrnItemId === line.grnItemId && item.ItemId === line.itemId);
        if (!source || line.quantityToStock <= 0 || typeof line.lotCode !== "string" || !line.lotCode.trim()) refuse("Select valid receipt lines, quantities and lot codes.");
        const allocated = await tx.stockInLines.aggregate({
          where: { GrnItemId: source.GrnItemId, StockIns: { Status: { not: "Rejected" } } },
          _sum: { QuantityToStock: true },
        });
        if (line.quantityToStock + Number(allocated._sum.QuantityToStock || 0) > Number(source.DeliveredQuantity)) refuse("Stock-in quantity exceeds the unallocated receipt quantity.");
        const inventory = await tx.inventories.aggregate({ where: { ItemId: source.ItemId }, _sum: { CurrentStock: true } });
        lines.push({ GrnItemId: source.GrnItemId, ItemId: source.ItemId, PurchaseUomId: source.PurchaseUomId,
          QuantityToStock: line.quantityToStock, CurrentStockBeforeCommit: Number(inventory._sum.CurrentStock || 0),
          LotCode: line.lotCode.trim(), ExpiryDate: line.expiryDate ? new Date(line.expiryDate) : source.ExpiryDate,
          Notes: line.notes?.trim(), CommittedToInventory: false });
      }
      const year = new Date().getFullYear();
      const seq = await tx.documentSequences.upsert({ where: { DocType_Year: { DocType: "StockIn", Year: year } },
        update: { LastNumber: { increment: 1 } }, create: { DocType: "StockIn", Year: year, LastNumber: 1 } });
      const stockIn = await tx.stockIns.create({ data: {
        StockInNumber: `SI-${year}-${String(seq.LastNumber).padStart(4, "0")}`, GrnId: grnId,
        Status: body.submitForApproval ? "PendingApproval" : "Draft", CreatedBy: staff.username, CreatedAt: new Date(),
        SubmittedBy: body.submitForApproval ? staff.username : null, SubmittedAt: body.submitForApproval ? new Date() : null,
        Notes: body.notes?.trim(), StockInLines: { create: lines },
      } });
      return { result: resourceResult({ success: true, message: "Stock-In created successfully.", data: stockIn }),
        audit: { module: module, change: "created", target: { type: "stock-in", id: stockIn.StockInId, name: stockIn.StockInNumber },
          description: `${staff.name} created stock-in ${stockIn.StockInNumber}${body.submitForApproval ? " and requested approval" : ""}` },
        after: body.submitForApproval ? () => notifyApprovalRequested(staff, stockIn.StockInNumber) : undefined };
    });
  }

  async function listStockIns(query = "") {
    return read(async () => {
      const searchParams = new URLSearchParams(query);
      const status = searchParams.get("status") || "All";

      const where: import("@prisma/client").Prisma.StockInsWhereInput = {};
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
        status: s.Status,
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

      return resourceResult({ success: true, data });

    });
  }

  async function submitStockIn(idInput: string | number) {
    return mutate(staff, async (tx) => {
      const id = positiveId(idInput);

      const stockIn = await tx.stockIns.findUnique({
        where: { StockInId: id },
      });

      if (!stockIn) {
        return refuse(`Stock-In ${id} not found.`);
      }

      if (stockIn.Status !== "Draft") {
        return refuse(`Only Stock-Ins in Draft status can be submitted. Current status: ${stockIn.Status}.`);
      }

      const updated = await tx.stockIns.update({
        where: { StockInId: id },
        data: {
          Status: "PendingApproval",
          SubmittedBy: staff.username,
          SubmittedAt: new Date(),
        }
      });

      return { result: resourceResult({ success: true, data: updated, message: "Stock-In submitted successfully." }), audit: { module: module, change: "updated", target: { type: "stock-in", id: updated.StockInId, name: updated.StockInNumber }, description: `${staff.name} submitted stock-in for approval ${updated.StockInNumber}` }, after: () => notifyApprovalRequested(staff, updated.StockInNumber) };

    });
  }

  async function approveStockIn(idInput: string | number, body: NotesInput = {}) {
    return mutate(staff, async (tx) => {
      const id = positiveId(idInput);
      validateInput(body);

      const stockIn = await tx.stockIns.findUnique({
        where: { StockInId: id },
      });

      if (!stockIn) {
        return refuse(`Stock-In ${id} not found.`);
      }

      if (stockIn.Status !== "PendingApproval") {
        return refuse(`Only Stock-Ins in PendingApproval status can be approved. Current status: ${stockIn.Status}.`);
      }

      const updated = await tx.stockIns.update({
        where: { StockInId: id },
        data: {
          Status: "Approved",
          ApprovedBy: staff.username,
          ApprovedAt: new Date(),
          Notes: body.notes ? (stockIn.Notes ? `${stockIn.Notes}\nApproval Note: ${body.notes}` : `Approval Note: ${body.notes}`) : stockIn.Notes,
        }
      });

      return { result: resourceResult({ success: true, data: updated, message: "Stock-In approved successfully." }), audit: { module: module, change: "approved", target: { type: "stock-in", id: updated.StockInId, name: updated.StockInNumber }, description: `${staff.name} approved stock-in ${updated.StockInNumber}` }, after: () => notifyRequester(stockIn.SubmittedBy || stockIn.CreatedBy, "approved", updated.StockInNumber) };

    });
  }

  async function rejectStockIn(idInput: string | number, body: NotesInput = {}) {
    return mutate(staff, async (tx) => {
      const id = positiveId(idInput);
      validateInput(body);

      const stockIn = await tx.stockIns.findUnique({
        where: { StockInId: id },
      });

      if (!stockIn) {
        return refuse(`Stock-In ${id} not found.`);
      }

      if (stockIn.Status !== "PendingApproval") {
        return refuse(`Only Stock-Ins in PendingApproval status can be rejected. Current status: ${stockIn.Status}.`);
      }

      const updated = await tx.stockIns.update({
        where: { StockInId: id },
        data: {
          Status: "Rejected",
          RejectedBy: staff.username,
          RejectedAt: new Date(),
          RejectionReason: body.reason,
          Notes: body.notes ? (stockIn.Notes ? `${stockIn.Notes}\nRejection Note: ${body.notes}` : `Rejection Note: ${body.notes}`) : stockIn.Notes,
        }
      });

      return { result: resourceResult({ success: true, data: updated, message: "Stock-In rejected successfully." }), audit: { module: module, change: "rejected", target: { type: "stock-in", id: updated.StockInId, name: updated.StockInNumber }, description: `${staff.name} rejected stock-in ${updated.StockInNumber}` }, after: () => notifyRequester(stockIn.SubmittedBy || stockIn.CreatedBy, "rejected", updated.StockInNumber) };

    });
  }

  async function commitStockIn(idInput: string | number, body: NotesInput = {}) {
    return mutate(staff, async (tx) => {
      const id = positiveId(idInput);
      validateInput(body);

      const stockIn = await tx.stockIns.findUnique({
        where: { StockInId: id },
      });

      if (!stockIn) {
        return refuse(`Stock-In ${id} not found.`);
      }

      if (stockIn.Status !== "Approved") {
        return refuse(`Only Stock-Ins in Approved status can be committed. Current status: ${stockIn.Status}.`);
      }

      const updated = await (async () => {
        // 1. Advance Stock-In status
        const result = await tx.stockIns.update({
          where: { StockInId: id },
          data: {
            Status: "Committed",
            CommittedBy: staff.username,
            CommittedAt: new Date(),
            Notes: body.notes ? (stockIn.Notes ? `${stockIn.Notes}\nCommit Note: ${body.notes}` : `Commit Note: ${body.notes}`) : stockIn.Notes,
          }
        });

        // 2. Mark all lines as committed
        await tx.stockInLines.updateMany({
          where: { StockInId: id },
          data: {
            CommittedToInventory: true,
          }
        });

        // In a real application, you would also create InventoryLots and InventoryLedger entries here.

        return result;
      })();

      return { result: resourceResult({ success: true, data: updated, message: "Stock-In committed successfully." }), audit: { module: module, change: "updated", target: { type: "stock-in", id: updated.StockInId, name: updated.StockInNumber }, description: `${staff.name} committed stock-in ${updated.StockInNumber}` } };

    });
  }

  return { createStockIn, listStockIns, submitStockIn, approveStockIn, rejectStockIn, commitStockIn };
}
