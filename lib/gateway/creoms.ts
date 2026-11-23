import { createHmac } from "node:crypto";

/** What CREOMS keeps of one Size: its row in crms.stock_count. The IMS is the only writer. */
export type CreomsStockPush = {
  productId: number;
  name: string;
  variant: string | null;
  image: string | null;
  price: number;
  active: boolean;
  /** What the shop can sell from the shop Warehouse; null when the IMS could not count it this time. */
  quantity: number | null;
  reserved: number | null;
  available: number | null;
  /** Rises with every read, so CREOMS keeps only the newest figures when pushes cross. Microseconds, as a string. */
  version: string;
};

const MIN_SECRET = 32;
const TIMEOUT_MS = 5_000;

function settings() {
  const base = process.env.CREOMS_URL?.replace(/\/$/, "");
  const secret = process.env.IMS_CREOMS_SECRET;
  return base && secret && secret.length >= MIN_SECRET ? { base, secret } : null;
}

/** A five-minute HS256 credential that opens only CREOMS's stock push (the same shape CREOMS uses for the shop). */
export function creomsCredential(secret: string, now = new Date()): string {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const iat = Math.floor(now.getTime() / 1000);
  const input = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ iss: "ims", aud: "creoms-stock", scope: "stock:push", iat, exp: iat + 300 })}`;
  return `${input}.${createHmac("sha256", secret).update(input).digest("base64url")}`;
}

/**
 * Sends one Size's figures to CREOMS's stock count. Without CREOMS_URL and IMS_CREOMS_SECRET it sends nothing, so the
 * IMS works before CREOMS is ready; a refusal throws so the caller tries again on the next write.
 */
export async function pushStockToCreoms(push: CreomsStockPush, signal: AbortSignal = AbortSignal.timeout(TIMEOUT_MS)): Promise<void> {
  const config = settings();
  if (!config) return;
  const response = await fetch(`${config.base}/api/internal/ims-stock`, {
    method: "POST", cache: "no-store", redirect: "error", signal,
    headers: { Authorization: `Bearer ${creomsCredential(config.secret)}`, "Content-Type": "application/json" },
    body: JSON.stringify(push),
  });
  if (!response.ok) throw new Error(`CREOMS refused the stock push: ${response.status}`);
}
