import { readFile } from 'node:fs/promises';
import { Prisma, PrismaClient } from '@prisma/client';

const [catalogPath, mappingPath, quantityText, confirmation, branchText] = process.argv.slice(2);
const quantity = Number(quantityText);
if (!catalogPath || !mappingPath || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 100 || confirmation !== '--confirm-demo') {
  throw new Error('Usage: node --env-file=.env scripts/verification/seed-demo-stock.mjs <catalog.json> <mapping.json> <1-100 units> --confirm-demo [POS Branch id]');
}
const catalog = JSON.parse(await readFile(catalogPath, 'utf8'));
const mapping = JSON.parse(await readFile(mappingPath, 'utf8'));
const warehouseId = Number(process.env.IMS_SHOP_WAREHOUSE_ID);
const branchId = branchText === undefined ? undefined : Number(branchText);
if (!Array.isArray(catalog) || !catalog.length || !Number.isSafeInteger(warehouseId) || warehouseId < 1 ||
    (branchId !== undefined && (!Number.isSafeInteger(branchId) || branchId < 1))) throw new Error('Configure an explicit Warehouse and valid catalog/Branch.');
const db = new PrismaClient();
try {
  const created = await db.$transaction(async tx => {
    const warehouse = await tx.locations.findUnique({ where: { LocationId: warehouseId } });
    if (!warehouse?.IsActive || warehouse.LocationType.toLowerCase() !== 'warehouse') throw new Error('The demo source must be an active Warehouse.');
    if (branchId !== undefined) {
      const branch = await tx.locations.findUnique({ where: { LocationId: branchId } });
      if (!branch?.IsActive || branch.LocationType.toLowerCase() !== 'branch') throw new Error('The POS fixture needs an active Branch.');
    }
    let count = 0;
    const active = catalog.filter(size => size.available);
    if (!active.length) throw new Error('The catalog has no on-sale Sizes.');
    for (const size of active) {
      const product = await tx.finishedProducts.findUnique({ where: { ProductId: mapping[String(size.sizeId)] }, include: { Items: { include: { Uom: true } } } });
      if (!product || product.Variant !== size.sizeLabel ||
          product.Items.ItemCode !== `SHOP-SIZE-${size.sizeId}` || product.Items.ItemName !== `${size.productName} · ${size.sizeLabel}` ||
          product.Items.Uom.UomType !== 'Count' || product.Items.StockUomId !== product.Items.UomId ||
          await tx.finishedProducts.count({ where: { ItemId: product.ItemId } }) !== 1) {
        throw new Error(`Size ${size.sizeId} does not have an exclusive, explicit count-based mapping.`);
      }
      const targets = [warehouseId, ...(branchId !== undefined && size === active[0] ? [branchId] : [])];
      for (const locationId of targets) {
        const reference = `DEMO-367-SIZE-${size.sizeId}-${locationId}`;
        const entries = await tx.stockLedgers.findMany({ where: { ReferenceType: 'DemoVerification', ReferenceId: reference } });
        if (entries.length > 1 || (entries[0] && (entries[0].ItemId !== product.ItemId || entries[0].LocationId !== locationId))) {
          throw new Error(`Demo opening ${reference} has conflicting ledger identity.`);
        }
        if (entries[0]) continue; // Stable ledger identity survives IMS's automatic display-lot renaming.
        const now = new Date();
        const date = now.toISOString().slice(2, 10).replaceAll('-', '');
        const lotCode = `FG-DMO-${date}-${String(size.sizeId).padStart(2, '0')}`;
        if (await tx.inventoryLots.findUnique({ where: { LotCode_LocationId: { LotCode: lotCode, LocationId: locationId } } })) {
          throw new Error(`Demo lot ${lotCode} already exists without its opening ledger; review it first.`);
        }
        const lot = await tx.inventoryLots.create({ data: {
          LotCode: lotCode, SupplierLotNo: reference, ItemId: product.ItemId, LocationId: locationId, SourceType: 'Opening',
          ReceivedDate: now, ManufactureDate: now, ExpiryDate: new Date(now.getTime() + 365 * 86400000),
          IsExpiryEstimated: true, QuantityReceived: quantity, QuantityRemaining: quantity,
          ReservedQuantity: 0, UomId: product.Items.UomId, UnitCost: 0, Status: 'Active', IsOpeningBalance: true,
        } });
        await tx.inventories.upsert({
          where: { ItemId_LocationId: { ItemId: product.ItemId, LocationId: locationId } },
          create: { ItemId: product.ItemId, LocationId: locationId, CurrentStock: quantity },
          update: { CurrentStock: { increment: quantity } },
        });
        await tx.stockLedgers.create({ data: {
          LotId: lot.LotId, ItemId: product.ItemId, LocationId: locationId, MovementType: 'IN',
          Quantity: new Prisma.Decimal(quantity), UomId: product.Items.UomId, UnitCost: 0,
          ReferenceType: 'DemoVerification', ReferenceId: reference, UserId: 'owner-approved-367',
          UserName: 'Owner-approved school demo', PostedAt: now,
          Notes: 'DEMO ONLY: owner-approved ticket #367 stock verification fixture; not a physical stock count.',
        } });
        count++;
      }
    }
    return count;
  }, { isolationLevel: 'Serializable', timeout: 30000 });
  console.log(`Created ${created} labelled demo lots; existing lots/history were preserved.`);
} finally { await db.$disconnect(); }
