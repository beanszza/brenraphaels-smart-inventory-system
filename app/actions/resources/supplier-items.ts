"use server";

import type { SupplierItemInput } from "@/lib/resources/inputs";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/portal/staff";
import { recordAudit, type AuditAction } from "@/lib/audit";
import { resourceResult, errorMessage } from "@/lib/resources/result";

export async function listSupplierItems(query = "") {
  await requireModule("Resources & Suppliers");

  try {
    const searchParams = new URLSearchParams(query);
    const itemId = searchParams.get("itemId") ? parseInt(searchParams.get("itemId")!, 10) : null;
    const supplierId = searchParams.get("supplierId") ? parseInt(searchParams.get("supplierId")!, 10) : null;

    const where: Prisma.SupplierItemsWhereInput = { IsActive: true };
    if (itemId) where.ItemId = itemId;
    if (supplierId) where.SupplierId = supplierId;

    const items = await prisma.supplierItems.findMany({
      where,
      include: {
        Suppliers: true,
        Items: { include: { UnitOfMeasures_Items_StockUomIdToUnitOfMeasures: true } },
        UnitOfMeasures: true,
      },
    });

    const data = items.map((si) => ({
      supplierId: si.SupplierId,
      supplierName: si.Suppliers?.CompanyName ?? "",
      itemId: si.ItemId,
      itemName: si.Items?.ItemName ?? "",
      supplierSku: si.SupplierSku ?? "",
      supplierItemName: si.SupplierItemName ?? "",
      unitPrice: Number(si.UnitPrice),
      currency: si.Currency,
      purchaseUomId: si.PurchaseUomId,
      purchaseUomAbbr: si.UnitOfMeasures?.Abbreviation ?? "",
      packSize: Number(si.PackSize),
      leadTimeDays: si.LeadTimeDays,
      minOrderQuantity: Number(si.MinOrderQuantity),
      isPreferred: si.IsPreferred,
      lastPurchasePrice: si.LastPurchasePrice ? Number(si.LastPurchasePrice) : null,
      lastPurchaseDate: si.LastPurchaseDate?.toISOString() ?? null,
      isActive: si.IsActive,
    }));

    return resourceResult({ success: true, data });
  } catch (error) {
    return resourceResult({ success: false, message: errorMessage(error) });
  }
}

export async function saveSupplierItem(body: SupplierItemInput) {
  const staff = await requireModule("Resources & Suppliers");

  try {
    const saved = await prisma.$transaction(async (tx) => {

      const existing = await tx.supplierItems.findUnique({
        where: { SupplierId_ItemId: { SupplierId: body.supplierId, ItemId: body.itemId } },
      });
      const change = existing ? "updated" : "created";
      // Upsert to handle re-activating an existing supplier-item link
      const si = await tx.supplierItems.upsert({
        where: { SupplierId_ItemId: { SupplierId: body.supplierId, ItemId: body.itemId } },
        update: {
          SupplierSku: body.supplierSku ?? null,
          SupplierItemName: body.supplierItemName ?? null,
          UnitPrice: body.unitPrice,
          Currency: body.currency ?? "PHP",
          PurchaseUomId: body.purchaseUomId,
          PackSize: body.packSize ?? 1,
          LeadTimeDays: body.leadTimeDays ?? 0,
          MinOrderQuantity: body.minOrderQuantity ?? 1,
          IsPreferred: body.isPreferred ?? false,
          IsActive: true,
        },
        create: {
          SupplierId: body.supplierId,
          ItemId: body.itemId,
          SupplierSku: body.supplierSku ?? null,
          SupplierItemName: body.supplierItemName ?? null,
          UnitPrice: body.unitPrice,
          Currency: body.currency ?? "PHP",
          PurchaseUomId: body.purchaseUomId,
          PackSize: body.packSize ?? 1,
          LeadTimeDays: body.leadTimeDays ?? 0,
          MinOrderQuantity: body.minOrderQuantity ?? 1,
          IsPreferred: body.isPreferred ?? false,
          IsActive: true,
        },
        include: { Suppliers: true, Items: true, UnitOfMeasures: true },
      });

      const audit = {
        module: "Resources & Suppliers", change,
        target: { type: "supplier-item", id: `${si.SupplierId}/${si.ItemId}`, name: `${si.Suppliers.CompanyName}: ${si.Items.ItemName}` },
        description: `${staff.name} ${change} supplier item ${si.Suppliers.CompanyName}: ${si.Items.ItemName}`,
      } satisfies AuditAction;

      return { result: resourceResult({ success: true, message: "Supplier item saved.", data: si }), audit };
    });
    if (saved.audit) await recordAudit(staff, saved.audit);
    return saved.result;
  } catch (error) {
    return resourceResult({ success: false, message: errorMessage(error) });
  }
}

export async function supplierItemsByItem(itemIdInput: string | number) {
  await requireModule("Resources & Suppliers");

  try {
    const itemId = parseInt(String(itemIdInput), 10);

    const items = await prisma.supplierItems.findMany({
      where: { ItemId: itemId, IsActive: true },
      include: {
        Suppliers: true,
        UnitOfMeasures: true,
        Items: true,
      },
      orderBy: [{ IsPreferred: "desc" }, { UnitPrice: "asc" }],
    });

    const data = items.map((si) => ({
      supplierId: si.SupplierId,
      supplierName: si.Suppliers?.CompanyName ?? "",
      itemId: si.ItemId,
      itemName: si.Items?.ItemName ?? "",
      supplierSku: si.SupplierSku ?? "",
      supplierItemName: si.SupplierItemName ?? "",
      unitPrice: Number(si.UnitPrice),
      currency: si.Currency,
      purchaseUomId: si.PurchaseUomId,
      purchaseUomAbbr: si.UnitOfMeasures?.Abbreviation ?? "",
      packSize: Number(si.PackSize),
      leadTimeDays: si.LeadTimeDays,
      minOrderQuantity: Number(si.MinOrderQuantity),
      isPreferred: si.IsPreferred,
      lastPurchasePrice: si.LastPurchasePrice ? Number(si.LastPurchasePrice) : null,
      lastPurchaseDate: si.LastPurchaseDate?.toISOString() ?? null,
      isActive: si.IsActive,
    }));

    return resourceResult({ success: true, data });
  } catch (error) {
    return resourceResult({ success: false, message: errorMessage(error) });
  }
}

export async function supplierItemsBySupplier(supplierIdInput: string | number) {
  await requireModule("Resources & Suppliers");

  try {
    const supplierId = parseInt(String(supplierIdInput), 10);

    const items = await prisma.supplierItems.findMany({
      where: { SupplierId: supplierId, IsActive: true },
      include: {
        Items: { include: { Category: true, UnitOfMeasures_Items_StockUomIdToUnitOfMeasures: true } },
        UnitOfMeasures: true,
      },
      orderBy: [{ IsPreferred: "desc" }, { Items: { ItemName: "asc" } }],
    });

    const data = items.map((si) => ({
      supplierId: si.SupplierId,
      itemId: si.ItemId,
      itemName: si.Items?.ItemName ?? "",
      itemCode: si.Items?.ItemCode ?? "",
      categoryName: si.Items?.Category?.CategoryName ?? "",
      supplierSku: si.SupplierSku ?? "",
      supplierItemName: si.SupplierItemName ?? "",
      unitPrice: Number(si.UnitPrice),
      currency: si.Currency,
      purchaseUomId: si.PurchaseUomId,
      purchaseUomAbbr: si.UnitOfMeasures?.Abbreviation ?? "",
      packSize: Number(si.PackSize),
      leadTimeDays: si.LeadTimeDays,
      minOrderQuantity: Number(si.MinOrderQuantity),
      isPreferred: si.IsPreferred,
      lastPurchasePrice: si.LastPurchasePrice ? Number(si.LastPurchasePrice) : null,
      lastPurchaseDate: si.LastPurchaseDate?.toISOString() ?? null,
      isActive: si.IsActive,
    }));

    return resourceResult({ success: true, data });
  } catch (error) {
    return resourceResult({ success: false, message: errorMessage(error) });
  }
}

export async function removeSupplierItem(supplierIdInput: string | number, itemIdInput: string | number) {
  const staff = await requireModule("Resources & Suppliers");

  try {
    const saved = await prisma.$transaction(async (tx) => {
      const supplierId = parseInt(String(supplierIdInput), 10);
      const itemId = parseInt(String(itemIdInput), 10);

      // Soft delete — set IsActive = false
      await tx.supplierItems.update({
        where: { SupplierId_ItemId: { SupplierId: supplierId, ItemId: itemId } },
        data: { IsActive: false },
      });

      const audit = {
        module: "Resources & Suppliers", change: "deleted",
        target: { type: "supplier-item", id: `${supplierId}/${itemId}`, name: `Supplier ${supplierId}, item ${itemId}` },
        description: `${staff.name} removed supplier ${supplierId} from item ${itemId}`,
      } satisfies AuditAction;

      return { result: resourceResult({ success: true, message: "Supplier item removed." }), audit };
    });
    if (saved.audit) await recordAudit(staff, saved.audit);
    return saved.result;
  } catch (error) {
    return resourceResult({ success: false, message: errorMessage(error) });
  }
}

