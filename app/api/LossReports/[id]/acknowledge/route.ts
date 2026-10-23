import { requireRouteModule } from "@/lib/portal/staff";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const access = await requireRouteModule(request, "Goods Receiving");
  if (!access.ok) return access.response;

  const params = await props.params;
  try {
    const id = parseInt(params.id, 10);

    const lossReport = await prisma.lossReports.findUnique({
      where: { LossReportId: id },
    });

    if (!lossReport) {
      return NextResponse.json({ success: false, message: `Loss Report ${id} not found.` }, { status: 404 });
    }

    if (lossReport.IsAcknowledged) {
      return NextResponse.json({ success: false, message: `Loss Report is already acknowledged.` }, { status: 400 });
    }

    const updated = await prisma.lossReports.update({
      where: { LossReportId: id },
      data: {
        IsAcknowledged: true,
        AcknowledgedBy: "System User", // Normally from session
        AcknowledgedAt: new Date(),
      }
    });

    return NextResponse.json({ success: true, data: updated, message: "Loss Report acknowledged successfully." });
  } catch (error: any) {
    console.error("Error acknowledging Loss Report:", error);
    return NextResponse.json({ success: false, message: `An error occurred: ${error.message}` }, { status: 500 });
  }
}
