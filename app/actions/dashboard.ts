"use server";

import { prisma } from "@/lib/prisma";
import { requireShell } from "@/lib/portal/staff";
import type { Module } from "@/lib/portal/config";

export type DashboardSection = {
  module: Module;
  href: string;
  figures: { label: string; value: number }[];
};

/** Resolve current grants on every read, before touching any business data. */
export async function getDashboardData(): Promise<DashboardSection[]> {
  const { modules } = await requireShell("/");
  const sections: Promise<DashboardSection>[] = [];

  function add(module: Module, href: string, read: () => Promise<DashboardSection["figures"]>) {
    if (modules.includes(module)) {
      sections.push(read().then((figures) => ({ module, href, figures })));
    }
  }

  add("Resources & Suppliers", "/resources-suppliers", async () => {
    const [items, suppliers] = await Promise.all([
      prisma.items.count({ where: { IsActive: true } }),
      prisma.suppliers.count({ where: { IsActive: true } }),
    ]);
    return [{ label: "Active items", value: items }, { label: "Active suppliers", value: suppliers }];
  });
  add("Orders & Procurement", "/orders-procurement", async () => {
    const [requisitions, orders] = await Promise.all([
      prisma.purchaseRequisitions.count(),
      prisma.purchaseOrders.count(),
    ]);
    return [{ label: "Purchase requisitions", value: requisitions }, { label: "Purchase orders", value: orders }];
  });
  add("Goods Receiving", "/goods-receiving", async () => {
    const receipts = await prisma.goodsReceipts.count();
    return [{ label: "Goods receipts", value: receipts }];
  });
  add("Inventory", "/inventory", async () => {
    // Match the Inventory screen: low stock is evaluated per item/location balance.
    const [balances, lowStock] = await Promise.all([
      prisma.inventories.count(),
      prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*) AS count
        FROM "Inventories" AS inventory
        JOIN "Items" AS item ON item."ItemId" = inventory."ItemId"
        WHERE item."IsActive" = true
          AND inventory."CurrentStock" <= item."MinStockLevel"
      `,
    ]);
    return [{ label: "Inventory balances", value: balances }, { label: "Low stock balances", value: Number(lowStock[0].count) }];
  });
  add("Production & Quality", "/production-quality", async () => {
    const [requests, batches] = await Promise.all([
      prisma.productionRequests.count(),
      prisma.productionBatches.count(),
    ]);
    return [{ label: "Production requests", value: requests }, { label: "Production batches", value: batches }];
  });
  add("Stock Transfer", "/stock-transfer", async () => {
    const [requests, transfers] = await Promise.all([
      prisma.stockTransferRequests.count(),
      prisma.stockTransfers.count(),
    ]);
    return [{ label: "Transfer requests", value: requests }, { label: "Stock transfers", value: transfers }];
  });

  // A failed read reaches the route error boundary; it must never masquerade as zero.
  return Promise.all(sections);
}
