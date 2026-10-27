"use server";
import { mapCycleCount } from "@/lib/inventory/dto";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/portal/staff";
import { resourceResult } from "@/lib/resources/result";
import { read, pageNumber } from "@/lib/inventory/mutate";

export async function listCycleCounts(query = "") {
  await requireModule("Inventory");
  return read(async () => {
    const searchParams = new URLSearchParams(query);
    const page = pageNumber(searchParams.get("page"), 1, 1000000);
    const pageSize = pageNumber(searchParams.get("pageSize"), 10, 200);

    const [total, counts] = await Promise.all([
      prisma.cycleCounts.count(),
      prisma.cycleCounts.findMany({
        include: { Locations: true, CycleCountItems: true },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { CycleCountId: "desc" },
      }),
    ]);

    return resourceResult({
      success: true,
      data: {
        items: counts.map(mapCycleCount),
        totalCount: total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  });
}
