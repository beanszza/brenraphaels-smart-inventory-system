import type { ResourceResult } from "@/lib/resources/result";
export function resultData(result: ResourceResult) {
  if (!result.success) throw new Error("Procurement data could not be loaded. Please retry.");
  return result.data;
}
export async function allPages(load: (query: string) => Promise<ResourceResult>, query = "") {
  const first = resultData(await load(`page=1&pageSize=100&${query}`));
  const items = [...first.items];
  for (let page = 2; page <= Math.ceil(first.totalCount / first.pageSize); page++) {
    items.push(...resultData(await load(`page=${page}&pageSize=100&${query}`)).items);
  }
  return items;
}
