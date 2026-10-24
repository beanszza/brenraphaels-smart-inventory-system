import type { Prisma } from "@prisma/client";

export function mapCycleCount(cc: Prisma.CycleCountsGetPayload<{ include: { Locations: true; CycleCountItems: true } }>) {
  return {
    cycleCountId: cc.CycleCountId,
    countNumber: cc.CountNumber,
    locationId: cc.LocationId,
    locationName: cc.Locations?.LocationName ?? "",
    countDate: cc.CountDate?.toISOString() ?? null,
    reconciledDate: cc.ReconciledDate?.toISOString() ?? null,
    status: cc.Status,
    countedBy: cc.CountedBy,
    reconciledBy: cc.ReconciledBy ?? "",
    notes: cc.Notes ?? "",
    totalSystemValue: Number(cc.TotalSystemValue),
    totalCountedValue: Number(cc.TotalCountedValue),
    totalVarianceValue: Number(cc.TotalVarianceValue),
    itemCount: cc.CycleCountItems?.length ?? 0,
  };
}

