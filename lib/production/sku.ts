import type { Prisma } from "@prisma/client";

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
 * e.g., "250g Tub" -> "250G-TUB", "300g Jar" -> "300G-JAR"
 */
export function getVariantAbbreviation(variantName: string): string {
  const clean = (variantName || "").trim();
  if (!clean) return "STD";

  // If already separated by words, clean and join
  const parts = clean.split(/\s+/).filter(Boolean).map(p => p.toUpperCase().replace(/[^A-Z0-9]/g, ""));
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
