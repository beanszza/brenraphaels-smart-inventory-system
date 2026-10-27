"use server";

import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/portal/staff";
import { resourceResult } from "@/lib/resources/result";
import { mutate, read, refuse, positiveId } from "@/lib/receiving/mutate";

const MODULE = "Goods Receiving";

export async function listLossReports(query = "") {
  await requireModule(MODULE);
  return read(async () => {
    const searchParams = new URLSearchParams(query);
    const filter = searchParams.get("filter") || "all";

    const where: import("@prisma/client").Prisma.LossReportsWhereInput = {};
    if (filter === "unacknowledged") {
      where.IsAcknowledged = false;
    } else if (filter === "acknowledged") {
      where.IsAcknowledged = true;
    }

    const lossReports = await prisma.lossReports.findMany({
      where,
      orderBy: { CreatedAt: "desc" },
      include: {
        Discrepancies: { include: { GoodsReceipts: true, PurchaseOrders: { include: { Suppliers: true, PurchaseRequisition: true } } } },
        GoodsReceipts: { include: { Deliveries: { include: { PurchaseOrders: { include: { Suppliers: true, PurchaseRequisition: true } } } } } },
        Items: { include: { Uom: true, UnitOfMeasures_Items_StockUomIdToUnitOfMeasures: true } }
      }
    });

    const data = lossReports.map((l: typeof lossReports[number]) => {
      // Find PO details from either Discrepancies or GoodsReceipts relations
      let poNumber = l.Discrepancies?.PoNumber;
      let prId = l.Discrepancies?.PurchaseOrders?.PrId;
      let prNumber = l.Discrepancies?.PurchaseOrders?.PurchaseRequisition?.PrNumber;
      let supplierName = l.Discrepancies?.PurchaseOrders?.Suppliers?.CompanyName;

      if (!poNumber && l.GoodsReceipts) {
        poNumber = l.GoodsReceipts.Deliveries?.PurchaseOrders?.PoNumber;
        prId = l.GoodsReceipts.Deliveries?.PurchaseOrders?.PrId;
        prNumber = l.GoodsReceipts.Deliveries?.PurchaseOrders?.PurchaseRequisition?.PrNumber;
        supplierName = l.GoodsReceipts.Deliveries?.PurchaseOrders?.Suppliers?.CompanyName;
      }

      return {
        lossReportId: l.LossReportId,
        lossReportNumber: l.LossReportNumber,
        discrepancyId: l.DiscrepancyId,
        discrepancyNumber: l.Discrepancies?.DiscrepancyNumber,
        grnId: l.GrnId,
        grnNumber: l.GoodsReceipts?.GrnNumber || l.Discrepancies?.GrnNumber,
        poId: l.PoId || l.Discrepancies?.PoId || l.GoodsReceipts?.PoId,
        poNumber: poNumber || "",
        prId: prId,
        prNumber: prNumber || "",
        supplierName: supplierName || "",
        itemId: l.ItemId,
        itemName: l.Items?.ItemName || "",
        itemCode: l.Items?.ItemCode || "",
        lostQuantity: Number(l.LostQuantity),
        uomId: l.UomId,
        uomName: l.Items?.Uom?.Abbreviation || l.Items?.UnitOfMeasures_Items_StockUomIdToUnitOfMeasures?.Abbreviation || "Unit",
        unitCost: 0, // Simplified for now
        totalCost: 0, // Simplified for now
        reason: l.Reason,
        notes: l.Notes,
        isAcknowledged: l.IsAcknowledged,
        acknowledgedBy: l.AcknowledgedBy,
        acknowledgedAt: l.AcknowledgedAt,
        authorisedBy: l.AuthorisedBy,
        createdBy: l.CreatedBy,
        createdAt: l.CreatedAt,
        stockLedgerEntryId: l.StockLedgerEntryId ? Number(l.StockLedgerEntryId) : undefined
      };
    });

    return resourceResult({ success: true, data });

  });
}

export async function acknowledgeLoss(idInput: string | number) {
  const staff = await requireModule(MODULE);
  return mutate(staff, async (tx) => {
    const id = positiveId(idInput);

    const lossReport = await tx.lossReports.findUnique({
      where: { LossReportId: id },
    });

    if (!lossReport) {
      return refuse(`Loss Report ${id} not found.`);
    }

    if (lossReport.IsAcknowledged) {
      return refuse(`Loss Report is already acknowledged.`);
    }

    const updated = await tx.lossReports.update({
      where: { LossReportId: id },
      data: {
        IsAcknowledged: true,
        AcknowledgedBy: staff.username,
        AcknowledgedAt: new Date(),
      }
    });

    const data = { ...updated, StockLedgerEntryId: updated.StockLedgerEntryId == null ? null : String(updated.StockLedgerEntryId) };
    return { result: resourceResult({ success: true, data, message: "Loss Report acknowledged successfully." }), audit: { module: MODULE, change: "updated", target: { type: "loss-report", id: updated.LossReportId, name: updated.LossReportNumber }, description: `${staff.name} acknowledged loss report ${updated.LossReportNumber}` } };

  });
}
