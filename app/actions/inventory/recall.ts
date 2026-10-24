"use server";

import { requireModule } from "@/lib/portal/staff";
import { mutate, refuse } from "@/lib/inventory/mutate";
import { resourceResult } from "@/lib/resources/result";

export async function recallLot(input: { lotCode: string; applyHold: boolean }) {
  const staff = await requireModule("Inventory");
  return mutate(staff, async tx => {
    if (typeof input?.lotCode !== "string" || !input.lotCode.trim() || input.lotCode.length > 100 || typeof input.applyHold !== "boolean") refuse("Enter a lot code and recall decision.");
    const lotCode = input.lotCode.trim();
    const lot = await tx.inventoryLots.findFirst({ where: { LotCode: lotCode } });
    if (!lot) refuse(`Lot "${lotCode}" not found.`);
    if (!input.applyHold) return { result: resourceResult({ success: true,
      message: `Recall simulated for lot "${lotCode}". No inventory changes applied.`, data: { lotCode, holdApplied: false } }) };
    await tx.inventoryLots.updateMany({ where: { LotCode: lotCode }, data: {
      Status: "OnHold", HoldReason: "Recall initiated via traceability module",
    } });
    return { result: resourceResult({ success: true, message: `Lot "${lotCode}" placed on hold. Recall executed.`, data: { lotCode, holdApplied: true } }),
      audit: { module: "Inventory", change: "updated", target: { type: "inventory-lot", id: lot.LotId, name: lotCode },
        description: `${staff.name} recalled lot ${lotCode} and placed matching lots on hold` } };
  });
}
