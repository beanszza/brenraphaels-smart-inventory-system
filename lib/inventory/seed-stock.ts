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

    // 3. Find Finished Goods Location & Commissary Locations
    const commissaryLocations = await prisma.locations.findMany({
      where: {
        OR: [
          { LocationName: { contains: "Finished", mode: "insensitive" } },
          { LocationType: { contains: "Finished", mode: "insensitive" } },
          { IsSystemLocation: true },
          { LocationName: { contains: "Commissary", mode: "insensitive" } },
          { LocationType: { contains: "Commissary", mode: "insensitive" } },
          { LocationName: { contains: "Warehouse", mode: "insensitive" } },
          { LocationType: { contains: "Warehouse", mode: "insensitive" } },
          { LocationName: { contains: "Factory", mode: "insensitive" } },
        ],
        NOT: [
          { LocationType: { in: ["Branch", "Bazaar", "In Transit", "Disposal", "Quarantine"] } },
          { LocationName: { contains: "Branch", mode: "insensitive" } },
          { LocationName: { contains: "Bazaar", mode: "insensitive" } },
          { LocationName: { contains: "Transit", mode: "insensitive" } },
        ],
      },
      orderBy: { LocationId: "asc" },
    });

    let location = commissaryLocations[0];
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
      commissaryLocations.push(location);
    }

    // 4. Find all candidate Items (e.g. "Ube Jam Havanero")
    let items = await prisma.items.findMany({
      where: {
        OR: [
          { ItemName: { contains: "Havanero", mode: "insensitive" } },
          { ItemName: { contains: "Ube Jam", mode: "insensitive" } },
        ],
      },
    });

    if (items.length === 0) {
      const createdItem = await prisma.items.create({
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
      items = [createdItem];
    }

    const expiry = new Date();
    expiry.setMonth(expiry.getMonth() + 6);

    const variantDefs = [
      {
        variant: "250g Container",
        sku: "UHJ-250G-CONTAINER",
        altSku: "UJH-CON-250G",
        sellingPrice: 150.0,
        lotCode: "LOT-UJH-2026-0001",
        batchNumber: "BTH-UJH-250G-001",
      },
      {
        variant: "500g Container",
        sku: "UHJ-500G-CONTAINER",
        altSku: "UJH-CON-500G",
        sellingPrice: 280.0,
        lotCode: "LOT-UJH-2026-0002",
        batchNumber: "BTH-UJH-500G-001",
      },
    ];

    for (const itm of items) {
      // Ensure Item has categoryId pointing to Finished Goods
      if (itm.CategoryId !== category.CategoryId) {
        await prisma.items.update({
          where: { ItemId: itm.ItemId },
          data: { CategoryId: category.CategoryId, IsActive: true },
        }).catch(() => {});
      }

      for (const v of variantDefs) {
        let fp = await prisma.finishedProducts.findFirst({
          where: {
            ItemId: itm.ItemId,
            OR: [
              { Variant: { equals: v.variant, mode: "insensitive" } },
              { Sku: { equals: v.sku, mode: "insensitive" } },
              { Sku: { equals: v.altSku, mode: "insensitive" } },
            ],
          },
        });

        if (!fp) {
          fp = await prisma.finishedProducts.create({
            data: {
              ItemId: itm.ItemId,
              Variant: v.variant,
              Sku: v.sku,
              SellingPrice: v.sellingPrice,
            },
          });
        }

        // Ensure lots in all commissary locations for this item
        for (const loc of commissaryLocations) {
          const lotCode = `${v.lotCode}-L${loc.LocationId}`;
          let lot = await prisma.inventoryLots.findFirst({
            where: {
              LotCode: lotCode,
              LocationId: loc.LocationId,
            },
          });

          if (!lot) {
            lot = await prisma.inventoryLots.findFirst({
              where: {
                LotCode: v.lotCode,
                LocationId: loc.LocationId,
              },
            });
          }

          if (!lot) {
            lot = await prisma.inventoryLots.create({
              data: {
                LotCode: lotCode,
                ItemId: itm.ItemId,
                LocationId: loc.LocationId,
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
          } else {
            // Guarantee at least 50 pcs remaining
            if (Number(lot.QuantityRemaining) < 50 || lot.Status !== "Available") {
              await prisma.inventoryLots.update({
                where: { LotId: lot.LotId },
                data: {
                  QuantityRemaining: 50.0,
                  Status: "Available",
                  ExpiryDate: expiry,
                },
              });
            }
          }

          // Ensure stock ledger entry exists
          const existingLedger = await prisma.stockLedgers.findFirst({
            where: { LotId: lot.LotId },
          });
          if (!existingLedger) {
            await prisma.stockLedgers.create({
              data: {
                LotId: lot.LotId,
                ItemId: itm.ItemId,
                LocationId: loc.LocationId,
                MovementType: "IN",
                Quantity: 50.0,
                UomId: uom.UomId,
                UnitCost: v.sellingPrice,
                ReferenceType: "InitialStock",
                ReferenceId: `STOCK-${v.sku}-L${loc.LocationId}`,
                UserId: "SYSTEM",
                UserName: "System Administrator",
                PostedAt: new Date(),
              },
            }).catch(() => {});
          }

          // Production batch link
          const batchNo = `${v.batchNumber}-L${loc.LocationId}`;
          let batch = await prisma.productionBatches.findFirst({
            where: {
              OR: [
                { BatchNumber: batchNo },
                { BatchNumber: v.batchNumber },
                { FgLotId: lot.LotId },
              ],
            },
          });
          if (!batch) {
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

            await prisma.productionBatches.create({
              data: {
                BatchNumber: batchNo,
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
            }).catch(() => {});
          }
        }

        // Upsert inventory record for each commissary location
        for (const loc of commissaryLocations) {
          await prisma.inventories.upsert({
            where: {
              ItemId_LocationId: {
                ItemId: itm.ItemId,
                LocationId: loc.LocationId,
              },
            },
            update: {
              CurrentStock: { set: 100.0 },
            },
            create: {
              ItemId: itm.ItemId,
              LocationId: loc.LocationId,
              CurrentStock: 100.0,
            },
          });
        }
      }
    }

    ubeJamStockEnsured = true;
  } catch (err) {
    console.warn("[ENSURE-UBE-JAM-STOCK-WARN]", err);
  }
}
