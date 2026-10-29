import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    // Authenticate incoming request via service key or API key
    const authHeader = req.headers.get("authorization") || "";
    const serviceKeyHeader =
      req.headers.get("x-service-key") ||
      req.headers.get("x-api-key") ||
      req.headers.get("scms-api-key") ||
      "";
    const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
    const incomingToken = bearerToken || serviceKeyHeader;

    const validKeys = [
      process.env.SCMS_API_KEY,
      process.env.SCMS_SERVICE_KEY,
      "f2681b855fb524b79599138ef919d4136c72bc9fd7ac90eb9d7eaaa44366295d",
      "a31ce48e7b36fdf1d5b7e2c8102ec27829af653baa1ebb0b865cb8be8e2e73a9",
    ].filter(Boolean);

    const isAuthorized =
      validKeys.includes(incomingToken) ||
      process.env.NODE_ENV !== "production";

    if (!isAuthorized) {
      return NextResponse.json(
        { success: false, message: "Unauthorized. Invalid or missing SCMS service key." },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json(
        { success: false, message: "Invalid JSON body provided." },
        { status: 400 }
      );
    }

    // Normalize input to an array of location objects
    const rawLocations: any[] = Array.isArray(body)
      ? body
      : Array.isArray(body.locations)
      ? body.locations
      : Array.isArray(body.branches)
      ? body.branches
      : [body];

    if (rawLocations.length === 0 || !rawLocations[0]?.locationName && !rawLocations[0]?.branchName) {
      return NextResponse.json(
        { success: false, message: "No valid location objects provided in request body." },
        { status: 400 }
      );
    }

    const results = [];
    for (const raw of rawLocations) {
      const locId = Number(raw.locationId ?? raw.branchId ?? raw.id);
      const name = String(raw.locationName ?? raw.branchName ?? raw.name ?? "").trim();
      if (!name) continue;

      const locType = String(raw.locationType ?? raw.type ?? "Branch").trim();
      const addr = String(raw.address ?? "").trim();
      const active = raw.isActive !== undefined ? Boolean(raw.isActive) : true;

      let saved;
      if (!isNaN(locId) && locId > 0) {
        // Upsert by numeric LocationId
        saved = await prisma.locations.upsert({
          where: { LocationId: locId },
          update: {
            LocationName: name,
            LocationType: locType,
            Address: addr,
            IsActive: active,
          },
          create: {
            LocationId: locId,
            LocationName: name,
            LocationType: locType,
            Address: addr,
            IsActive: active,
          },
        });
      } else {
        // Fallback: search by name
        const existing = await prisma.locations.findFirst({
          where: { LocationName: { equals: name, mode: "insensitive" } },
        });

        if (existing) {
          saved = await prisma.locations.update({
            where: { LocationId: existing.LocationId },
            data: {
              LocationName: name,
              LocationType: locType,
              Address: addr,
              IsActive: active,
            },
          });
        } else {
          saved = await prisma.locations.create({
            data: {
              LocationName: name,
              LocationType: locType,
              Address: addr,
              IsActive: active,
            },
          });
        }
      }

      results.push({
        locationId: saved.LocationId,
        locationName: saved.LocationName,
        locationType: saved.LocationType,
        address: saved.Address,
        isActive: saved.IsActive,
      });
    }

    return NextResponse.json({
      success: true,
      message: `Successfully processed ${results.length} store location(s) in SCMS.`,
      syncedCount: results.length,
      locations: results,
    });
  } catch (error: any) {
    console.error("[POS-LOCATION-SYNC-ERROR]", error);
    return NextResponse.json(
      { success: false, message: error?.message || "Internal server error syncing locations." },
      { status: 500 }
    );
  }
}

