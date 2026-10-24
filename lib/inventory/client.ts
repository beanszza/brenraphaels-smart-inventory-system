import { actionResponse } from "@/lib/resources/action-response";
import { listInventory } from "@/app/actions/inventory/balances";
import { listLots } from "@/app/actions/inventory/lots";
import { listItemLots } from "@/app/actions/inventory/item-lots";
import { listCycleCounts } from "@/app/actions/inventory/counts";
import { listCycleCountItems } from "@/app/actions/inventory/count-items";
import { traceForward } from "@/app/actions/inventory/forward";
import { traceBackward } from "@/app/actions/inventory/backward";
import { simulateRecall } from "@/app/actions/inventory/recall-simulation";
import { getValuation } from "@/app/actions/inventory/valuation";
import { createCycleCount } from "@/app/actions/inventory/cycle-counts";
import { reconcileCycleCount } from "@/app/actions/inventory/cycle-counts";
import { recallLot } from "@/app/actions/inventory/recall";

export const inventory = {
  listInventory: (...args: Parameters<typeof listInventory>) => actionResponse(listInventory(...args)),
  listLots: (...args: Parameters<typeof listLots>) => actionResponse(listLots(...args)),
  listItemLots: (...args: Parameters<typeof listItemLots>) => actionResponse(listItemLots(...args)),
  listCycleCounts: (...args: Parameters<typeof listCycleCounts>) => actionResponse(listCycleCounts(...args)),
  listCycleCountItems: (...args: Parameters<typeof listCycleCountItems>) => actionResponse(listCycleCountItems(...args)),
  traceForward: (...args: Parameters<typeof traceForward>) => actionResponse(traceForward(...args)),
  traceBackward: (...args: Parameters<typeof traceBackward>) => actionResponse(traceBackward(...args)),
  simulateRecall: (...args: Parameters<typeof simulateRecall>) => actionResponse(simulateRecall(...args)),
  getValuation: (...args: Parameters<typeof getValuation>) => actionResponse(getValuation(...args)),
  createCycleCount: (...args: Parameters<typeof createCycleCount>) => actionResponse(createCycleCount(...args)),
  reconcileCycleCount: (...args: Parameters<typeof reconcileCycleCount>) => actionResponse(reconcileCycleCount(...args)),
  recallLot: (...args: Parameters<typeof recallLot>) => actionResponse(recallLot(...args)),
};
