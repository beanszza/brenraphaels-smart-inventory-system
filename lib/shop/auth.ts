import { timingSafeEqual } from "node:crypto";

/** A dedicated server-only shop credential; browser sessions and POS keys do not grant access. */
export function authorizedShop(request: Request): boolean {
  const expected = process.env.IMS_SHOP_API_KEY;
  const match = /^Bearer ([^\s]+)$/i.exec(request.headers.get("authorization") ?? "");
  if (!expected || expected.length < 32 || !match) return false;
  const sent = Buffer.from(match[1]);
  const key = Buffer.from(expected);
  return sent.length === key.length && timingSafeEqual(sent, key);
}
