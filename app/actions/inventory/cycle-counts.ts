"use server";

import { requireModule } from "@/lib/portal/staff";
import { mutate, positiveId, refuse } from "@/lib/inventory/mutate";
import { mapCycleCount } from "@/lib/inventory/dto";
import { resourceResult } from "@/lib/resources/result";

export async function createCycleCount(input: { locationId: number; notes?: string }) {
  const staff = await requireModule("Inventory");
  return mutate(staff, async tx => {
    const locationId = positiveId(input?.locationId);
    if (input.notes !== undefined && (typeof input.notes !== "string" || input.notes.length > 10000)) refuse("Invalid notes.");
    if (!await tx.locations.findUnique({ where: { LocationId: locationId } })) refuse("Location not found.");
    const year = new Date().getFullYear();
    const seq = await tx.documentSequences.upsert({
      where: { DocType_Year: { DocType: "CycleCount", Year: year } },
      update: { LastNumber: { increment: 1 } }, create: { DocType: "CycleCount", Year: year, LastNumber: 1 },
    });
    const inventories = await tx.inventories.findMany({ where: { LocationId: locationId } });
    const count = await tx.cycleCounts.create({ data: {
      CountNumber: `CC-${year}-${String(seq.LastNumber).padStart(4, "0")}`, LocationId: locationId,
      CountDate: new Date(), Status: "Open", CountedBy: staff.username, Notes: input.notes ?? "",
      TotalSystemValue: 0, TotalCountedValue: 0, TotalVarianceValue: 0,
      CycleCountItems: { create: inventories.map(inv => ({ ItemId: inv.ItemId,
        SystemQuantity: inv.CurrentStock, CountedQuantity: 0, UnitCost: 0 })) },
    }, include: { Locations: true, CycleCountItems: true } });
    return { result: resourceResult({ success: true, message: "Cycle count created.", data: mapCycleCount(count) }),
      audit: { module: "Inventory", change: "created", target: { type: "cycle-count", id: count.CycleCountId, name: count.CountNumber },
        description: `${staff.name} created cycle count ${count.CountNumber}` } };
  });
}

export async function reconcileCycleCount(idInput: number) {
  const staff = await requireModule("Inventory");
  return mutate(staff, async tx => {
    const id = positiveId(idInput);
    const count = await tx.cycleCounts.findUnique({ where: { CycleCountId: id }, include: { CycleCountItems: true } });
    if (!count) refuse("Cycle count not found.");
    if (count.Status !== "Open") refuse(`Cannot reconcile a count with status "${count.Status}".`);
    for (const item of count.CycleCountItems) {
      const variance = Number(item.CountedQuantity) - Number(item.SystemQuantity);
      if (variance === 0) continue;
      await tx.inventories.updateMany({ where: { ItemId: item.ItemId, LocationId: count.LocationId },
        data: { CurrentStock: { increment: variance } } });
    }
    const updated = await tx.cycleCounts.update({ where: { CycleCountId: id }, data: {
      Status: "Reconciled", ReconciledDate: new Date(), ReconciledBy: staff.username,
    } });
    return { result: resourceResult({ success: true, message: "Cycle count reconciled. Inventory adjusted.",
      data: { cycleCountId: updated.CycleCountId, status: updated.Status } }),
      audit: { module: "Inventory", change: "updated", target: { type: "cycle-count", id, name: count.CountNumber },
        description: `${staff.name} reconciled cycle count ${count.CountNumber} and adjusted inventory` } };
  });
}
