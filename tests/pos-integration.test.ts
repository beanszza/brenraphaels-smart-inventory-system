import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";
import { isAuthorizedPosRequest } from "@/lib/pos/auth";

describe("POS integration security & proxy exemptions", () => {
  it("exempts inbound POS integration routes from browser session checks", () => {
    const endpoints = [
      "https://localhost:3003/api/pos/locations/sync",
      "https://localhost:3003/api/scms/locations/sync",
      "https://localhost:3003/api/scms/transfers/TRANS-2026-0001/receive-confirmation",
      "https://localhost:3003/api/StockTransfers/TRANS-2026-0001/status",
    ];

    for (const url of endpoints) {
      const req = new NextRequest(url, {
        method: url.includes("status") ? "PUT" : "POST",
      });
      const res = proxy(req);
      // External routes should not return 401 session_ended
      expect(res.status).not.toBe(401);
    }
  });

  it("verifies timing-safe authorization for POS service keys", () => {
    const validKey = "a31ce48e7b36fdf1d5b7e2c8102ec27829af653baa1ebb0b865cb8be8e2e73a9";
    const authReq = new Request("https://br-sims.vercel.app/api/pos/locations/sync", {
      headers: {
        Authorization: `Bearer ${validKey}`,
      },
    });
    expect(isAuthorizedPosRequest(authReq)).toBe(true);

    const badReq = new Request("https://br-sims.vercel.app/api/pos/locations/sync", {
      headers: {
        Authorization: "Bearer invalid-tampered-key-00000000000000000000000000000000",
      },
    });
    expect(isAuthorizedPosRequest(badReq)).toBe(false);

    const missingReq = new Request("https://br-sims.vercel.app/api/pos/locations/sync", {
      headers: {
        Authorization: "",
      },
    });
    expect(isAuthorizedPosRequest(missingReq)).toBe(false);
  });
});

