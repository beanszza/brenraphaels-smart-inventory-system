import type { LossReport } from "@/components/production/types";

interface LossBatch {
  batchId: number; batchNumber: string; productName: string; variant?: string;
  status: string; qualityStatus?: string; estimatedQuantity: number; stage?: string;
  productionDate?: string; rejectionReason?: string; assignedCook?: string; notes?: string;
  totalMaterialCost?: number;
  consumptions?: { itemName: string; lotCode: string; quantityUsed: number; uomAbbr: string; unitCost: number }[];
}

export function lossReportsFromBatches(batches: LossBatch[]): LossReport[] {
  return batches.filter(b => b.status?.toLowerCase() === "rejected" || b.qualityStatus?.toLowerCase() === "rejected")
    .map(b => ({ lossId: `LOSS-${b.batchNumber}`, batchId: b.batchId, batchNumber: b.batchNumber,
      productName: b.productName, variant: b.variant || "Standard", targetYield: b.estimatedQuantity,
      failureStage: b.stage || "Quality Control", date: b.productionDate || "",
      rejectionReason: b.rejectionReason || "QA Inspection Rejection", inspector: b.assignedCook || "",
      notes: b.notes || "", totalEstimatedLoss: b.totalMaterialCost ?? 0,
      items: (b.consumptions ?? []).map(c => ({ itemName: c.itemName, lotNumber: c.lotCode,
        quantity: c.quantityUsed, uom: c.uomAbbr, unitCost: c.unitCost, totalCost: c.quantityUsed * c.unitCost })),
    }));
}
