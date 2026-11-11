export const MAX_FUTURE_YEARS = 10;

function formatLocalYmd(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Local today's date as YYYY-MM-DD (avoids UTC off-by-one shifts). */
export function getTodayDateString(now = new Date()): string {
  return formatLocalYmd(now);
}

/** Dynamic 10-year future upper bound (e.g. 2026 -> 2036-12-31, 2027 -> 2037-12-31). */
export function getMaxFutureDateString(yearsAhead = MAX_FUTURE_YEARS, now = new Date()): string {
  return `${now.getFullYear() + yearsAhead}-12-31`;
}

/** Validate a YYYY-MM-DD date string against today's min and the 10-year future cap. */
export function getFutureDateError(
  value: string,
  label = "Date",
  options: { allowToday?: boolean; yearsAhead?: number; now?: Date } = {}
): string {
  const { allowToday = true, yearsAhead = MAX_FUTURE_YEARS, now = new Date() } = options;
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return `${label} is required.`;
  }
  const today = getTodayDateString(now);
  const maxDate = getMaxFutureDateString(yearsAhead, now);
  if (allowToday ? value < today : value <= today) {
    return allowToday ? `${label} cannot be in the past.` : `${label} must be a future date.`;
  }
  if (value > maxDate) {
    return `${label} cannot be beyond ${now.getFullYear() + yearsAhead}.`;
  }
  return "";
}

