import { listRequests } from "@/app/actions/stock-transfer/requests";
import { listTransfers } from "@/app/actions/stock-transfer/transfers";
import { requestDashboard } from "@/app/actions/stock-transfer/request-dashboard";
import { transferDashboard } from "@/app/actions/stock-transfer/transfer-dashboard";
import { listLocations } from "@/app/actions/stock-transfer/locations";
import type { ResourceResult } from "@/lib/resources/result";
import type { StockTransferRequest, StockTransfer, DashboardMetrics } from "@/components/stock-transfer/types";

export interface TransferLocation {
  locationId: number; locationName: string; locationType: string;
  status: string; address: string | null; isSystemLocation: boolean;
}
function checked(result: ResourceResult) {
  if (!result.success || result.data == null) throw new Error("Stock Transfer data could not be loaded. Please retry.");
  return result.data;
}
export async function allRows<T>(reader: (query: string) => Promise<ResourceResult>): Promise<T[]> {
  const rows: T[] = [];
  let page = 1;
  let totalPages = 1;
  do {
    const result = await reader(`page=${page}&pageSize=100`);
    const data = checked(result);
    if (!Array.isArray(data)) throw new Error("Stock Transfer rows could not be loaded. Please retry.");
    rows.push(...data);
    totalPages = result.pagination?.totalPages ?? 1;
    page++;
  } while (page <= totalPages);
  return rows;
}
async function locations(): Promise<TransferLocation[]> {
  const data = checked(await listLocations());
  if (!Array.isArray(data)) throw new Error("Locations could not be loaded. Please retry.");
  return data;
}
export async function loadStockTransferScreen() {
  const [requests, metrics, initialLocations] = await Promise.all([
    allRows<StockTransferRequest>(listRequests), requestDashboard(), locations(),
  ]);
  const data = checked(metrics);
  if (!["totalRequests", "pendingApproval", "approvedRequests", "dispatchedTransfers", "scheduledTransfers"].every(key => typeof data[key] === "number"))
    throw new Error("Stock Transfer metrics could not be loaded. Please retry.");
  return { requests, metrics: data as DashboardMetrics, locations: initialLocations };
}
export type StockTransferScreen = Awaited<ReturnType<typeof loadStockTransferScreen>>;
export async function loadDistributionScreen() {
  const [transfers, initialLocations, stats] = await Promise.all([
    allRows<StockTransfer>(listTransfers), locations(), transferDashboard(),
  ]);
  const data = checked(stats);
  if (!["total", "pending", "dispatched", "received"].every(key => typeof data[key] === "number"))
    throw new Error("Distribution metrics could not be loaded. Please retry.");
  return { transfers, locations: initialLocations, stats: { total: data.total as number, pending: data.pending as number,
    inTransit: data.dispatched as number, completed: data.received as number } };
}
export type DistributionScreen = Awaited<ReturnType<typeof loadDistributionScreen>>;
