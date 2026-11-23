import { authorizedShop } from "@/lib/shop/auth";
import { stockError, stockResponse } from "@/lib/shop/http";
import { productIds, readInventory } from "@/lib/shop/inventory";

/** What the shop can sell of each Size from the shop Warehouse, read-only, for CREOMS; the same rule as /api/shop/stock. */
export async function GET(request: Request) {
  if (!authorizedShop(request)) return stockResponse({ error: "unauthorized" }, 401);
  try { return stockResponse(await readInventory(productIds(new URL(request.url).searchParams.get("productIds")))); } catch (error) { return stockError(error); }
}
