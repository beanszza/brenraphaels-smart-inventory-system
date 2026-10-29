"use server";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/portal/staff";
import { resourceResult, errorMessage } from "@/lib/resources/result";

export async function supplierItemsByItem(itemIdInput: string | number) {
  await requireModule("Orders & Procurement");

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
      email: si.Suppliers?.Email ?? "",
      contactPerson: si.Suppliers?.ContactPerson ?? "",
      phone: si.Suppliers?.Phone ?? "",
      address: si.Suppliers?.Address ?? "",
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
  await requireModule("Orders & Procurement");

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

