"use server";

import type { SupplierInput } from "@/lib/resources/inputs";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/portal/staff";
import { recordAudit, type AuditAction } from "@/lib/audit";
import { resourceResult, errorMessage } from "@/lib/resources/result";

export async function listSuppliers(query = "") {
  await requireModule("Resources & Suppliers");

  try {
    const searchParams = new URLSearchParams(query);
    const supplierName = searchParams.get("supplierName") || "";
    const isActiveParam = searchParams.get("isActive");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") || "10", 10)));

    const where: Prisma.SuppliersWhereInput = {};
    if (isActiveParam !== null && isActiveParam !== "") {
      where.IsActive = isActiveParam.toLowerCase() === "true";
    }

    if (supplierName) {
      const lowerSearch = supplierName.toLowerCase();
      where.OR = [
        { CompanyName: { contains: lowerSearch, mode: "insensitive" } },
        { SupplierCode: { contains: lowerSearch, mode: "insensitive" } },
        { ContactPerson: { contains: lowerSearch, mode: "insensitive" } },
        { Email: { contains: lowerSearch, mode: "insensitive" } },
      ];
      if (!isNaN(Number(lowerSearch))) {
        where.OR.push({ SupplierId: Number(lowerSearch) });
      }
    }

    const totalCount = await prisma.suppliers.count({ where });

    const suppliers = await prisma.suppliers.findMany({
      where,
      include: {
        SupplierItems: {
          include: { Items: true }
        }
      },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    const items = suppliers.map((s) => ({
      supplierId: s.SupplierId,
      supplierCode: s.SupplierCode,
      companyName: s.CompanyName,
      contactPerson: s.ContactPerson,
      email: s.Email,
      phone: s.Phone,
      address: s.Address,
      website: s.Website,
      isActive: s.IsActive,
      suppliedItems: s.SupplierItems.map((si) => ({
        itemId: si.ItemId,
        itemName: si.Items?.ItemName || "",
      }))
    }));

    return resourceResult({
      success: true,
      data: {
        items,
        totalCount,
        page,
        pageSize
      }
    });
  } catch (error) {
    console.error("Error fetching suppliers:", error);
    return resourceResult({ success: false, message: `An error occurred: ${errorMessage(error)}` });
  }
}

export async function createSupplier(body: SupplierInput) {
  const staff = await requireModule("Resources & Suppliers");

  try {
    const saved = await prisma.$transaction(async (tx) => {

      if (!body.companyName?.trim() || body.companyName.trim().length > 50) {
        return { result: resourceResult({ success: false, message: "Supplier Name is required and cannot exceed 50 characters." }), audit: undefined };
      }
      if (!body.contactPerson?.trim() || body.contactPerson.trim().length > 50) {
        return { result: resourceResult({ success: false, message: "Contact Person is required and cannot exceed 50 characters." }), audit: undefined };
      }
      if (/\d/.test(body.contactPerson)) {
        return { result: resourceResult({ success: false, message: "Contact Person cannot contain numbers." }), audit: undefined };
      }
      if (!body.email?.trim() || body.email.length > 50 || !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(body.email)) {
        return { result: resourceResult({ success: false, message: "Invalid email format (max 50 characters)." }), audit: undefined };
      }
      if (!body.phone?.trim() || body.phone.length > 50 || !/^[\+\d\s\-]{7,20}$/.test(body.phone)) {
        return { result: resourceResult({ success: false, message: "Invalid phone number format." }), audit: undefined };
      }
      if (!body.address?.trim() || body.address.length > 100) {
        return { result: resourceResult({ success: false, message: "Address is required and cannot exceed 100 characters." }), audit: undefined };
      }
      if (body.website?.trim() && body.website.length > 50) {
        return { result: resourceResult({ success: false, message: "Website cannot exceed 50 characters." }), audit: undefined };
      }

      const supplierExists = await tx.suppliers.findFirst({
        where: { CompanyName: { equals: body.companyName.trim(), mode: "insensitive" } }
      });
      if (supplierExists) {
        return { result: resourceResult({ success: false, message: "A supplier with this name already exists." }), audit: undefined };
      }

      const year = new Date().getFullYear();
      const seq = await tx.documentSequences.upsert({
        where: { DocType_Year: { DocType: "Supplier", Year: year } },
        update: { LastNumber: { increment: 1 } },
        create: { DocType: "Supplier", Year: year, LastNumber: 1 },
      });
      const supplierCode = `SUP-${year}-${String(seq.LastNumber).padStart(4, '0')}`;

      let supplierItemsData: Prisma.SupplierItemsUncheckedCreateWithoutSuppliersInput[] = [];
      if (body.suppliedItemIds && Array.isArray(body.suppliedItemIds) && body.suppliedItemIds.length > 0) {
        const items = await tx.items.findMany({
          where: { ItemId: { in: body.suppliedItemIds } }
        });
        supplierItemsData = items.map(item => ({
          ItemId: item.ItemId,
          PurchaseUomId: item.UomId,
          UnitPrice: 0,
          PackSize: 1,
          Currency: "PHP",
          LeadTimeDays: 0,
          MinOrderQuantity: 1,
          IsPreferred: false,
          IsActive: true,
        }));
      }

      const newSupplier = await tx.suppliers.create({
        data: {
          SupplierCode: supplierCode,
          CompanyName: body.companyName,
          ContactPerson: body.contactPerson,
          Email: body.email,
          Phone: body.phone,
          Address: body.address,
          Website: body.website || "",
          IsActive: body.isActive ?? true,
          SupplierItems: {
            create: supplierItemsData
          }
        },
        include: {
          SupplierItems: { include: { Items: true } }
        }
      });

      const response = {
        supplierId: newSupplier.SupplierId,
        supplierCode: newSupplier.SupplierCode,
        companyName: newSupplier.CompanyName,
        contactPerson: newSupplier.ContactPerson,
        email: newSupplier.Email,
        phone: newSupplier.Phone,
        address: newSupplier.Address,
        website: newSupplier.Website,
        isActive: newSupplier.IsActive,
        suppliedItems: newSupplier.SupplierItems.map(si => ({
          itemId: si.ItemId,
          itemName: si.Items?.ItemName || ""
        }))
      };

      const audit = {
        module: "Resources & Suppliers", change: "created",
        target: { type: "supplier", id: newSupplier.SupplierId, name: newSupplier.CompanyName },
        description: `${staff.name} created supplier ${newSupplier.CompanyName}`,
      } satisfies AuditAction;

      return { result: resourceResult({ success: true, message: "Supplier created successfully", data: response }), audit };
    });
    if (saved.audit) await recordAudit(staff, saved.audit);
    return saved.result;
  } catch (error) {
    console.error("Error creating supplier:", error);
    return resourceResult({ success: false, message: `An error occurred: ${errorMessage(error)}` });
  }
}

export async function getSupplier(idInput: string | number) {
  await requireModule("Resources & Suppliers");

  try {
    const id = parseInt(String(idInput), 10);
    const supplier = await prisma.suppliers.findUnique({
      where: { SupplierId: id },
      include: {
        SupplierItems: { include: { Items: true } }
      }
    });

    if (!supplier) {
      return resourceResult({ success: false, message: "Supplier not found" });
    }

    const response = {
      supplierId: supplier.SupplierId,
      supplierCode: supplier.SupplierCode,
      companyName: supplier.CompanyName,
      contactPerson: supplier.ContactPerson,
      email: supplier.Email,
      phone: supplier.Phone,
      address: supplier.Address,
      website: supplier.Website,
      isActive: supplier.IsActive,
      suppliedItems: supplier.SupplierItems.map(si => ({
        itemId: si.ItemId,
        itemName: si.Items?.ItemName || ""
      }))
    };

    return resourceResult({ success: true, data: response });
  } catch (error) {
    console.error("Error fetching supplier:", error);
    return resourceResult({ success: false, message: `An error occurred: ${errorMessage(error)}` });
  }
}

export async function updateSupplier(idInput: string | number, body: Partial<SupplierInput>) {
  const staff = await requireModule("Resources & Suppliers");

  try {
    const saved = await prisma.$transaction(async (tx) => {
      const id = parseInt(String(idInput), 10);

      const supplier = await tx.suppliers.findUnique({
        where: { SupplierId: id },
      });

      if (!supplier) {
        return { result: resourceResult({ success: false, message: "Supplier not found" }), audit: undefined };
      }

      if (body.companyName !== undefined) {
        if (!body.companyName.trim() || body.companyName.trim().length > 50) {
          return { result: resourceResult({ success: false, message: "Supplier Name cannot exceed 50 characters." }), audit: undefined };
        }

        const supplierExists = await tx.suppliers.findFirst({
          where: { CompanyName: { equals: body.companyName.trim(), mode: "insensitive" }, SupplierId: { not: id } }
        });
        if (supplierExists) {
          return { result: resourceResult({ success: false, message: "A supplier with this name already exists." }), audit: undefined };
        }
      }

      if (body.contactPerson !== undefined) {
        if (!body.contactPerson.trim() || body.contactPerson.trim().length > 50) {
          return { result: resourceResult({ success: false, message: "Contact Person cannot exceed 50 characters." }), audit: undefined };
        }
        if (/\d/.test(body.contactPerson)) {
          return { result: resourceResult({ success: false, message: "Contact Person cannot contain numbers." }), audit: undefined };
        }
      }

      if (body.email !== undefined) {
        if (body.email.length > 50 || !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(body.email)) {
          return { result: resourceResult({ success: false, message: "Invalid email format (max 50 characters)." }), audit: undefined };
        }
      }

      if (body.phone !== undefined) {
        if (body.phone.length > 50 || !/^[\+\d\s\-]{7,20}$/.test(body.phone)) {
          return { result: resourceResult({ success: false, message: "Invalid phone number format." }), audit: undefined };
        }
      }

      if (body.address !== undefined) {
        if (!body.address.trim() || body.address.length > 100) {
          return { result: resourceResult({ success: false, message: "Address cannot exceed 100 characters." }), audit: undefined };
        }
      }

      if (body.website !== undefined && body.website.length > 50) {
        return { result: resourceResult({ success: false, message: "Website cannot exceed 50 characters." }), audit: undefined };
      }

      const updateData: Prisma.SuppliersUpdateInput = {
        CompanyName: body.companyName !== undefined ? body.companyName : undefined,
        ContactPerson: body.contactPerson !== undefined ? body.contactPerson : undefined,
        Email: body.email !== undefined ? body.email : undefined,
        Phone: body.phone !== undefined ? body.phone : undefined,
        Address: body.address !== undefined ? body.address : undefined,
        Website: body.website !== undefined ? body.website : undefined,
        IsActive: body.isActive !== undefined ? body.isActive : undefined,
      };

      if (body.suppliedItemIds) {
        await tx.supplierItems.deleteMany({ where: { SupplierId: id } });
        const items = await tx.items.findMany({ where: { ItemId: { in: body.suppliedItemIds } } });

        await tx.suppliers.update({
          where: { SupplierId: id },
          data: {
            ...updateData,
            SupplierItems: {
              create: items.map(item => ({
                ItemId: item.ItemId,
                PurchaseUomId: item.UomId,
                UnitPrice: 0,
                PackSize: 1,
                Currency: "PHP",
                LeadTimeDays: 0,
                MinOrderQuantity: 1,
                IsPreferred: false,
                IsActive: true,
              }))
            }
          }
        });
      } else {
        await tx.suppliers.update({
          where: { SupplierId: id },
          data: updateData
        });
      }

      const updatedSupplier = await tx.suppliers.findUnique({
        where: { SupplierId: id },
        include: {
          SupplierItems: { include: { Items: true } }
        }
      });

      const response = {
        supplierId: updatedSupplier!.SupplierId,
        supplierCode: updatedSupplier!.SupplierCode,
        companyName: updatedSupplier!.CompanyName,
        contactPerson: updatedSupplier!.ContactPerson,
        email: updatedSupplier!.Email,
        phone: updatedSupplier!.Phone,
        address: updatedSupplier!.Address,
        website: updatedSupplier!.Website,
        isActive: updatedSupplier!.IsActive,
        suppliedItems: updatedSupplier!.SupplierItems.map(si => ({
          itemId: si.ItemId,
          itemName: si.Items?.ItemName || ""
        }))
      };

      const audit = {
        module: "Resources & Suppliers", change: "updated",
        target: { type: "supplier", id: updatedSupplier!.SupplierId, name: updatedSupplier!.CompanyName },
        description: `${staff.name} updated supplier ${updatedSupplier!.CompanyName}`,
      } satisfies AuditAction;

      return { result: resourceResult({ success: true, message: "Supplier updated successfully", data: response }), audit };
    });
    if (saved.audit) await recordAudit(staff, saved.audit);
    return saved.result;
  } catch (error) {
    console.error("Error updating supplier:", error);
    return resourceResult({ success: false, message: `An error occurred: ${errorMessage(error)}` });
  }
}

export async function deleteSupplier(idInput: string | number) {
  const staff = await requireModule("Resources & Suppliers");

  try {
    const saved = await prisma.$transaction(async (tx) => {
      const id = parseInt(String(idInput), 10);

      const supplier = await tx.suppliers.findUnique({
        where: { SupplierId: id },
      });

      if (!supplier) {
        return { result: resourceResult({ success: false, message: "Supplier not found." }), audit: undefined };
      }

      await tx.supplierItems.deleteMany({ where: { SupplierId: id } });
      await tx.suppliers.delete({ where: { SupplierId: id } });

      const audit = {
        module: "Resources & Suppliers", change: "deleted",
        target: { type: "supplier", id: supplier.SupplierId, name: supplier.CompanyName },
        description: `${staff.name} deleted supplier ${supplier.CompanyName}`,
      } satisfies AuditAction;

      return { result: resourceResult({ success: true, message: "Supplier deleted successfully" }), audit };
    });
    if (saved.audit) await recordAudit(staff, saved.audit);
    return saved.result;
  } catch (error) {
    console.error("Error deleting supplier:", error);
    return resourceResult({ success: false, message: `An error occurred: ${errorMessage(error)}` });
  }
}

