"use server";

import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/portal/staff";
import { resourceResult, errorMessage } from "@/lib/resources/result";
import { syncProductToPos, fetchLocationsFromPos } from "@/lib/pos/client";
import { SyncProductDto, PosVariationDto } from "@/lib/pos/types";

function parseVariantParts(variantStr?: string | null): { packagingType: string; size: string } {
  if (!variantStr) return { packagingType: "Tub", size: "Standard" };
  const parts = variantStr.trim().split(/\s+/);
  if (parts.length === 1) {
    return { packagingType: "Tub", size: parts[0] };
  }
  const size = parts[0];
  const packagingType = parts.slice(1).join(" ");
  return { packagingType, size };
}

/**
 * Syncs a single finished product (including all its variations) to the POS system.
 */
export async function syncProductCatalogToPos(productName: string) {
  await requireModule("Production & Quality");

  try {
    const trimmed = productName.trim();
    if (!trimmed) {
      return resourceResult({ success: false, message: "Product name is required for POS sync." });
    }

    const items = await prisma.finishedProducts.findMany({
      where: {
        Items: { ItemName: { equals: trimmed, mode: "insensitive" } },
      },
      include: {
        Items: {
          include: {
            Category: true,
          },
        },
      },
      orderBy: { ProductId: "asc" },
    });

    if (items.length === 0) {
      return resourceResult({
        success: false,
        message: `No product variations found for "${trimmed}".`,
      });
    }

    const first = items[0];
    const scmsProductId =
      first.Items?.ItemCode?.trim() || `SCM-PRD-${String(first.ProductId).padStart(4, "0")}`;
    const categoryName = first.Items?.Category?.CategoryName || "Finished Goods";

    const variations: PosVariationDto[] = items.map((fp) => {
      const { packagingType, size } = parseVariantParts(fp.Variant);
      const sku = fp.Sku?.trim() || `SKU-${fp.ProductId}`;
      return {
        sku,
        variationName: `${sku}|${packagingType}|${size}`,
        packagingType,
        size,
        isActive: true,
      };
    });

    const payload: SyncProductDto = {
      scmsProductId,
      productName: first.Items?.ItemName || trimmed,
      productCategory: categoryName,
      productDescription: `${first.Items?.ItemName} produced by SCMS Commissary.`,
      isActive: first.Items?.IsActive ?? true,
      variations,
    };

    const posResult = await syncProductToPos(payload);

    return resourceResult({
      success: posResult.success,
      message: posResult.message,
      data: {
        productName: trimmed,
        scmsProductId,
        variationsCount: variations.length,
        posResponse: posResult.data,
      },
    });
  } catch (error) {
    return resourceResult({ success: false, message: errorMessage(error) });
  }
}

/**
 * Pushes all Finished Products in SCMS to POS, grouping variations by product name.
 */
export async function syncAllFinishedProductsToPos() {
  await requireModule("Production & Quality");

  try {
    const allProducts = await prisma.finishedProducts.findMany({
      include: {
        Items: {
          include: {
            Category: true,
          },
        },
      },
      orderBy: { ProductId: "asc" },
    });

    if (allProducts.length === 0) {
      return resourceResult({
        success: false,
        message: "No finished products configured in SCMS to sync.",
      });
    }

    // Group by item name
    const grouped = new Map<string, typeof allProducts>();
    for (const fp of allProducts) {
      const name = fp.Items?.ItemName?.trim();
      if (!name) continue;
      if (!grouped.has(name)) grouped.set(name, []);
      grouped.get(name)!.push(fp);
    }

    const results: { productName: string; success: boolean; message: string }[] = [];
    let successCount = 0;
    let failedCount = 0;

    for (const [prodName, fps] of grouped.entries()) {
      const first = fps[0];
      const scmsProductId =
        first.Items?.ItemCode?.trim() || `SCM-PRD-${String(first.ProductId).padStart(4, "0")}`;
      const categoryName = first.Items?.Category?.CategoryName || "Finished Goods";

      const variations: PosVariationDto[] = fps.map((fp) => {
        const { packagingType, size } = parseVariantParts(fp.Variant);
        const sku = fp.Sku?.trim() || `SKU-${fp.ProductId}`;
        return {
          sku,
          variationName: `${sku}|${packagingType}|${size}`,
          packagingType,
          size,
          isActive: true,
        };
      });

      const payload: SyncProductDto = {
        scmsProductId,
        productName: prodName,
        productCategory: categoryName,
        productDescription: `${prodName} produced by SCMS Commissary.`,
        isActive: first.Items?.IsActive ?? true,
        variations,
      };

      const res = await syncProductToPos(payload);
      if (res.success) {
        successCount++;
      } else {
        failedCount++;
      }
      results.push({
        productName: prodName,
        success: res.success,
        message: res.message,
      });
    }

    return resourceResult({
      success: successCount > 0 || failedCount === 0,
      message: `Sync complete: ${successCount} product(s) synced successfully${
        failedCount > 0 ? `, ${failedCount} failed or returned errors` : ""
      }.`,
      data: {
        totalProducts: grouped.size,
        successCount,
        failedCount,
        results,
      },
    });
  } catch (error) {
    return resourceResult({ success: false, message: errorMessage(error) });
  }
}

/**
 * Pulls branch locations from the POS and registers/updates them in SCMS Locations table.
 */
export async function pullAndSyncLocationsFromPos() {
  await requireModule("Production & Quality");

  try {
    const posRes = await fetchLocationsFromPos();
    if (!posRes.success || !posRes.locations || posRes.locations.length === 0) {
      return resourceResult({
        success: false,
        message: posRes.message || "No branch locations returned by POS.",
      });
    }

    let upsertedCount = 0;
    for (const loc of posRes.locations) {
      await prisma.locations.upsert({
        where: { LocationId: loc.locationId },
        update: {
          LocationName: loc.locationName,
          LocationType: loc.locationType || "Branch",
          Address: loc.address || "",
          IsActive: loc.isActive ?? true,
        },
        create: {
          LocationId: loc.locationId,
          LocationName: loc.locationName,
          LocationType: loc.locationType || "Branch",
          Address: loc.address || "",
          IsActive: loc.isActive ?? true,
        },
      });
      upsertedCount++;
    }

    return resourceResult({
      success: true,
      message: `Successfully synchronized ${upsertedCount} store location(s) from POS into SCMS.`,
      data: { upsertedCount },
    });
  } catch (error) {
    return resourceResult({ success: false, message: errorMessage(error) });
  }
}

