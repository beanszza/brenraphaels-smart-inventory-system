import { authorizedShop } from "@/lib/shop/auth";
import { stockError, stockResponse } from "@/lib/shop/http";
import { productIds, readInventory } from "@/lib/shop/inventory";

/** The Finished Goods tab's per-Size stock, read-only, for CREOMS. Checkout still uses /api/shop/stock. */
export async function GET(request: Request) {
  if (!authorizedShop(request)) return stockResponse({ error: "unauthorized" }, 401);
  try { return stockResponse(await readInventory(productIds(new URL(request.url).searchParams.get("productIds")))); } catch (error) { return stockError(error); }
}
