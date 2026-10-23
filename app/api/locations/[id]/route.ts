import { requireRouteModule } from "@/lib/portal/staff";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const access = await requireRouteModule(request, "Resources & Suppliers");
  if (!access.ok) return access.response;

  const params = await props.params;
  try {
    const id = parseInt(params.id, 10);
    const body = await request.json();

    const loc = await prisma.locations.update({
      where: { LocationId: id },
      data: {
        LocationName: body.locationName,
        LocationType: body.locationType,
        Status: body.status,
        Address: body.address,
        IsActive: body.isActive ?? true,
      },
    });

    return NextResponse.json({ success: true, data: loc });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
