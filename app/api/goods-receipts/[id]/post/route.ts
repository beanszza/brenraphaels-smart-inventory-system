import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const id = parseInt(params.id, 10);

    const grn = await prisma.goodsReceipts.findUnique({
      where: { GrnId: id },
      include: {
        GoodsReceiptItems: true
      }
    });

    if (!grn) {
      return NextResponse.json({ success: false, message: `Goods Receipt Note ${id} not found.` }, { status: 404 });
    }

    if (grn.Status !== "Draft" && grn.Status !== "QaPending") {
      return NextResponse.json({ success: false, message: `Only GRNs in Draft or QaPending status can be processed for QA. Current status: ${grn.Status}.` }, { status: 400 });
    }

    const { updatedGrn, inspection } = await prisma.$transaction(async (tx) => {
      // 1. Advance GRN status to QaPending
      const result = await tx.goodsReceipts.update({
        where: { GrnId: id },
        data: { Status: "QaPending" }
      });

      // 2. Check if a QA Inspection already exists for this GRN
      let currentInspection = await tx.qualityInspections.findFirst({
        where: {
          ReferenceType: "GRN",
          ReferenceId: grn.GrnId,
        },
        include: {
          QualityInspectionItems: true,
        },
      });

      if (!currentInspection) {
        const year = new Date().getFullYear();

        // Find all existing QC inspection numbers for this year to get the real maximum
        const existingQcs = await tx.qualityInspections.findMany({
          where: {
            InspectionNumber: { startsWith: `QC-${year}-` },
          },
          select: { InspectionNumber: true },
        });

        let maxNum = 0;
        for (const qc of existingQcs) {
          const match = qc.InspectionNumber.match(/QC-\d{4}-(\d+)/);
          if (match) {
            const num = parseInt(match[1], 10);
            if (num > maxNum) maxNum = num;
          }
        }

        const currentSeq = await tx.documentSequences.findFirst({
          where: {
            DocType: { in: ["QualityInspection", "QC"] },
            Year: year,
          },
          orderBy: { LastNumber: "desc" },
        });

        let nextSeq = Math.max(maxNum, currentSeq?.LastNumber || 0) + 1;

        // Ensure uniqueness even under unexpected sequence gaps or concurrent calls
        let inspectionNumber = `QC-${year}-${String(nextSeq).padStart(4, "0")}`;
        while (await tx.qualityInspections.findUnique({ where: { InspectionNumber: inspectionNumber } })) {
          nextSeq++;
          inspectionNumber = `QC-${year}-${String(nextSeq).padStart(4, "0")}`;
        }

        // Keep DocumentSequences updated
        await tx.documentSequences.upsert({
          where: { DocType_Year: { DocType: "QualityInspection", Year: year } },
          update: { LastNumber: nextSeq },
          create: { DocType: "QualityInspection", Year: year, LastNumber: nextSeq },
        });

        currentInspection = await tx.qualityInspections.create({
          data: {
            InspectionNumber: inspectionNumber,
            InspectionType: "Receiving",
            ReferenceType: "GRN",
            ReferenceId: grn.GrnId,
            ReferenceNumber: grn.GrnNumber,
            InspectorId: "SYS",
            InspectorName: "Pending QA",
            InspectionDate: new Date(),
            Status: "Pending",
            QualityInspectionItems: {
              create: grn.GoodsReceiptItems.map((item) => ({
                ItemId: item.ItemId,
                DeliveredQuantity: item.DeliveredQuantity,
                AcceptedQuantity: 0,
                RejectedQuantity: 0,
                ConcessionQuantity: 0,
              }))
            }
          },
          include: {
            QualityInspectionItems: true,
          },
        });
      }

      return { updatedGrn: result, inspection: currentInspection };
    });

    return NextResponse.json({
      success: true,
      message: "GRN posted and QA inspection generated successfully.",
      data: {
        ...updatedGrn,
        grnId: updatedGrn.GrnId,
        grnNumber: updatedGrn.GrnNumber,
        status: updatedGrn.Status,
        deliveryId: updatedGrn.DeliveryId,
        poId: updatedGrn.PoId,
      },
      inspection: inspection ? {
        inspectionId: inspection.InspectionId,
        inspectionNumber: inspection.InspectionNumber,
        inspectionType: inspection.InspectionType,
        status: inspection.Status,
      } : null,
    });
  } catch (error: any) {
    console.error("Error posting GRN:", error);
    return NextResponse.json({ success: false, message: `An error occurred: ${error.message}` }, { status: 500 });
  }
}
