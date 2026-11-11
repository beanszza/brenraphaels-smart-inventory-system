import type { Prisma } from "@prisma/client";

export type VariantPackagingType = "Jar" | "Container" | "Pouch";
export type VariantContentUom = "ML" | "G" | "KG" | "L";

export const VARIANT_UOM_LABELS: Record<VariantContentUom, string> = {
  ML: "Milliliter (mL)",
  G: "Gram (g)",
  KG: "Kilogram (kg)",
  L: "Liter (L)",
};

export const VARIANT_UOM_NAMES: Record<VariantContentUom, string> = {
  ML: "Milliliters",
  G: "Grams",
  KG: "Kilograms",
  L: "Liters",
};

export function formatVariantUomLabel(uom?: string | null): string {
  const key = (uom || "ML").trim().toUpperCase() as VariantContentUom;
  return VARIANT_UOM_LABELS[key] || `${key}`;
}

export interface ParsedVariantComponents {
  contentSize: string;
  uom: VariantContentUom;
  packagingType: VariantPackagingType;
  variantName: string;
}

/**
 * Normalizes a UOM input string ("G", "g", "Grams", "Gram (g)", etc.) to VariantContentUom.
 */
export function normalizeVariantUom(uom?: string | null): VariantContentUom {
  const clean = (uom || "ML").trim().toLowerCase();
  if (clean.startsWith("ml") || clean.startsWith("millilit")) return "ML";
  if (clean.startsWith("kg") || clean.startsWith("kilogram")) return "KG";
  if (clean.startsWith("g")) return "G";
  if (clean.startsWith("l")) return "L";
  return "ML";
}

/**
 * Formats a canonical Variant Name from Content Size, UOM, and Packaging Type.
 * e.g. ("500", "G", "Container") -> "500 Grams Container"
 *      ("250", "ML", "Jar") -> "250 Milliliters Jar"
 */
export function composeVariantName(
  contentSize: string | number,
  uom: string,
  packagingType: string
): string {
  const cleanSize = String(contentSize ?? "").trim();
  const normalizedUom = normalizeVariantUom(uom);
  const uomWord = VARIANT_UOM_NAMES[normalizedUom] || normalizedUom;
  const cleanPkg = (packagingType || "Jar").trim();
  if (!cleanSize) return `${uomWord} ${cleanPkg}`.trim();
  return `${cleanSize} ${uomWord} ${cleanPkg}`.trim();
}

/**
 * Parses an existing variant string (e.g. "250 Grams Container", "500 G Container", "250g Container", "250 ML Jar")
 * into structured { contentSize, uom, packagingType, variantName }.
 */
export function parseVariantComponents(
  variantStr?: string | null,
  fallbackUom?: string | null
): ParsedVariantComponents {
  const raw = (variantStr || "").trim();

  // Extract Packaging Type
  let packagingType: VariantPackagingType = "Jar";
  const lower = raw.toLowerCase();
  if (lower.includes("container") || lower.includes("tub")) {
    packagingType = "Container";
  } else if (lower.includes("pouch") || lower.includes("pack")) {
    packagingType = "Pouch";
  } else if (lower.includes("jar") || lower.includes("bottle")) {
    packagingType = "Jar";
  }

  // Extract numeric content size
  const numMatch = raw.match(/(\d+(?:\.\d+)?)/);
  const contentSize = numMatch ? numMatch[1] : "250";

  // Extract UOM
  let uom: VariantContentUom = "ML";
  const unitMatch = raw.match(
    /\d+(?:\.\d+)?\s*(milliliters?|millilitres?|ml|kilograms?|kg|grams?|g|liters?|litres?|l)\b/i
  );
  if (unitMatch) {
    uom = normalizeVariantUom(unitMatch[1]);
  } else if (fallbackUom) {
    uom = normalizeVariantUom(fallbackUom);
  }

  const canonicalName = numMatch
    ? composeVariantName(contentSize, uom, packagingType)
    : raw || composeVariantName(contentSize, uom, packagingType);

  return {
    contentSize,
    uom,
    packagingType,
    variantName: canonicalName,
  };
}

/**
 * Derives a clean, consistent uppercase abbreviation for a product name.
 * e.g., "Ube Halaya Jam" -> "UHJ", "Ube Halaya Supreme" -> "UBH", "Mango Puree" -> "MP"
 */
export function getProductAbbreviation(productName: string): string {
  const clean = (productName || "").trim().toLowerCase();
  if (clean.includes("smooth")) return "UBH-SM";
  if (clean.includes("tidbit")) return "UBH-TB";
  if (clean.includes("ube") && clean.includes("supreme")) return "UBH";
  if (clean.includes("ube") && clean.includes("jam")) return "UHJ";
  if (clean.includes("ube") && clean.includes("halaya")) return "UBH";

  const words = clean.split(/\s+/).filter(Boolean);
  const initials = words.map(w => w.charAt(0).toUpperCase()).join("").slice(0, 4);
  return initials || "PRD";
}

/**
 * Derives a clean SKU part from a variant label, size, or packaging.
 * e.g., "250 Milliliters Jar" -> "250ML-JAR", "500 Grams Container" -> "500G-CON"
 */
export function getVariantAbbreviation(variantName: string): string {
  const clean = (variantName || "").trim();
  if (!clean) return "STD";

  const unitShortened = clean
    .replace(/\bmillilit(?:er|re)s?\b/gi, "ML")
    .replace(/\bkilograms?\b/gi, "KG")
    .replace(/\bgrams?\b/gi, "G")
    .replace(/\blit(?:er|re)s?\b/gi, "L");

  // Collapse "<number> <unit>" into "<number><unit>" so "250 ML Jar" -> "250ML Jar" -> "250ML-JAR"
  const normalized = unitShortened.replace(/(\d+(?:\.\d+)?)\s+(ml|g|kg|l)\b/gi, "$1$2");

  const parts = normalized
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => {
      const upper = p.toUpperCase().replace(/[^A-Z0-9]/g, "");
      if (upper === "CONTAINER") return "CON";
      if (upper === "POUCH") return "POU";
      return upper;
    });
  const joined = parts.filter(Boolean).join("-");
  return joined || "STD";
}

/**
 * Constructs a candidate variant SKU from product name and variant string.
 */
export function buildBaseVariantSku(productName: string, variantName: string): string {
  const pCode = getProductAbbreviation(productName);
  const vCode = getVariantAbbreviation(variantName);
  return `${pCode}-${vCode}`.toUpperCase();
}

/**
 * Ensures a SKU is completely unique within FinishedProducts table.
 * If base SKU exists, appends suffix -2, -3, etc.
 */
export async function getUniqueVariantSku(
  tx: Prisma.TransactionClient,
  baseSku: string,
  excludeProductId?: number
): Promise<string> {
  const cleanBase = baseSku.trim().toUpperCase();
  let candidate = cleanBase;

  for (let counter = 1; counter <= 50; counter++) {
    const existing = await tx.finishedProducts.findFirst({
      where: {
        Sku: { equals: candidate, mode: "insensitive" },
        ...(excludeProductId ? { ProductId: { not: excludeProductId } } : {}),
      },
      select: { ProductId: true, Sku: true },
    });

    // In real DB: returns null if SKU doesn't exist
    // In mock environments: returns a static mock row whose Sku might not match candidate
    if (!existing || (existing.Sku && existing.Sku.toUpperCase() !== candidate)) {
      return candidate;
    }

    candidate = `${cleanBase}-${counter + 1}`;
  }

  return `${cleanBase}-${Date.now()}`;
}

/**
 * Generates the next sequential Finished Product code (e.g. FP-2026-0001).
 */
export async function generateProductCode(tx: Prisma.TransactionClient): Promise<string> {
  const year = new Date().getFullYear();
  const seq = await tx.documentSequences.upsert({
    where: { DocType_Year: { DocType: "FinishedProduct", Year: year } },
    update: { LastNumber: { increment: 1 } },
    create: { DocType: "FinishedProduct", Year: year, LastNumber: 1 },
  });
  return `FP-${year}-${String(seq.LastNumber).padStart(4, "0")}`;
}
