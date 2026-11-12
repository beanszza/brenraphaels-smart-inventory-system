import { expect, it } from "vitest";
import { buildBaseVariantSku } from "@/lib/production/sku";
import { formatLotCode } from "@/lib/inventory/lot-code";

it("formats SKUs as [PRODUCT]-[VARIANT]-[PACKAGING]-[WEIGHT]", () => {
  expect(buildBaseVariantSku("Classic Ube Halaya", "12oz Glass Jar")).toBe("UBH-CLS-GLS-12OZ");
  expect(buildBaseVariantSku("Ube Jam Havanero", "250g Container")).toBe("UBH-HAV-CON-250G");
  expect(buildBaseVariantSku("Ube Jam Extreme", "500 Grams Container")).toBe("UBH-EXT-CON-500G");
});

it("formats Lot Codes as [CATEGORY]-[ITEM]-[YYMMDD]-[BATCH#]", () => {
  const date = new Date("2026-11-12T10:00:00Z");
  expect(formatLotCode("Raw Materials", "Ube", date, 1)).toBe("RM-UBE-261112-01");
  expect(formatLotCode("Ingredients", "White Sugar", date, 2)).toBe("RM-SGR-261112-02");
  expect(formatLotCode("Packaging Materials", "Glass Jar", date, 3)).toBe("PM-JAR-261112-03");
  expect(formatLotCode("Finished Goods", "Ube Halaya", date, 1)).toBe("UBH-261112-01");
});

