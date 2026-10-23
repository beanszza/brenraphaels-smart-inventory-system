import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse, type NextRequest } from "next/server";
import { accessFor } from "./access";
import { SESSION_COOKIE, LOGIN_PATH, type Module } from "./config";
import { DEV_STAFF, devBypassEnabled } from "./dev-bypass";
import { safeReturnTo } from "./return-to";
import type { Staff } from "./client";

/** Pages and server actions must call this before loading or mutating data. */
export async function requireModule(module: Module): Promise<Staff> {
  const requestHeaders = await headers();
  const requestUrl = requestHeaders.get("x-ims-request-url");
  if (requestUrl && devBypassEnabled(requestUrl)) return DEV_STAFF;
  const result = await accessFor(
    (await cookies()).get(SESSION_COOKIE)?.value,
  ).check(module);
  if (result.decision === "allowed") return result.staff;
  const returnTo = encodeURIComponent(
    safeReturnTo(requestHeaders.get("x-return-to")),
  );
  switch (result.decision) {
    case "invalid":
      redirect(`${LOGIN_PATH}?returnTo=${returnTo}`);
    case "denied":
      redirect("/no-access");
    case "unavailable":
      redirect(`/unavailable?returnTo=${returnTo}`);
  }
}

/** Route handlers must return the denial before executing any data operation. */
export async function requireRouteModule(
  request: NextRequest,
  module: Module,
): Promise<{ ok: true; staff: Staff } | { ok: false; response: NextResponse }> {
  if (devBypassEnabled(request.url)) return { ok: true, staff: DEV_STAFF };
  const result = await accessFor(
    request.cookies.get(SESSION_COOKIE)?.value,
  ).check(module);
  if (result.decision === "allowed") return { ok: true, staff: result.staff };
  return {
    ok: false,
    response: NextResponse.json(
      { error: result.decision },
      {
        status:
          result.decision === "invalid"
            ? 401
            : result.decision === "denied"
              ? 403
              : 503,
        headers: { "Cache-Control": "no-store" },
      },
    ),
  };
}
