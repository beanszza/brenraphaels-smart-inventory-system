import type { ResourceResult } from "@/lib/resources/result";

// Filters and summary cards need the entire collection, including later pages.
export async function inventoryPages<T>(load: (query: string) => Promise<ResourceResult>, query: string): Promise<{ items: T[]; totalCount: number }> {
  const items: T[] = [];
  let page = 1;
  let totalCount = 0;
  do {
    const result = await load(`${query}&page=${page}`);
    if (!result.success || !Array.isArray(result.data?.items)) {
      throw new Error("Inventory could not be loaded. Please retry.");
    }
    totalCount = result.data.totalCount;
    if (result.data.items.length === 0 && items.length < totalCount) {
      throw new Error("Inventory changed while loading. Please retry.");
    }
    items.push(...result.data.items);
    page++;
  } while (items.length < totalCount);
  return { items, totalCount };
}
