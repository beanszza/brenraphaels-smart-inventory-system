"use server";

import type { LocationInput } from "@/lib/resources/inputs";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/portal/staff";
import { recordAudit, type AuditAction } from "@/lib/audit";
import { resourceResult, errorMessage } from "@/lib/resources/result";

export async function listLocations() {
  await requireModule("Stock Transfer");

  try {
    const locations = await prisma.locations.findMany({
      where: { IsActive: true },
      orderBy: { LocationName: "asc" },
    });

    const data = locations.map((loc) => ({
      locationId: loc.LocationId,
      locationName: loc.LocationName,
      locationType: loc.LocationType,
      status: loc.Status,
      address: loc.Address,
      isSystemLocation: loc.IsSystemLocation,
      parentLocationId: loc.ParentLocationId ?? null,
    }));

    return resourceResult({ success: true, data });
  } catch (error) {
    return resourceResult({ success: false, message: errorMessage(error) });
  }
}

export async function createLocation(body: LocationInput) {
  const staff = await requireModule("Stock Transfer");

  try {
    const saved = await prisma.$transaction(async (tx) => {

      if (!body || typeof body.locationName !== "string" || !body.locationName.trim()) throw new Error("Enter a location name.");
      const loc = await tx.locations.create({
        data: {
          LocationName: body.locationName,
          LocationType: body.locationType ?? "Warehouse",
          Status: body.status ?? "Active",
          Address: body.address ?? "",
          IsActive: true,
          IsSystemLocation: false,
          ParentLocationId: body.parentLocationId ?? null,
        },
      });

      const audit = {
        module: "Stock Transfer", change: "created",
        target: { type: "location", id: loc.LocationId, name: loc.LocationName },
        description: `${staff.name} created location ${loc.LocationName}`,
      } satisfies AuditAction;

      return { result: resourceResult({
        success: true,
        message: "Location created.",
        data: {
          locationId: loc.LocationId,
          locationName: loc.LocationName,
          locationType: loc.LocationType,
        },
      }), audit };
    }, { isolationLevel: "Serializable" });
    if (saved.audit) await recordAudit(staff, saved.audit);
    return saved.result;
  } catch (error) {
    return resourceResult({ success: false, message: errorMessage(error) });
  }
}

export async function updateLocation(idInput: string | number, body: Partial<LocationInput>) {
  const staff = await requireModule("Stock Transfer");

  try {
    const saved = await prisma.$transaction(async (tx) => {
      const id = Number(idInput);
      if (!Number.isSafeInteger(id) || id <= 0) throw new Error("Invalid location.");

      const loc = await tx.locations.update({
        where: { LocationId: id },
        data: {
          LocationName: body.locationName,
          LocationType: body.locationType,
          Status: body.status,
          Address: body.address,
          IsActive: body.isActive ?? true,
        },
      });

      const audit = {
        module: "Stock Transfer", change: "updated",
        target: { type: "location", id: loc.LocationId, name: loc.LocationName },
        description: `${staff.name} updated location ${loc.LocationName}`,
      } satisfies AuditAction;

      return { result: resourceResult({ success: true, data: loc }), audit };
    }, { isolationLevel: "Serializable" });
    if (saved.audit) await recordAudit(staff, saved.audit);
    return saved.result;
  } catch (error) {
    return resourceResult({ success: false, message: errorMessage(error) });
  }
}

