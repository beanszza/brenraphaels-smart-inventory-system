"use server";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/portal/staff";
import type { Staff } from "@/lib/portal/client";
import { isAdminStaff, isImsManager } from "@/lib/auth-roles";
import { resourceResult } from "@/lib/resources/result";
import { auditVersion, recordAudit } from "@/lib/audit";
import { mutate, read, refuse, positiveId } from "@/lib/inventory/mutate";
import { decodeCategoryDescription } from "@/lib/resources-suppliers/category-status";
import {
  validateSwoInput,
  hasAnySwoErrors,
  firstSwoErrorMessage,
  SWO_ACTION_NOTE_MAX,
  SWO_MAX_PHOTOS_PER_ITEM,
  type SwoCreateInput,
  type LotAvailabilityMap,
} from "@/lib/inventory/write-off-validation";
import {
  notifyWriteOffApprovalRequested,
  notifyWriteOffRequester,
} from "@/lib/inventory/write-off-notify";
import {
  confirmAndLink,
  FileError,
  requestUpload,
  resolveFile,
  MAX_FILE_BYTES,
} from "@/lib/files";
import { writeOffPhotoTarget } from "@/lib/file-routes";
import { filesGateway } from "@/lib/gateway/files";
import type {
  StockWriteOffDto,
  SwoStatus,
  WriteOffFormData,
  WriteOffFormItemOption,
  WriteOffFormLotOption,
} from "@/components/inventory/write-off/types";

const MODULE = "Inventory";
const DOC_TYPE = "StockWriteOff";

function requireWriteOffViewer(staff: Staff) {
  if (!isAdminStaff(staff) && !isImsManager(staff)) {
    refuse("Only the Inventory Manager and Administrator can access Stock Write-Off.");
  }
}

function requireImsManagerRole(staff: Staff) {
  if (!isImsManager(staff)) {
    refuse("Only the Inventory Manager can perform this action.");
  }
}

function requireAdminRole(staff: Staff) {
  if (!isAdminStaff(staff)) {
    refuse("Only the Administrator can approve or reject Stock Write-Off requests.");
  }
}

function formatSwoNumber(year: number, seqNumber: number): string {
  return `SWO-${year}-${String(seqNumber).padStart(4, "0")}`;
}

const WRITE_OFF_INCLUDE = {
  StockWriteOffItems: {
    orderBy: { WriteOffItemId: "asc" as const },
    include: {
      StockWriteOffLines: {
        orderBy: { LineId: "asc" as const },
      },
      StockWriteOffPhotos: {
        orderBy: { PhotoId: "asc" as const },
      },
    },
  },
} satisfies Prisma.StockWriteOffsInclude;

type RawWriteOff = Prisma.StockWriteOffsGetPayload<{ include: typeof WRITE_OFF_INCLUDE }>;

function mapWriteOff(row: RawWriteOff): StockWriteOffDto {
  return {
    writeOffId: row.WriteOffId,
    swoNumber: row.SwoNumber,
    status: row.Status as SwoStatus,
    requestedBy: row.RequestedBy,
    requestedByName: row.RequestedByName || row.RequestedBy,
    requestedAt: row.RequestedAt.toISOString(),
    generalRemarks: row.GeneralRemarks ?? null,
    approvedBy: row.ApprovedBy ?? null,
    approvedByName: row.ApprovedByName ?? null,
    approvedAt: row.ApprovedAt ? row.ApprovedAt.toISOString() : null,
    approvalNotes: row.ApprovalNotes ?? null,
    rejectedBy: row.RejectedBy ?? null,
    rejectedByName: row.RejectedByName ?? null,
    rejectedAt: row.RejectedAt ? row.RejectedAt.toISOString() : null,
    rejectionReason: row.RejectionReason ?? null,
    cancelledBy: row.CancelledBy ?? null,
    cancelledByName: row.CancelledByName ?? null,
    cancelledAt: row.CancelledAt ? row.CancelledAt.toISOString() : null,
    cancelReason: row.CancelReason ?? null,
    removedBy: row.RemovedBy ?? null,
    removedByName: row.RemovedByName ?? null,
    removedAt: row.RemovedAt ? row.RemovedAt.toISOString() : null,
    totalValue: Number(row.TotalValue || 0),
    updatedAt: row.UpdatedAt.toISOString(),
    items: (row.StockWriteOffItems || []).map((item) => ({
      writeOffItemId: item.WriteOffItemId,
      writeOffId: item.WriteOffId,
      itemId: item.ItemId,
      productId: item.ProductId ?? null,
      itemType: item.ItemType,
      itemName: item.ItemName,
      itemCode: item.ItemCode,
      variantName: item.VariantName,
      uomId: item.UomId,
      uomName: item.UomName,
      hasExpiry: Boolean(item.HasExpiry),
      lines: (item.StockWriteOffLines || []).map((line) => {
        const qty = Number(line.Quantity || 0);
        const unitCost = Number(line.UnitCost || 0);
        return {
          lineId: line.LineId,
          writeOffItemId: line.WriteOffItemId,
          lotId: line.LotId,
          lotCode: line.LotCode,
          expiryDate: line.ExpiryDate ? line.ExpiryDate.toISOString().split("T")[0] : null,
          availableBefore: Number(line.AvailableBefore || 0),
          quantity: qty,
          unitCost,
          lineValue: Number((qty * unitCost).toFixed(4)),
          reason: line.Reason,
          reasonOther: line.ReasonOther ?? null,
          disposition: line.Disposition,
          dispositionOther: line.DispositionOther ?? null,
          remarks: line.Remarks || "",
          ledgerId: line.LedgerId ? String(line.LedgerId) : null,
        };
      }),
      photos: (item.StockWriteOffPhotos || []).map((p) => ({
        photoId: p.PhotoId,
        writeOffItemId: p.WriteOffItemId,
        fileId: p.FileId,
        fileName: p.FileName,
        contentType: p.ContentType,
        fileSize: p.FileSize,
        uploadedAt: p.UploadedAt.toISOString(),
      })),
    })),
  };
}

export async function listWriteOffs() {
  const staff = await requireModule(MODULE);
  return read(async () => {
    requireWriteOffViewer(staff);
    if (typeof (prisma as any)?.stockWriteOffs?.findMany !== "function") {
      return resourceResult({ success: true, data: [] });
    }
    const rows = await prisma.stockWriteOffs.findMany({
      orderBy: [{ RequestedAt: "desc" }, { WriteOffId: "desc" }],
      include: WRITE_OFF_INCLUDE,
    });
    return resourceResult({
      success: true,
      data: rows.map(mapWriteOff),
    });
  });
}

export async function getWriteOffFormData() {
  const staff = await requireModule(MODULE);
  return read(async () => {
    requireWriteOffViewer(staff);

    const year = new Date().getFullYear();
    const [seq, categoryRows, lots, pendingLines] = await Promise.all([
      prisma.documentSequences
        .findUnique({
          where: { DocType_Year: { DocType: DOC_TYPE, Year: year } },
        })
        .catch(() => null),
      prisma.categories.findMany({
        orderBy: { CategoryName: "asc" },
      }),
      prisma.inventoryLots.findMany({
        where: {
          Status: { in: ["Available", "Active"] },
          QuantityRemaining: { gt: 0 },
        },
        include: {
          Items: {
            include: {
              Category: true,
              Uom: true,
              UnitOfMeasures_Items_StockUomIdToUnitOfMeasures: true,
              FinishedProducts: true,
            },
          },
          UnitOfMeasures: true,
        },
        orderBy: [{ ExpiryDate: "asc" }, { LotId: "asc" }],
      }),
      (async () => {
        try {
          if (typeof prisma?.stockWriteOffLines?.groupBy !== "function") return [];
          return await prisma.stockWriteOffLines.groupBy({
            by: ["LotId"],
            where: {
              StockWriteOffItems: {
                StockWriteOffs: {
                  Status: { in: ["Pending Approval", "Approved"] },
                },
              },
            },
            _sum: { Quantity: true },
          });
        } catch {
          return [];
        }
      })(),
    ]);

    const nextSeq = (seq?.LastNumber ?? 0) + 1;
    const nextSwoNumberPreview = formatSwoNumber(year, nextSeq);

    const pendingByLot = new Map<number, number>();
    for (const row of pendingLines) {
      pendingByLot.set(row.LotId, Number(row._sum.Quantity || 0));
    }

    // Build item types list from active non-finished categories + Finished Goods
    const itemTypesMap = new Map<string, boolean>();
    for (const cat of categoryRows) {
      const decoded = decodeCategoryDescription(cat.Description, (cat as any).IsActive);
      if (!decoded.isActive) continue;
      if (cat.CategoryName.toLowerCase().includes("finished")) continue;
      itemTypesMap.set(cat.CategoryName, Boolean(cat.HasExpiry ?? true));
    }

    const now = new Date();
    const itemsMap = new Map<string, WriteOffFormItemOption>();

    for (const lot of lots) {
      const item = lot.Items;
      if (!item || !item.IsActive) continue;

      // Skip seeded demo/test lots if any
      if (
        typeof lot.LotCode === "string" &&
        (lot.LotCode.startsWith("LOT-UJH-2026-") || lot.LotCode.startsWith("LOT-UBH-2026-"))
      ) {
        continue;
      }

      const remaining = Number(lot.QuantityRemaining || 0);
      const reserved = Number(lot.ReservedQuantity || 0);
      const pending = pendingByLot.get(lot.LotId) || 0;
      const available = Number(Math.max(0, remaining - reserved - pending).toFixed(3));
      if (available <= 0) continue;

      const rawCatName = item.Category?.CategoryName || "Uncategorized";
      const fp = (item as any).FinishedProducts?.[0] ?? null;
      const isFinishedGood =
        rawCatName.toLowerCase().includes("finished") || Boolean(fp);
      const itemType = isFinishedGood ? "Finished Goods" : rawCatName;
      const hasExpiry = isFinishedGood
        ? true
        : Boolean(item.Category?.HasExpiry ?? true);

      if (!itemTypesMap.has(itemType) && !isFinishedGood) {
        itemTypesMap.set(itemType, hasExpiry);
      }

      const productId = fp?.ProductId ?? null;
      const variantName = fp?.Variant || "";
      const itemKey = isFinishedGood && productId ? `fg:${productId}` : `item:${item.ItemId}`;
      const uom =
        lot.UnitOfMeasures ??
        item.UnitOfMeasures_Items_StockUomIdToUnitOfMeasures ??
        item.Uom;
      const uomId = uom?.UomId ?? item.UomId;
      const uomName = uom?.Abbreviation || uom?.Name || "Unit";
      const itemCode =
        isFinishedGood && fp?.Sku
          ? fp.Sku
          : item.ItemCode || `SPL-${String(item.ItemId).padStart(4, "0")}`;
      const displayLabel =
        isFinishedGood && variantName
          ? `${item.ItemName} — ${variantName} (${itemCode})`
          : `${item.ItemName} (${itemCode})`;

      const expiryStr =
        hasExpiry && lot.ExpiryDate ? lot.ExpiryDate.toISOString().split("T")[0] : null;
      const isExpired = expiryStr ? new Date(expiryStr).getTime() < now.getTime() : false;

      const lotOption: WriteOffFormLotOption = {
        lotId: lot.LotId,
        lotCode: lot.LotCode,
        itemId: item.ItemId,
        productId,
        variantName,
        expiryDate: expiryStr,
        quantityRemaining: remaining,
        reservedQuantity: reserved,
        pendingWriteOffQuantity: pending,
        availableQuantity: available,
        unitCost: Number(lot.UnitCost || 0),
        uomId,
        uomName,
        isExpired,
      };

      const existing = itemsMap.get(itemKey);
      if (existing) {
        existing.lots.push(lotOption);
      } else {
        itemsMap.set(itemKey, {
          key: itemKey,
          itemId: item.ItemId,
          productId,
          itemType,
          itemName: item.ItemName,
          itemCode,
          variantName,
          displayLabel,
          uomId,
          uomName,
          hasExpiry: hasExpiry && Boolean(expiryStr || isFinishedGood || item.Category?.HasExpiry !== false),
          lots: [lotOption],
        });
      }
    }

    // Always include Finished Goods in itemTypes
    itemTypesMap.set("Finished Goods", true);

    const data: WriteOffFormData = {
      nextSwoNumberPreview,
      itemTypes: Array.from(itemTypesMap.entries()).map(([name, hasExpiry]) => ({
        name,
        hasExpiry,
      })),
      items: Array.from(itemsMap.values()).sort((a, b) =>
        a.displayLabel.localeCompare(b.displayLabel)
      ),
    };

    return resourceResult({ success: true, data });
  });
}

export async function createWriteOff(body: SwoCreateInput) {
  const staff = await requireModule(MODULE);
  return mutate(
    staff,
    async (tx) => {
      requireImsManagerRole(staff);

      // First-pass structural validation
      const initialErrors = validateSwoInput(body);
      if (hasAnySwoErrors(initialErrors)) {
        refuse(firstSwoErrorMessage(initialErrors) || "Please fix the validation errors.");
      }

      // Collect all requested lot IDs and verify live availability inside the Serializable tx
      const requestedLotIds = body.items.flatMap((it) => it.lots.map((l) => Number(l.lotId)));
      const [dbLots, pendingLines] = await Promise.all([
        tx.inventoryLots.findMany({
          where: { LotId: { in: requestedLotIds } },
          include: {
            Items: {
              include: {
                Category: true,
                Uom: true,
                UnitOfMeasures_Items_StockUomIdToUnitOfMeasures: true,
                FinishedProducts: true,
              },
            },
            UnitOfMeasures: true,
          },
        }),
        (async () => {
          try {
            if (typeof tx?.stockWriteOffLines?.groupBy !== "function") return [];
            return await tx.stockWriteOffLines.groupBy({
              by: ["LotId"],
              where: {
                LotId: { in: requestedLotIds },
                StockWriteOffItems: {
                  StockWriteOffs: {
                    Status: { in: ["Pending Approval", "Approved"] },
                  },
                },
              },
              _sum: { Quantity: true },
            });
          } catch {
            return [];
          }
        })(),
      ]);

      const pendingMap = new Map<number, number>();
      for (const p of pendingLines) {
        pendingMap.set(p.LotId, Number(p._sum.Quantity || 0));
      }

      const lotAvailability: LotAvailabilityMap = {};
      const dbLotById = new Map<number, (typeof dbLots)[number]>();
      for (const lot of dbLots) {
        if (!["Available", "Active"].includes(lot.Status)) continue;
        const remaining = Number(lot.QuantityRemaining || 0);
        const reserved = Number(lot.ReservedQuantity || 0);
        const pending = pendingMap.get(lot.LotId) || 0;
        const available = Number(Math.max(0, remaining - reserved - pending).toFixed(3));
        const uom =
          lot.UnitOfMeasures ??
          lot.Items?.UnitOfMeasures_Items_StockUomIdToUnitOfMeasures ??
          lot.Items?.Uom;
        const fp = (lot.Items as any)?.FinishedProducts?.[0] ?? null;

        lotAvailability[lot.LotId] = {
          availableQuantity: available,
          uomName: uom?.Abbreviation || uom?.Name || "Unit",
          lotCode: lot.LotCode,
          itemId: lot.ItemId,
          productId: fp?.ProductId ?? null,
        };
        dbLotById.set(lot.LotId, lot);
      }

      // Full validation with live lot availability
      const fullErrors = validateSwoInput(body, lotAvailability);
      if (hasAnySwoErrors(fullErrors)) {
        refuse(firstSwoErrorMessage(fullErrors) || "Write-off validation failed.");
      }

      // Generate unique SWO number from DocumentSequences (never reused even if rejected/cancelled)
      const now = new Date();
      const year = now.getFullYear();
      const seq = await tx.documentSequences.upsert({
        where: { DocType_Year: { DocType: DOC_TYPE, Year: year } },
        update: { LastNumber: { increment: 1 } },
        create: { DocType: DOC_TYPE, Year: year, LastNumber: 1 },
      });
      const swoNumber = formatSwoNumber(year, seq.LastNumber);

      let totalValue = 0;
      const itemsToCreate: Prisma.StockWriteOffItemsCreateWithoutStockWriteOffsInput[] = [];

      for (const itemInput of body.items) {
        const firstLot = dbLotById.get(Number(itemInput.lots[0].lotId))!;
        const dbItem = firstLot.Items;
        const fp = (dbItem as any)?.FinishedProducts?.[0] ?? null;
        const isFinishedGood =
          itemInput.itemType.trim().toLowerCase() === "finished goods" || Boolean(fp);
        const hasExpiry = isFinishedGood
          ? true
          : Boolean(dbItem?.Category?.HasExpiry ?? dbItem?.IsExpiryTracked ?? true);
        const uom =
          firstLot.UnitOfMeasures ??
          dbItem?.UnitOfMeasures_Items_StockUomIdToUnitOfMeasures ??
          dbItem?.Uom;
        const uomId = uom?.UomId ?? firstLot.UomId;
        const uomName = uom?.Abbreviation || uom?.Name || "Unit";
        const itemCode =
          isFinishedGood && fp?.Sku
            ? fp.Sku
            : dbItem?.ItemCode || `SPL-${String(dbItem.ItemId).padStart(4, "0")}`;

        const linesToCreate: Prisma.StockWriteOffLinesCreateWithoutStockWriteOffItemsInput[] = [];

        for (const lotInput of itemInput.lots) {
          const lotRow = dbLotById.get(Number(lotInput.lotId))!;
          const availInfo = lotAvailability[lotRow.LotId];
          const qty = Number(Number(lotInput.quantity).toFixed(3));
          const unitCost = Number(lotRow.UnitCost || 0);
          totalValue += qty * unitCost;

          linesToCreate.push({
            InventoryLots: { connect: { LotId: lotRow.LotId } },
            LotCode: lotRow.LotCode,
            ExpiryDate: hasExpiry ? lotRow.ExpiryDate : null,
            AvailableBefore: availInfo.availableQuantity,
            Quantity: qty,
            UnitCost: unitCost,
            Reason: lotInput.reason.trim(),
            ReasonOther:
              lotInput.reason.trim() === "Other" ? lotInput.reasonOther?.trim() || null : null,
            Disposition: lotInput.disposition.trim(),
            DispositionOther:
              lotInput.disposition.trim() === "Other"
                ? lotInput.dispositionOther?.trim() || null
                : null,
            Remarks: lotInput.remarks.trim(),
          });
        }

        itemsToCreate.push({
          Items: { connect: { ItemId: dbItem.ItemId } },
          ...(fp?.ProductId
            ? { FinishedProducts: { connect: { ProductId: fp.ProductId } } }
            : {}),
          ItemType: itemInput.itemType.trim(),
          ItemName: dbItem.ItemName,
          ItemCode: itemCode,
          VariantName: fp?.Variant || "",
          UnitOfMeasures: { connect: { UomId: uomId } },
          UomName: uomName,
          HasExpiry: hasExpiry,
          StockWriteOffLines: {
            create: linesToCreate,
          },
        });
      }

      const created = await tx.stockWriteOffs.create({
        data: {
          SwoNumber: swoNumber,
          Status: "Pending Approval",
          RequestedBy: staff.username,
          RequestedByName: staff.name || staff.username,
          RequestedAt: now,
          GeneralRemarks: body.generalRemarks?.trim() || null,
          TotalValue: Number(totalValue.toFixed(4)),
          UpdatedAt: now,
          StockWriteOffItems: {
            create: itemsToCreate,
          },
        },
        include: WRITE_OFF_INCLUDE,
      });

      const dto = mapWriteOff(created);
      return {
        result: resourceResult({
          success: true,
          message: `Stock Write-Off ${swoNumber} submitted for approval.`,
          data: dto,
        }),
        audit: {
          module: MODULE,
          action: "record.created",
          target: { type: "stock-write-off", id: created.WriteOffId, name: swoNumber },
          description: `${staff.name} submitted Stock Write-Off ${swoNumber} for approval`,
        },
        after: () => notifyWriteOffApprovalRequested(staff, swoNumber),
      };
    },
    {
      module: MODULE,
      action: "record.created",
      target: { type: "operation", id: "createWriteOff", name: "createWriteOff" },
      description: "Validation refused for createWriteOff",
      version: auditVersion([body]),
    }
  );
}

export async function approveWriteOff(idInput: string | number, notes?: string | null) {
  const staff = await requireModule(MODULE);
  return mutate(
    staff,
    async (tx) => {
      requireAdminRole(staff);
      const id = positiveId(idInput);
      const cleanNotes = (notes ?? "").trim();
      if (cleanNotes.length > SWO_ACTION_NOTE_MAX) {
        refuse(`Notes cannot exceed ${SWO_ACTION_NOTE_MAX} characters.`);
      }

      const existing = await tx.stockWriteOffs.findUnique({
        where: { WriteOffId: id },
      });
      if (!existing) refuse("Stock Write-Off request not found.");
      if (existing.Status !== "Pending Approval") {
        refuse(
          `Only requests in Pending Approval status can be approved. Current status: ${existing.Status}.`
        );
      }

      const now = new Date();
      const updated = await tx.stockWriteOffs.update({
        where: { WriteOffId: id },
        data: {
          Status: "Approved",
          ApprovedBy: staff.username,
          ApprovedByName: staff.name || staff.username,
          ApprovedAt: now,
          ApprovalNotes: cleanNotes || null,
          UpdatedAt: now,
        },
        include: WRITE_OFF_INCLUDE,
      });

      return {
        result: resourceResult({
          success: true,
          message: `Stock Write-Off ${updated.SwoNumber} approved.`,
          data: mapWriteOff(updated),
        }),
        audit: {
          module: MODULE,
          action: "record.updated",
          target: { type: "stock-write-off", id: updated.WriteOffId, name: updated.SwoNumber },
          description: `${staff.name} approved Stock Write-Off ${updated.SwoNumber}`,
        },
        after: () => notifyWriteOffRequester(updated.RequestedBy, "approved", updated.SwoNumber, staff),
      };
    },
    {
      module: MODULE,
      action: "record.updated",
      target: { type: "operation", id: String(idInput), name: "approveWriteOff" },
      description: "Validation refused for approveWriteOff",
      version: auditVersion([idInput, notes]),
    }
  );
}

export async function rejectWriteOff(idInput: string | number, reasonInput: string) {
  const staff = await requireModule(MODULE);
  return mutate(
    staff,
    async (tx) => {
      requireAdminRole(staff);
      const id = positiveId(idInput);
      const reason = (reasonInput ?? "").trim();
      if (!reason) refuse("A rejection reason is required.");
      if (reason.length > SWO_ACTION_NOTE_MAX) {
        refuse(`Rejection reason cannot exceed ${SWO_ACTION_NOTE_MAX} characters.`);
      }

      const existing = await tx.stockWriteOffs.findUnique({
        where: { WriteOffId: id },
      });
      if (!existing) refuse("Stock Write-Off request not found.");
      if (existing.Status !== "Pending Approval") {
        refuse(
          `Only requests in Pending Approval status can be rejected. Current status: ${existing.Status}.`
        );
      }

      const now = new Date();
      const updated = await tx.stockWriteOffs.update({
        where: { WriteOffId: id },
        data: {
          Status: "Rejected",
          RejectedBy: staff.username,
          RejectedByName: staff.name || staff.username,
          RejectedAt: now,
          RejectionReason: reason,
          UpdatedAt: now,
        },
        include: WRITE_OFF_INCLUDE,
      });

      return {
        result: resourceResult({
          success: true,
          message: `Stock Write-Off ${updated.SwoNumber} has been rejected. Number ${updated.SwoNumber} is now permanently retired.`,
          data: mapWriteOff(updated),
        }),
        audit: {
          module: MODULE,
          action: "record.updated",
          target: { type: "stock-write-off", id: updated.WriteOffId, name: updated.SwoNumber },
          description: `${staff.name} rejected Stock Write-Off ${updated.SwoNumber}: ${reason}`,
        },
        after: () => notifyWriteOffRequester(updated.RequestedBy, "rejected", updated.SwoNumber, staff),
      };
    },
    {
      module: MODULE,
      action: "record.updated",
      target: { type: "operation", id: String(idInput), name: "rejectWriteOff" },
      description: "Validation refused for rejectWriteOff",
      version: auditVersion([idInput, reasonInput]),
    }
  );
}

export async function cancelWriteOff(idInput: string | number, reasonInput: string) {
  const staff = await requireModule(MODULE);
  return mutate(
    staff,
    async (tx) => {
      requireImsManagerRole(staff);
      const id = positiveId(idInput);
      const reason = (reasonInput ?? "").trim();
      if (!reason) refuse("A cancellation reason is required.");
      if (reason.length > SWO_ACTION_NOTE_MAX) {
        refuse(`Cancellation reason cannot exceed ${SWO_ACTION_NOTE_MAX} characters.`);
      }

      const existing = await tx.stockWriteOffs.findUnique({
        where: { WriteOffId: id },
      });
      if (!existing) refuse("Stock Write-Off request not found.");
      if (existing.Status !== "Pending Approval") {
        refuse(
          `Only requests in Pending Approval status can be cancelled. Approved or processed requests cannot be cancelled.`
        );
      }

      const now = new Date();
      const updated = await tx.stockWriteOffs.update({
        where: { WriteOffId: id },
        data: {
          Status: "Cancelled",
          CancelledBy: staff.username,
          CancelledByName: staff.name || staff.username,
          CancelledAt: now,
          CancelReason: reason,
          UpdatedAt: now,
        },
        include: WRITE_OFF_INCLUDE,
      });

      return {
        result: resourceResult({
          success: true,
          message: `Stock Write-Off ${updated.SwoNumber} has been cancelled. Number ${updated.SwoNumber} is now permanently retired.`,
          data: mapWriteOff(updated),
        }),
        audit: {
          module: MODULE,
          action: "record.updated",
          target: { type: "stock-write-off", id: updated.WriteOffId, name: updated.SwoNumber },
          description: `${staff.name} cancelled Stock Write-Off ${updated.SwoNumber}: ${reason}`,
        },
      };
    },
    {
      module: MODULE,
      action: "record.updated",
      target: { type: "operation", id: String(idInput), name: "cancelWriteOff" },
      description: "Validation refused for cancelWriteOff",
      version: auditVersion([idInput, reasonInput]),
    }
  );
}

export async function removeWriteOffFromInventory(idInput: string | number) {
  const staff = await requireModule(MODULE);
  return mutate(
    staff,
    async (tx) => {
      requireImsManagerRole(staff);
      const id = positiveId(idInput);

      const writeOff = await tx.stockWriteOffs.findUnique({
        where: { WriteOffId: id },
        include: WRITE_OFF_INCLUDE,
      });

      if (!writeOff) refuse("Stock Write-Off request not found.");
      if (writeOff.Status === "Removed") {
        refuse(`Stock Write-Off ${writeOff.SwoNumber} has already been removed from inventory.`);
      }
      if (writeOff.Status !== "Approved") {
        refuse(
          `Only Approved Stock Write-Off requests can be removed from inventory. Current status: ${writeOff.Status}.`
        );
      }

      const now = new Date();

      // Re-verify all lots have sufficient unreserved quantity before deducting
      for (const item of writeOff.StockWriteOffItems) {
        for (const line of item.StockWriteOffLines) {
          const lot = await tx.inventoryLots.findUnique({
            where: { LotId: line.LotId },
          });
          if (!lot) {
            refuse(`Lot ${line.LotCode} for ${item.ItemName} no longer exists.`);
          }
          const remaining = Number(lot.QuantityRemaining || 0);
          const reserved = Number(lot.ReservedQuantity || 0);
          const unreserved = Number(Math.max(0, remaining - reserved).toFixed(3));
          const qtyToRemove = Number(line.Quantity || 0);

          if (qtyToRemove > unreserved + 1e-9) {
            refuse(
              `Insufficient unreserved stock on lot ${lot.LotCode} (${item.ItemName}). Needed: ${qtyToRemove} ${item.UomName}, currently unreserved: ${unreserved} ${item.UomName}.`
            );
          }

          const newRemaining = Number(Math.max(0, remaining - qtyToRemove).toFixed(3));

          // 1. Decrement InventoryLots.QuantityRemaining & mark Depleted if 0
          await tx.inventoryLots.update({
            where: { LotId: lot.LotId },
            data: {
              QuantityRemaining: { decrement: qtyToRemove },
              ...(newRemaining <= 0 ? { Status: "Depleted" } : {}),
            },
          });

          // 2. Decrement Inventories.CurrentStock for (ItemId, LocationId)
          const inv = await tx.inventories.findUnique({
            where: {
              ItemId_LocationId: {
                ItemId: item.ItemId,
                LocationId: lot.LocationId,
              },
            },
          });
          if (inv) {
            const nextStock = Math.max(0, Number(inv.CurrentStock) - qtyToRemove);
            await tx.inventories.update({
              where: {
                ItemId_LocationId: {
                  ItemId: item.ItemId,
                  LocationId: lot.LocationId,
                },
              },
              data: {
                CurrentStock: nextStock,
              },
            });
          }

          // 3. Create StockLedgers audit row
          const reasonLabel =
            line.Reason === "Other" && line.ReasonOther
              ? `Other (${line.ReasonOther})`
              : line.Reason;
          const dispositionLabel =
            line.Disposition === "Other" && line.DispositionOther
              ? `Other (${line.DispositionOther})`
              : line.Disposition;

          const ledger = await tx.stockLedgers.create({
            data: {
              LotId: lot.LotId,
              ItemId: item.ItemId,
              LocationId: lot.LocationId,
              MovementType: "WRITE_OFF",
              Quantity: -qtyToRemove,
              UomId: lot.UomId,
              UnitCost: lot.UnitCost,
              ReferenceType: "StockWriteOff",
              ReferenceId: writeOff.SwoNumber,
              UserId: staff.username,
              UserName: staff.name || staff.username,
              PostedAt: now,
              Notes: `Stock Write-Off ${writeOff.SwoNumber} — Reason: ${reasonLabel} | Disposition: ${dispositionLabel} | ${line.Remarks}`,
            },
          });

          // 4. Link ledger row back to the write-off line
          await tx.stockWriteOffLines.update({
            where: { LineId: line.LineId },
            data: { LedgerId: ledger.LedgerId },
          });
        }
      }

      const updated = await tx.stockWriteOffs.update({
        where: { WriteOffId: id },
        data: {
          Status: "Removed",
          RemovedBy: staff.username,
          RemovedByName: staff.name || staff.username,
          RemovedAt: now,
          UpdatedAt: now,
        },
        include: WRITE_OFF_INCLUDE,
      });

      return {
        result: resourceResult({
          success: true,
          message: `Items for ${updated.SwoNumber} have been removed from inventory.`,
          data: mapWriteOff(updated),
        }),
        audit: {
          module: MODULE,
          action: "record.updated",
          target: { type: "stock-write-off", id: updated.WriteOffId, name: updated.SwoNumber },
          description: `${staff.name} removed inventory items for Stock Write-Off ${updated.SwoNumber}`,
        },
      };
    },
    {
      module: MODULE,
      action: "record.updated",
      target: { type: "operation", id: String(idInput), name: "removeWriteOffFromInventory" },
      description: "Validation refused for removeWriteOffFromInventory",
      version: auditVersion([idInput]),
    }
  );
}

/**
 * Uploads an optional supporting evidence photo for a StockWriteOffItems record.
 * Uses the central files gateway when reachable; if the gateway is not yet available in local/dev,
 * falls back to storing a compact data URL so the photo can still be previewed.
 */
export async function uploadWriteOffPhotoDirect(writeOffItemIdInput: number, formData: FormData) {
  const staff = await requireModule(MODULE);
  requireWriteOffViewer(staff);
  const writeOffItemId = positiveId(writeOffItemIdInput);

  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    return resourceResult({ success: false, message: "No image file provided." });
  }

  let contentType = (file.type || "image/jpeg").toLowerCase();
  if (contentType === "image/jpg") contentType = "image/jpeg";
  if (!["image/jpeg", "image/png", "image/webp"].includes(contentType)) {
    return resourceResult({
      success: false,
      message: "Only JPG, PNG, or WEBP images are allowed.",
    });
  }

  if (file.size <= 0 || file.size > MAX_FILE_BYTES) {
    return resourceResult({
      success: false,
      message: "Each photo must be between 1 byte and 10 MB.",
    });
  }

  const itemExists = await prisma.stockWriteOffItems.findUnique({
    where: { WriteOffItemId: writeOffItemId },
    include: { _count: { select: { StockWriteOffPhotos: true } } },
  });
  if (!itemExists) {
    return resourceResult({ success: false, message: "Write-Off item not found." });
  }
  if (itemExists._count.StockWriteOffPhotos >= SWO_MAX_PHOTOS_PER_ITEM) {
    return resourceResult({
      success: false,
      message: `Maximum of ${SWO_MAX_PHOTOS_PER_ITEM} photos per item reached.`,
    });
  }

  const filename = (file.name || "evidence.jpg").slice(0, 250);
  const buffer = Buffer.from(await file.arrayBuffer());

  // Create placeholder photo row first so writeOffPhotoTarget has a record ID to link
  const createdPhoto = await prisma.stockWriteOffPhotos.create({
    data: {
      WriteOffItemId: writeOffItemId,
      FileId: "",
      FileName: filename,
      ContentType: contentType,
      FileSize: file.size,
    },
  });

  try {
    const address = await requestUpload(
      filesGateway,
      staff,
      {
        kind: "write-off-photo",
        filename,
        contentType,
        size: file.size,
      },
      writeOffPhotoTarget,
      createdPhoto.PhotoId
    );

    if (!address?.uploadUrl || !address?.id) {
      throw new Error("Invalid upload address from file gateway.");
    }

    const stored = await fetch(address.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": contentType },
      body: buffer,
    });

    if (!stored.ok) {
      throw new Error(`Storage upload failed with status ${stored.status}`);
    }

    await confirmAndLink(filesGateway, staff, writeOffPhotoTarget, createdPhoto.PhotoId, address.id);

    await recordAudit(staff, {
      module: MODULE,
      action: "record.updated",
      version: auditVersion(address.id),
      target: {
        type: "stock-write-off-photo",
        id: createdPhoto.PhotoId,
        name: filename,
      },
      description: `${staff.name} uploaded evidence photo ${filename} for write-off item ${writeOffItemId}`,
    });

    return resourceResult({
      success: true,
      data: { photoId: createdPhoto.PhotoId, fileId: address.id, fileName: filename },
    });
  } catch (error) {
    // If the external file storage microservice is not yet online, store data URL when <= 2MB so user evidence isn't lost
    if (file.size <= 2 * 1024 * 1024) {
      const dataUrl = `data:${contentType};base64,${buffer.toString("base64")}`;
      await prisma.stockWriteOffPhotos.update({
        where: { PhotoId: createdPhoto.PhotoId },
        data: { FileId: dataUrl },
      });
      return resourceResult({
        success: true,
        data: { photoId: createdPhoto.PhotoId, fileId: dataUrl, fileName: filename },
      });
    }

    await prisma.stockWriteOffPhotos.delete({ where: { PhotoId: createdPhoto.PhotoId } }).catch(() => {});
    console.warn("Write-off photo upload failed:", error);
    return resourceResult({
      success: false,
      message:
        error instanceof FileError
          ? error.message
          : "The file storage service could not be reached for this photo.",
    });
  }
}

export async function resolveWriteOffPhoto(photoIdInput: number) {
  const staff = await requireModule(MODULE);
  return read(async () => {
    requireWriteOffViewer(staff);
    const photoId = positiveId(photoIdInput);
    const photo = await prisma.stockWriteOffPhotos.findUnique({
      where: { PhotoId: photoId },
    });
    if (!photo) {
      return resourceResult({ success: false, message: "Photo not found." });
    }
    if (photo.FileId.startsWith("data:image/")) {
      return resourceResult({
        success: true,
        data: { kind: "file" as const, url: photo.FileId, private: false as const },
      });
    }
    const resolved = await resolveFile(filesGateway, staff, photo.FileId);
    return resourceResult({ success: true, data: resolved });
  });
}
