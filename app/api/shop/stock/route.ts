import { movementInput, moveStock } from "@/lib/shop/movements";
import { authorizedShop } from "@/lib/shop/auth";
import { productId, readStock } from "@/lib/shop/stock";
import { stockError, stockResponse } from "@/lib/shop/http";

export async function GET(request: Request) {
  if (!authorizedShop(request)) return stockResponse({ error: "unauthorized" }, 401);
  try {
    return stockResponse(await readStock(productId(new URL(request.url).searchParams.get("productId"))));
  } catch (error) { return stockError(error); }
}

export async function POST(request: Request) {
  if (!authorizedShop(request)) return stockResponse({ error: "unauthorized" }, 401);
  try {
    let body: unknown;
    try { body = await request.json(); } catch { return stockResponse({ error: "invalid_json" }, 400); }
    return stockResponse(await moveStock(movementInput(body)));
  } catch (error) { return stockError(error); }
}
