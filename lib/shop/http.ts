import { StockRefusal } from "./stock";

export function stockResponse(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}
export function stockError(error: unknown) {
  if (error instanceof StockRefusal) return stockResponse({ error: error.code, message: error.message }, error.status);
  console.error("Shop stock request failed");
  return stockResponse({ error: "stock_unavailable", message: "Stock cannot be checked. Try again in a few minutes." }, 503);
}
