import { prisma } from "@/lib/prisma";

let initPromise: Promise<void> | null = null;

/**
 * Ensures that initial inventory and finished goods stock exists in the database.
 * Runs seamlessly in cloud/serverless environments (such as Vercel) where the database
 * may start empty without local seeding.
 */
export async function ensureInitialInventoryStock(): Promise<void> {
  if (typeof (prisma as any)?.finishedProducts?.findFirst !== "function") {
    return;
  }
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      // Check if finished good UBH-TUB-250G already has positive stock in Inventories
      const existingFp = await prisma.finishedProducts.findFirst({
        where: { Sku: "UBH-TUB-250G" },
        include: {
          Items: {
            include: {
              Inventories: true,
            },
          },
        },
      });

      const hasStock = existingFp?.Items?.Inventories?.some(
        (inv) => Number(inv.CurrentStock) >= 500
      );

      if (hasStock) {
        return;
      }

      // 1. Ensure "Finished Goods" category exists
      let fgCat = await prisma.categories.findFirst({
        where: {
          OR: [
            { CategoryName: { equals: "Finished Goods", mode: "insensitive" } },
            { CategoryName: { equals: "Finished Good", mode: "insensitive" } },
          ],
        },
      });

      if (!fgCat) {
        fgCat = await prisma.categories.create({
          data: {
            CategoryName: "Finished Goods",
            Description: "Finished production goods ready for sale and distribution",
          },
        });
      }

      // 2. Ensure Main Warehouse location exists
      let warehouseLoc = await prisma.locations.findFirst({
        where: {
          OR: [
            { LocationId: 5 },
            { LocationName: { contains: "Warehouse", mode: "insensitive" } },
          ],
        },
      });

      if (!warehouseLoc) {
        warehouseLoc = await prisma.locations.create({
          data: {
            LocationId: 5,
            LocationName: "Main Warehouse",
            LocationType: "Warehouse",
            Status: "Active",
            Address: "Commissary",
            IsActive: true,
            IsSystemLocation: true,
          },
        });
      }

      // 3. Ensure UOM exists
      let tubUom = await prisma.unitOfMeasures.findFirst({
        where: {
          OR: [
            { Code: "tub" },
            { Code: "pc" },
            { Name: { contains: "Tub", mode: "insensitive" } },
          ],
        },
      });

      if (!tubUom) {
        tubUom = await prisma.unitOfMeasures.create({
          data: {
            Name: "Tub",
            Abbreviation: "tub",
            Code: "tub",
            ConversionFactor: 1,
            IsBaseUnit: true,
            UomType: "Count",
          },
        });
      }

      // 4. Find or create Item "Ube Halaya Supreme"
      let item = await prisma.items.findFirst({
        where: {
          OR: [
            { ItemName: { equals: "Ube Halaya Supreme", mode: "insensitive" } },
            { ItemName: { equals: "Ube Jam", mode: "insensitive" } },
            { ItemId: 18 },
          ],
        },
      });

      if (!item) {
        item = await prisma.items.create({
          data: {
            ItemName: "Ube Halaya Supreme",
            CategoryId: fgCat.CategoryId,
            UomId: tubUom.UomId,
            StockUomId: tubUom.UomId,
            ItemCode: "FG-UBH-001",
            MinStockLevel: 50,
            MaxStockLevel: 1000,
            IsActive: true,
            IsLotTracked: true,
            IsExpiryTracked: true,
            IsQaRequired: true,
          },
        });
      } else {
        item = await prisma.items.update({
          where: { ItemId: item.ItemId },
          data: {
            ItemName: "Ube Halaya Supreme",
            CategoryId: fgCat.CategoryId,
            IsActive: true,
            IsLotTracked: true,
          },
        });
      }

      // 5. Ensure FinishedProduct record with SKU "UBH-TUB-250G"
      let fp = await prisma.finishedProducts.findFirst({
        where: {
          OR: [
            { Sku: "UBH-TUB-250G" },
            { ItemId: item.ItemId, Variant: "250g Tub" },
          ],
        },
      });

      if (!fp) {
        fp = await prisma.finishedProducts.create({
          data: {
            ItemId: item.ItemId,
            Sku: "UBH-TUB-250G",
            Variant: "250g Tub",
            SellingPrice: 150,
          },
        });
      } else {
        fp = await prisma.finishedProducts.update({
          where: { ProductId: fp.ProductId },
          data: {
            ItemId: item.ItemId,
            Sku: "UBH-TUB-250G",
            Variant: "250g Tub",
            SellingPrice: 150,
          },
        });
      }

      // 6. Set Inventories CurrentStock to 500
      await prisma.inventories.upsert({
        where: {
          ItemId_LocationId: {
            ItemId: item.ItemId,
            LocationId: warehouseLoc.LocationId,
          },
        },
        create: {
          ItemId: item.ItemId,
          LocationId: warehouseLoc.LocationId,
          CurrentStock: 500,
        },
        update: {
          CurrentStock: 500,
        },
      });

      // 7. Ensure InventoryLot with 500 Available
      const lotCode = "LOT-UBH-2026-0001";
      const now = new Date();
      const expiry = new Date();
      expiry.setFullYear(now.getFullYear() + 1);

      let lot = await prisma.inventoryLots.findFirst({
        where: { LotCode: lotCode },
      });

      if (!lot) {
        lot = await prisma.inventoryLots.create({
          data: {
            LotCode: lotCode,
            ItemId: item.ItemId,
            LocationId: warehouseLoc.LocationId,
            SourceType: "Production",
            ReceivedDate: now,
            ManufactureDate: now,
            ExpiryDate: expiry,
            IsExpiryEstimated: false,
            QuantityReceived: 500,
            QuantityRemaining: 500,
            ReservedQuantity: 0,
            UomId: item.UomId || tubUom.UomId,
            UnitCost: 45,
            Status: "Available",
            IsOpeningBalance: false,
          },
        });
      } else {
        lot = await prisma.inventoryLots.update({
          where: { LotId: lot.LotId },
          data: {
            ItemId: item.ItemId,
            LocationId: warehouseLoc.LocationId,
            QuantityReceived: 500,
            QuantityRemaining: 500,
            ReservedQuantity: 0,
            Status: "Available",
          },
        });
      }

      // 8. Ensure ProductionBatch linking to FinishedProduct and Lot
      const batchNumber = "BTH-UBH-2026-0001";
      let batch = await prisma.productionBatches.findFirst({
        where: { BatchNumber: batchNumber },
      });

      let recipe =
        (await prisma.recipes.findFirst({
          where: { ProductId: fp.ProductId },
        })) || (await prisma.recipes.findFirst());

      if (!recipe) {
        recipe = await prisma.recipes.create({
          data: {
            RecipeName: "Ube Halaya Classic Recipe",
            OutputQuantity: 100,
            YieldUomId: tubUom.UomId,
            ProductId: fp.ProductId,
            Status: "Active",
            IsActive: true,
            Notes: "Standard production recipe",
            RecipeCode: "RCP-UBH-001",
          },
        });
      }

      if (!batch) {
        await prisma.productionBatches.create({
          data: {
            BatchNumber: batchNumber,
            ProductId: fp.ProductId,
            RecipeId: recipe.RecipeId,
            BatchMultiplier: 5,
            EstimatedQuantity: 500,
            ActualQuantity: 500,
            FinalQuantity: 500,
            ProductionDate: now,
            CompletedDate: now,
            PackagedAt: now,
            PackagedBy: "Head Cook",
            AssignedCook: "Head Cook",
            Stage: "Completed",
            CurrentStage: "Completed",
            QualityStatus: "Passed",
            Status: "Stocked In",
            FgLotId: lot.LotId,
            Notes: "Stocked in 500 pieces of Ube Halaya Supreme 250g Tub (UBH-TUB-250G)",
            ImageUrl: "",
            RejectionReason: "",
          },
        });
      } else {
        await prisma.productionBatches.update({
          where: { BatchId: batch.BatchId },
          data: {
            ProductId: fp.ProductId,
            ActualQuantity: 500,
            FinalQuantity: 500,
            FgLotId: lot.LotId,
            Status: "Stocked In",
          },
        });
      }
    } catch (err) {
      console.error("[ENSURE-INITIAL-STOCK-ERROR]", err);
    }
  })();

  return initPromise;
}
