import { requireRouteModule } from "@/lib/portal/staff";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const access = await requireRouteModule(request, "Stock Transfer");
  if (!access.ok) return access.response;

  try {
    const [total, pending, dispatched, received] = await Promise.all([
      prisma.stockTransfers.count(),
      prisma.stockTransfers.count({ where: { Status: "Pending" } }),
      prisma.stockTransfers.count({ where: { Status: "Dispatched" } }),
      prisma.stockTransfers.count({ where: { Status: "Received" } }),
    ]);

    return NextResponse.json({
      success: true,
      data: { total, pending, dispatched, received },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
