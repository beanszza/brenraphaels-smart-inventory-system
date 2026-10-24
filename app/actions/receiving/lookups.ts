"use server";

import { requireModule } from "@/lib/portal/staff";
import { prisma } from "@/lib/prisma";
import { resourceResult } from "@/lib/resources/result";
import { read } from "@/lib/receiving/mutate";

// Receiving staff need these choices without also holding Resources & Suppliers or Inventory.
export async function listItemChoices() {
  await requireModule("Goods Receiving");
  return read(async () => {
    const items = await prisma.items.findMany({ select: { ItemId: true, ItemName: true, Category: { select: { CategoryName: true } } } });
    return resourceResult({ success: true, data: items.map(item => ({ itemId: item.ItemId, itemName: item.ItemName, categoryName: item.Category.CategoryName })) });
  });
}

export async function listStockBalances() {
  await requireModule("Goods Receiving");
  return read(async () => {
    const balances = await prisma.inventories.groupBy({ by: ["ItemId"], _sum: { CurrentStock: true } });
    return resourceResult({ success: true, data: balances.map(row => ({ itemId: row.ItemId, currentStock: Number(row._sum.CurrentStock || 0) })) });
  });
}

export async function listReceivingLocations() {
  await requireModule("Goods Receiving");
  return read(async () => {
    const locations = await prisma.locations.findMany({ where: { IsActive: true }, select: { LocationId: true, LocationName: true, LocationType: true } });
    return resourceResult({ success: true, data: locations.map(row => ({ locationId: row.LocationId, locationName: row.LocationName, locationType: row.LocationType })) });
  });
}

export async function getReceivingCounts() {
  await requireModule("Goods Receiving");
  return read(async () => {
    const [grn, discrepancies, stockin, rtv, loss] = await Promise.all([
      prisma.deliveries.count({ where: { Status: "Arrived", GoodsReceipts: { none: { Status: { not: "Draft" } } } } }),
      prisma.discrepancies.count({ where: { Status: "Open" } }),
      prisma.stockIns.count({ where: { Status: { in: ["PendingApproval", "Pending"] } } }),
      prisma.returnToVendors.count({ where: { Status: { in: ["PendingApproval", "Pending Approval"] } } }),
      prisma.lossReports.count({ where: { IsAcknowledged: false } }),
    ]);
    return resourceResult({ success: true, data: { grn, discrepancies, stockin, rtv, loss } });
  });
}
