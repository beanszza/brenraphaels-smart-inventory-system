import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const id = parseInt(params.id, 10);
    const body = await request.json();

    const existingInspection = await prisma.qualityInspections.findUnique({
      where: { InspectionId: id },
    });

    if (!existingInspection) {
      return NextResponse.json({ success: false, message: "QA inspection not found." }, { status: 404 });
    }

    const updatedInspection = await prisma.$transaction(async (tx: any) => {
      // 1. Update main inspection record
      const inspection = await tx.qualityInspections.update({
        where: { InspectionId: id },
        data: {
          Status: "Completed",
          CompletedAt: new Date(),
          OverallNotes: body.overallNotes || existingInspection.OverallNotes,
        },
      });

      // 2. Update each item
      if (Array.isArray(body.items)) {
        for (const item of body.items) {
          if (item.inspectionItemId) {
            await tx.qualityInspectionItems.update({
              where: { InspectionItemId: item.inspectionItemId },
              data: {
                AcceptedQuantity: item.acceptedQuantity ?? 0,
                RejectedQuantity: item.rejectedQuantity ?? 0,
                ConcessionQuantity: item.concessionQuantity ?? 0,
                DefectReason: item.defectReason || null,
                Notes: item.notes || null,
              },
            });
          }
        }
      }

      // 3. Update associated GRN, Delivery, and Purchase Order if ReferenceType is GRN
      if (existingInspection.ReferenceType === "GRN" && existingInspection.ReferenceId) {
        let totalAccepted = 0;
        let totalRejected = 0;
        if (Array.isArray(body.items)) {
          body.items.forEach((it: any) => {
            totalAccepted += Number(it.acceptedQuantity) || 0;
            totalRejected += Number(it.rejectedQuantity) || 0;
          });
        }

        const grnStatus = totalAccepted === 0 && totalRejected > 0 ? "Rejected" : "QaCompleted";

        await tx.goodsReceipts.update({
          where: { GrnId: existingInspection.ReferenceId },
          data: {
            Status: grnStatus,
            PostedAt: new Date(),
          },
        });

        const grn = await tx.goodsReceipts.findUnique({
          where: { GrnId: existingInspection.ReferenceId },
          include: { GoodsReceiptItems: true },
        });

        if (grn?.DeliveryId) {
          await tx.deliveries.update({
            where: { DeliveryId: grn.DeliveryId },
            data: { Status: grnStatus === "Rejected" ? "Rejected" : "Received" },
          }).catch(() => {});
        }

        if (grn?.GoodsReceiptItems && grnStatus !== "Rejected") {
          for (const grnItem of grn.GoodsReceiptItems) {
            const acceptedQty = body.items?.find((i: any) => i.itemId === grnItem.ItemId)?.acceptedQuantity ?? grnItem.DeliveredQuantity;
            if (Number(acceptedQty) > 0 && grnItem.PoItemId) {
              await tx.purchaseOrderItems.update({
                where: { PoItemId: grnItem.PoItemId },
                data: {
                  ReceivedQuantity: { increment: Number(acceptedQty) },
                },
              }).catch(() => {});
            }
          }
        }
      }

      return inspection;
    });

    return NextResponse.json({ success: true, data: updatedInspection, message: "QA inspection completed successfully." });
  } catch (error: any) {
    console.error("Error completing QA inspection:", error);
    return NextResponse.json({ success: false, message: "Failed to complete QA inspection." }, { status: 500 });
  }
}
