import { expect, it } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";
it("preserves the original page across the sign-in redirect", () => {
  const response = proxy(
    new NextRequest("https://localhost:3003/inventory?lot=42"),
  );
  expect(response.headers.get("location")).toBe(
    "https://localhost:3003/api/portal/login?returnTo=%2Finventory%3Flot%3D42",
  );
});

it("refuses unsigned data requests and never treats cookie presence as validation", () => {
  expect(
    proxy(new NextRequest("https://localhost:3003/api/items")).status,
  ).toBe(401);
  const request = new NextRequest("https://localhost:3003/inventory?lot=42", {
    headers: {
      "x-return-to": "//evil.example",
      "x-ims-request-url": "https://evil.example",
    },
  });
  request.cookies.set("ims_session", "unverified");
  const response = proxy(request);
  expect(response.headers.get("x-middleware-request-x-return-to")).toBe(
    "/inventory?lot=42",
  );
  expect(response.headers.get("x-middleware-request-x-ims-request-url")).toBe(
    "https://localhost:3003/inventory?lot=42",
  );
});
