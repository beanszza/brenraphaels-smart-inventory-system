import { listProductionRequests } from "@/app/actions/production/requests";
import { listIssuances } from "@/app/actions/production/issuances";
import { listBatches } from "@/app/actions/production/batches";
import { listProductionQa } from "@/app/actions/production/quality";
import { listFinishedProducts } from "@/app/actions/production/products";
import { listItems } from "@/app/actions/production/lookups";
import type { ResourceResult } from "@/lib/resources/result";

export const productionTabs = ["requests", "issuance", "tracking", "qa", "stockin", "configuration", "loss"] as const;
export type ProductionTab = typeof productionTabs[number];
export function productionTab(value?: string): ProductionTab {
  return productionTabs.find(tab => tab === value) ?? "requests";
}

function checked(result: ResourceResult) {
  if (!result.success || !Array.isArray(result.data)) throw new Error("Production data could not be loaded. Please retry.");
  return result.data;
}

export async function loadProductionScreen(tab: ProductionTab) {
  const loaders = { requests: listProductionRequests, issuance: listIssuances, tracking: listBatches,
    qa: () => listProductionQa("status=all"), stockin: listBatches, configuration: listFinishedProducts, loss: listBatches };
  const [result, items] = await Promise.all([loaders[tab](), tab === "stockin" ? listItems() : null]);
  if (items && (!items.success || !Array.isArray(items.data?.items))) throw new Error("Stock levels could not be loaded. Please retry.");
  return { rows: checked(result), items: items?.data?.items ?? [] };
}
