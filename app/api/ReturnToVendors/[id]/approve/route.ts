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

    const rtv = await prisma.returnToVendors.findUnique({
      where: { RtvId: id },
    });

    if (!rtv) {
      return NextResponse.json({ success: false, message: `Return to Supplier (RTV) ${id} not found.` }, { status: 404 });
    }

    if (rtv.Status !== "PendingApproval") {
      return NextResponse.json({ success: false, message: `Only RTVs in PendingApproval status can be approved. Current status: ${rtv.Status}.` }, { status: 400 });
    }

    const updated = await prisma.returnToVendors.update({
      where: { RtvId: id },
      data: {
        Status: "Approved",
        ApprovedBy: "System User",
        ApprovedAt: new Date(),
      }
    });

    return NextResponse.json({ success: true, data: updated, message: "RTV approved successfully." });
  } catch (error: any) {
    console.error("Error approving RTV:", error);
    return NextResponse.json({ success: false, message: `An error occurred: ${error.message}` }, { status: 500 });
  }
}
