const INACTIVE_PREFIX = "[INACTIVE]";

export function encodeCategoryDescription(description?: string | null, isActive = true): string {
  const clean = (description ?? "").replace(/^\[INACTIVE\]\s*/i, "").trim();
  if (!isActive) {
    return clean ? `${INACTIVE_PREFIX} ${clean}` : INACTIVE_PREFIX;
  }
  return clean;
}

export function decodeCategoryDescription(
  rawDescription?: string | null,
  rawIsActive?: boolean | null
): { description: string; isActive: boolean } {
  const text = rawDescription ?? "";
  const hasInactivePrefix = /^\[INACTIVE\](\s|$)/i.test(text);
  const clean = text.replace(/^\[INACTIVE\]\s*/i, "").trim();
  const isActive = rawIsActive === false ? false : !hasInactivePrefix;
  return { description: clean, isActive };
}

