import type { ResourceResult } from "@/lib/resources/result";
import type { ArrivedDelivery } from "@/components/receiving/types";

export function receivingData(result: ResourceResult) {
  if (!result.success) throw new Error("Goods Receiving data could not be loaded. Please retry.");
  return result.data;
}

export async function receivingDeliveries(load: (query: string) => Promise<ResourceResult>): Promise<ArrivedDelivery[]> {
  const first = receivingData(await load("page=1&pageSize=100&status=Arrived"));
  const items = [...first.items];
  for (let page = 2; page <= Math.ceil(first.totalCount / first.pageSize); page++) {
    items.push(...receivingData(await load(`page=${page}&pageSize=100&status=Arrived`)).items);
  }
  return items;
}
