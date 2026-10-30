import { prisma } from "@/lib/prisma";

let ubeJamStockEnsured = false;

export async function ensureUbeJamHavaneroStock() {
  if (ubeJamStockEnsured) return;
  if (
    typeof (prisma as any)?.items?.findFirst !== "function" ||
    typeof (prisma as any)?.inventories?.upsert !== "function"
  ) {
    return;
  }

  try {
    // 1. Find or create UOM "Container"
    let uom = await prisma.unitOfMeasures.findFirst({
      where: {
        OR: [
          { Name: { equals: "Container", mode: "insensitive" } },
          { Abbreviation: { equals: "cont", mode: "insensitive" } },
          { Code: { equals: "cont", mode: "insensitive" } },
        ],
      },
    });
    if (!uom) {
      uom = await prisma.unitOfMeasures.create({
        data: {
          Name: "Container",
          Abbreviation: "cont",
          Code: "cont",
          ConversionFactor: 1,
          IsBaseUnit: true,
          UomType: "Count",
        },
      });
    }

    // 2. Find or create Finished Good Category
    let category = await prisma.categories.findFirst({
      where: {
        OR: [
          { CategoryName: { equals: "Finished Good", mode: "insensitive" } },
          { CategoryName: { equals: "Finished Goods", mode: "insensitive" } },
        ],
      },
    });
    if (!category) {
      category = await prisma.categories.create({
        data: {
          CategoryName: "Finished Good",
          Description: "Finished Goods",
        },
      });
    }

    // 3. Find Finished Goods Location
    let location = await prisma.locations.findFirst({
      where: {
        OR: [
          { LocationName: { equals: "Finished Goods", mode: "insensitive" } },
          { LocationType: { equals: "Finished Goods", mode: "insensitive" } },
          { IsSystemLocation: true },
        ],
      },
      orderBy: { LocationId: "asc" },
    });
    if (!location) {
      location = await prisma.locations.create({
        data: {
          LocationName: "Finished Goods",
          LocationType: "Finished Goods",
          Address: "Main Plant",
          IsActive: true,
          IsSystemLocation: true,
          Status: "Active",
        },
      });
    }

    // 4. Find or create Item "Ube Jam Havanero"
    let item = await prisma.items.findFirst({
      where: {
        ItemName: { equals: "Ube Jam Havanero", mode: "insensitive" },
      },
    });
    if (!item) {
      item = await prisma.items.create({
        data: {
          ItemName: "Ube Jam Havanero",
          ItemCode: "FP-2026-0001",
          CategoryId: category.CategoryId,
          UomId: uom.UomId,
          StockUomId: uom.UomId,
          MinStockLevel: 10,
          MaxStockLevel: 500,
          IsActive: true,
          IsLotTracked: true,
          IsExpiryTracked: true,
          IsQaRequired: true,
        },
      });
    }

    // 5. Variants (250g Container and 500g Container)
    const variants = [
      {
        variant: "250g Container",
        sku: "UJH-CON-250G",
        sellingPrice: 150.0,
        lotCode: "LOT-UJH-2026-0001",
        batchNumber: "BTH-UJH-250G-001",
      },
      {
        variant: "500g Container",
        sku: "UJH-CON-500G",
        sellingPrice: 280.0,
        lotCode: "LOT-UJH-2026-0002",
        batchNumber: "BTH-UJH-500G-001",
      },
    ];

    const expiry = new Date();
    expiry.setMonth(expiry.getMonth() + 6);

    for (const v of variants) {
      let fp = await prisma.finishedProducts.findFirst({
        where: {
          ItemId: item.ItemId,
          Variant: { equals: v.variant, mode: "insensitive" },
        },
      });
      if (!fp) {
        fp = await prisma.finishedProducts.create({
          data: {
            ItemId: item.ItemId,
            Variant: v.variant,
            Sku: v.sku,
            SellingPrice: v.sellingPrice,
          },
        });
      }

      let lot = await prisma.inventoryLots.findFirst({
        where: { LotCode: v.lotCode },
      });
      if (!lot) {
        lot = await prisma.inventoryLots.create({
          data: {
            LotCode: v.lotCode,
            ItemId: item.ItemId,
            LocationId: location.LocationId,
            SourceType: "Production",
            ReceivedDate: new Date(),
            ManufactureDate: new Date(),
            ExpiryDate: expiry,
            IsExpiryEstimated: false,
            QuantityReceived: 50.0,
            QuantityRemaining: 50.0,
            ReservedQuantity: 0.0,
            UomId: uom.UomId,
            UnitCost: v.sellingPrice,
            Status: "Available",
            IsOpeningBalance: true,
          },
        });
      }

      // Stock Ledger
      const existingLedger = await prisma.stockLedgers.findFirst({
        where: { LotId: lot.LotId },
      });
      if (!existingLedger) {
        await prisma.stockLedgers.create({
          data: {
            LotId: lot.LotId,
            ItemId: item.ItemId,
            LocationId: location.LocationId,
            MovementType: "IN",
            Quantity: 50.0,
            UomId: uom.UomId,
            UnitCost: v.sellingPrice,
            ReferenceType: "InitialStock",
            ReferenceId: `STOCK-${v.sku}`,
            UserId: "SYSTEM",
            UserName: "System Administrator",
            PostedAt: new Date(),
          },
        });
      }

      // Check Recipe for ProductionBatch
      let recipe = await prisma.recipes.findFirst({
        where: { ProductId: fp.ProductId },
      });
      if (!recipe) {
        recipe = await prisma.recipes.findFirst();
      }
      if (!recipe) {
        recipe = await prisma.recipes.create({
          data: {
            RecipeCode: `RCP-${v.sku}`,
            RecipeName: `Recipe ${v.variant}`,
            ProductId: fp.ProductId,
            OutputQuantity: 50,
            Notes: "Standard production recipe",
            IsActive: true,
            Status: "Active",
            Version: 1,
            YieldUomId: uom.UomId,
          },
        });
      }

      // Production batch link
      const batch = await prisma.productionBatches.findFirst({
        where: { BatchNumber: v.batchNumber },
      });
      if (!batch) {
        await prisma.productionBatches.create({
          data: {
            BatchNumber: v.batchNumber,
            ProductId: fp.ProductId,
            RecipeId: recipe.RecipeId,
            BatchMultiplier: 1,
            EstimatedQuantity: 50,
            ActualQuantity: 50,
            ProductionDate: new Date(),
            Stage: "Stocked In",
            CurrentStage: "Stocked In",
            QualityStatus: "Passed",
            RejectionReason: "",
            ImageUrl: "",
            Notes: `Seeded batch for ${v.variant}`,
            Status: "Stocked In",
            FgLotId: lot.LotId,
            UnitCost: v.sellingPrice,
          },
        });
      }
    }

    // Upsert total inventory
    await prisma.inventories.upsert({
      where: {
        ItemId_LocationId: {
          ItemId: item.ItemId,
          LocationId: location.LocationId,
        },
      },
      update: {
        CurrentStock: 100.0,
      },
      create: {
        ItemId: item.ItemId,
        LocationId: location.LocationId,
        CurrentStock: 100.0,
      },
    });

    ubeJamStockEnsured = true;
  } catch (err) {
    console.warn("[ENSURE-UBE-JAM-STOCK-WARN]", err);
  }
}
