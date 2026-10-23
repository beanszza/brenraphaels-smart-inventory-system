import { requireRouteModule } from "@/lib/portal/staff";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  request: NextRequest,
  props: { params: Promise<{ supplierId: string; itemId: string }> }
) {
  const access = await requireRouteModule(request, "Resources & Suppliers");
  if (!access.ok) return access.response;

  const params = await props.params;
  try {
    const supplierId = parseInt(params.supplierId, 10);
    const itemId = parseInt(params.itemId, 10);

    // Soft delete — set IsActive = false
    await prisma.supplierItems.update({
      where: { SupplierId_ItemId: { SupplierId: supplierId, ItemId: itemId } },
      data: { IsActive: false },
    });

    return NextResponse.json({ success: true, message: "Supplier item removed." });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
