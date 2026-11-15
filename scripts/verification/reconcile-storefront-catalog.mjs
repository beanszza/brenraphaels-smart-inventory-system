import { readFile, writeFile } from 'node:fs/promises';
import { Prisma, PrismaClient } from '@prisma/client';

// Operator-only: consume the owner's authoritative storefront catalog, never infer a mapping by name.
const [catalogPath, mappingPath] = process.argv.slice(2);
if (!catalogPath || !mappingPath) throw new Error('Usage: node --env-file=.env scripts/verification/reconcile-storefront-catalog.mjs <catalog.json> <mapping.json>');
const catalog = JSON.parse(await readFile(catalogPath, 'utf8'));
if (!Array.isArray(catalog) || catalog.length === 0) throw new Error('The catalog must contain Sizes.');
const ids = new Set();
for (const size of catalog) {
  if (!Number.isSafeInteger(size.sizeId) || size.sizeId < 1 || ids.has(size.sizeId) ||
      typeof size.productName !== 'string' || !size.productName.trim() ||
      typeof size.sizeLabel !== 'string' || !size.sizeLabel.trim() ||
      !Number.isSafeInteger(size.priceInCentavos) || size.priceInCentavos < 0 || typeof size.available !== 'boolean') {
    throw new Error('Each Size needs a unique positive id, product/Size names, price in centavos and availability.');
  }
  ids.add(size.sizeId);
}
const db = new PrismaClient();
try {
  const mapping = await db.$transaction(async tx => {
    const category = await tx.categories.findFirst({ where: { CategoryName: 'Finished Good' } });
    const unit = await tx.unitOfMeasures.findUnique({ where: { Code: 'pcs' } });
    if (!category || !unit || unit.UomType !== 'Count') throw new Error('Configure Finished Good category and pcs Count unit first.');
    const result = {};
    for (const size of catalog) {
      const code = `SHOP-SIZE-${size.sizeId}`;
      const itemName = `${size.productName} · ${size.sizeLabel}`;
      const existing = await tx.items.findMany({ where: { ItemCode: code } });
      if (existing.length > 1) throw new Error(`Duplicate Item code ${code}; reconcile it first.`);
      let item = existing[0];
      if (item && item.ItemName !== itemName) throw new Error(`Size ${size.sizeId} changed identity; review its existing stock before remapping.`);
      if (item && (item.UomId !== unit.UomId || item.StockUomId !== unit.UomId || item.CategoryId !== category.CategoryId || !item.IsLotTracked || !item.IsExpiryTracked)) {
        throw new Error(`Size ${size.sizeId} changed its count units/category/tracking; review existing stock before remapping.`);
      }
      if (!item) item = await tx.items.create({ data: {
        ItemCode: code, ItemName: itemName, UomId: unit.UomId, StockUomId: unit.UomId,
        CategoryId: category.CategoryId, MinStockLevel: 0, MaxStockLevel: 0,
        IsActive: size.available, IsExpiryTracked: true, IsLotTracked: true,
      } });
      const products = await tx.finishedProducts.findMany({ where: { ItemId: item.ItemId } });
      if (products.length > 1 || (products[0] && (products[0].Variant !== size.sizeLabel))) {
        throw new Error(`SKU ${code} does not identify one exclusive Size.`);
      }
      const product = products[0] ?? await tx.finishedProducts.create({ data: {
        ItemId: item.ItemId, Sku: code, Variant: size.sizeLabel,
        SellingPrice: new Prisma.Decimal(size.priceInCentavos).div(100),
      } });
      // Existing catalog facts and stock/history are deliberately preserved on replay.
      result[String(size.sizeId)] = product.ProductId;
    }
    return result;
  }, { isolationLevel: 'Serializable', timeout: 30000 });
  await writeFile(mappingPath, JSON.stringify(mapping, null, 2) + '\n', { mode: 0o600 });
  console.log(`Mapped ${Object.keys(mapping).length} storefront Sizes. No stock quantities or existing product history changed.`);
} finally { await db.$disconnect(); }
