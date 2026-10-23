// Existing resource DTOs are kept stable during the per-Module migration.
// JSON conversion also removes Prisma Decimal instances at the action boundary.
/* eslint-disable @typescript-eslint/no-explicit-any */
export type ResourceResult = {
  success: boolean;
  message?: string;
  data?: any;
  nextCode?: string;
};

export function resourceResult(value: ResourceResult): ResourceResult {
  return JSON.parse(JSON.stringify(value));
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "An unexpected error occurred.";
}
