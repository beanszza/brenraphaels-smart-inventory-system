export type LotCategoryCode = "RM" | "PM" | "WIP" | "FG";

export function getLotCategoryCode(categoryName?: string | null): LotCategoryCode {
  const c = (categoryName || "").trim().toLowerCase();
  if (c.includes("packag") || c === "pm") return "PM";
  if (c.includes("finished") || c === "fg") return "FG";
  if (c.includes("wip") || c.includes("work-in-progress") || c.includes("work in progress")) return "WIP";
  return "RM";
}

export function getLotItemAbbreviation(itemName?: string | null): string {
  const clean = (itemName || "").trim();
  if (!clean) return "ITM";
  const lower = clean.toLowerCase();

  // Common 3-letter abbreviations
  if (lower === "ube" || (lower.includes("ube") && !lower.includes("jam") && !lower.includes("halaya"))) return "UBE";
  if (lower.includes("sugar")) return "SGR";
  if (lower.includes("glass jar") || lower === "jar") return "JAR";
  if (lower.includes("ube") && lower.includes("halaya")) return "UBH";

  const words = clean
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

  if (words.length >= 3) {
    return words.slice(0, 3).map((w) => w[0]).join("").toUpperCase();
  }
  if (words.length === 2) {
    const first = words[0].toUpperCase();
    const second = words[1].toUpperCase();
    return (first.slice(0, 2) + second.slice(0, 1)).padEnd(3, "X").slice(0, 3);
  }
  const single = words[0].toUpperCase();
  return single.slice(0, 3).padEnd(3, "X");
}

export function formatLotCode(
  categoryName: string | null | undefined,
  itemName: string | null | undefined,
  date: Date,
  sequenceNumber: number
): string {
  const cat = getLotCategoryCode(categoryName);
  const item = getLotItemAbbreviation(itemName);
  const yy = String(date.getFullYear()).slice(-2);
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const seq = String(sequenceNumber).padStart(2, "0");
  return `${cat}-${item}-${yy}${mm}${dd}-${seq}`;
}

