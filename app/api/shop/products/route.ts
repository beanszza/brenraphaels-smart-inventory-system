import { authorizedShop } from "@/lib/shop/auth";
import { stockError, stockResponse } from "@/lib/shop/http";
import { readProducts } from "@/lib/shop/products";

export async function GET(request: Request) {
  if (!authorizedShop(request)) return stockResponse({ error: "unauthorized" }, 401);
  try { return stockResponse(await readProducts()); } catch (error) { return stockError(error); }
}
