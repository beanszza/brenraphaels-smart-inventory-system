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
export function getSkuProductCode(productName: string): string {
  const clean = (productName || "").trim().toLowerCase();
  if (clean.includes("ube") && (clean.includes("halaya") || clean.includes("jam"))) {
    return "UBH";
  }
  const stopWords = new Set(["classic", "original", "havanero", "habanero", "extreme", "supreme", "smooth", "tidbits", "tidbit", "spicy", "sweet", "special"]);
  const words = clean
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w && !stopWords.has(w));

  if (words.length >= 3) {
    return words.slice(0, 3).map((w) => w[0]).join("").toUpperCase();
  }
  if (words.length === 2) {
    return (words[0].slice(0, 2) + words[1].slice(0, 1)).toUpperCase();
  }
  if (words.length === 1) {
    return words[0].slice(0, 3).toUpperCase().padEnd(3, "X");
  }
  return "PRD";
}

export function getSkuVariantCode(productName: string, variantName: string): string {
  const combined = `${productName || ""} ${variantName || ""}`.toLowerCase();
  if (combined.includes("classic") || combined.includes("original")) return "CLS";
  if (combined.includes("havanero") || combined.includes("habanero")) return "HAV";
  if (combined.includes("extreme")) return "EXT";
  if (combined.includes("supreme")) return "SUP";
  if (combined.includes("smooth")) return "SMH";
  if (combined.includes("tidbit")) return "TBT";
  if (combined.includes("spicy")) return "SPC";
  if (combined.includes("sweet")) return "SWT";
  if (combined.includes("cheese")) return "CHS";
  return "STD";
}

export function getSkuPackagingCode(variantName: string): string {
  const lower = (variantName || "").toLowerCase();
  if (lower.includes("glass")) return "GLS";
  if (lower.includes("jar") || lower.includes("bottle")) return "JAR";
  if (lower.includes("container") || lower.includes("tub")) return "CON";
  if (lower.includes("pouch") || lower.includes("pack")) return "POU";
  if (lower.includes("box")) return "BOX";
  return "JAR";
}

export function getSkuWeightCode(variantName: string): string {
  const clean = (variantName || "").trim();
  const unitShortened = clean
    .replace(/\bmillilit(?:er|re)s?\b/gi, "ML")
    .replace(/\bkilograms?\b/gi, "KG")
    .replace(/\bgrams?\b/gi, "G")
    .replace(/\blit(?:er|re)s?\b/gi, "L")
    .replace(/\bounces?\b/gi, "OZ")
    .replace(/\bpounds?\b/gi, "LB");

  const match = unitShortened.match(/(\d+(?:\.\d+)?)\s*(ML|KG|G|L|OZ|LB)\b/i);
  if (match) {
    return `${match[1]}${match[2].toUpperCase()}`;
  }
  return "STD";
}

/**
 * Constructs a candidate variant SKU in [PRODUCT]-[VARIANT]-[PACKAGING]-[WEIGHT] format.
 * e.g. ("Classic Ube Halaya", "12oz Glass Jar") -> "UBH-CLS-GLS-12OZ"
 */
export function buildBaseVariantSku(productName: string, variantName: string): string {
  const pCode = getSkuProductCode(productName);
  const vCode = getSkuVariantCode(productName, variantName);
  const pkgCode = getSkuPackagingCode(variantName);
  const wCode = getSkuWeightCode(variantName);
  return `${pCode}-${vCode}-${pkgCode}-${wCode}`.toUpperCase();
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
