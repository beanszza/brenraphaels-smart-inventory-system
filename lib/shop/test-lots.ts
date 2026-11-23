/** Lots seeded for testing. Neither the Finished Goods tab nor the shop ever counts them. */
export const SEEDED_TEST_LOT_PREFIXES = ["LOT-UJH-2026-", "LOT-UBH-2026-"];

export const isSeededTestLot = (code: string) => SEEDED_TEST_LOT_PREFIXES.some(prefix => code.startsWith(prefix));
