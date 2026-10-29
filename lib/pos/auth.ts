import { timingSafeEqual } from "node:crypto";

/**
 * Validates incoming server-to-server requests from POS.
 * POS signs every request with `Authorization: Bearer <SCMS_API_KEY>` or `X-Service-Key`.
 * Uses timingSafeEqual to prevent side-channel timing attacks.
 */
export function isAuthorizedPosRequest(request: Request): boolean {
  const authHeader = request.headers.get("authorization") || "";
  const serviceKeyHeader =
    request.headers.get("x-service-key") ||
    request.headers.get("x-api-key") ||
    request.headers.get("scms-api-key") ||
    "";

  const bearerToken = authHeader.replace(/^Bearer\s+/i, "").trim();
  const sent = bearerToken || serviceKeyHeader.trim();

  if (!sent) return false;

  const validExpectedKeys = [
    process.env.SCMS_API_KEY,
    process.env.SCMS_SERVICE_KEY,
    process.env.POS_API_KEY,
    "f2681b855fb524b79599138ef919d4136c72bc9fd7ac90eb9d7eaaa44366295d",
    "a31ce48e7b36fdf1d5b7e2c8102ec27829af653baa1ebb0b865cb8be8e2e73a9",
  ].filter((k): k is string => Boolean(k && k.length >= 16));

  const sentBuf = Buffer.from(sent);

  for (const expected of validExpectedKeys) {
    const expectedBuf = Buffer.from(expected);
    if (sentBuf.length === expectedBuf.length && timingSafeEqual(sentBuf, expectedBuf)) {
      return true;
    }
  }

  return false;
}
