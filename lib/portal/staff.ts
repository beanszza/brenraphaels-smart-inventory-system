import { recordAudit, auditContext } from "@/lib/audit";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse, type NextRequest } from "next/server";
import { moduleForPath } from "@/components/shared/SidebarNav";
import { accessFor, modulesFor } from "./access";
import { SESSION_COOKIE, SIGNING_IN_PATH, MODULES, type Module } from "./config";
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
      redirect(`${SIGNING_IN_PATH}?returnTo=${returnTo}`);
    case "denied":
      await recordAccessDenial((await cookies()).get(SESSION_COOKIE)?.value, module, requestHeaders);
      redirect("/no-access");
    case "unavailable":
      redirect(`/unavailable?returnTo=${returnTo}`);
  }
}

/**
 * The page shell asks for every Module the Staff member holds, then sends them to the
 * no-access page when they hold none or do not hold the one that owns the requested page.
 */
export async function requireShell(
  pathname: string,
): Promise<{ staff: Staff; modules: Module[] }> {
  const requestHeaders = await headers();
  const requestUrl = requestHeaders.get("x-ims-request-url");
  if (requestUrl && devBypassEnabled(requestUrl)) {
    return { staff: DEV_STAFF, modules: [...MODULES] };
  }
  const result = await modulesFor((await cookies()).get(SESSION_COOKIE)?.value);
  const returnTo = encodeURIComponent(safeReturnTo(pathname));
  switch (result.decision) {
    case "invalid":
      redirect(`${SIGNING_IN_PATH}?returnTo=${returnTo}`);
    case "denied":
      redirect("/no-access");
    case "unavailable":
      redirect(`/unavailable?returnTo=${returnTo}`);
  }
  const owner = moduleForPath(pathname);
  if (!owner || !result.modules.includes(owner)) {
    if (owner) await recordAccessDenial(undefined, owner, requestHeaders, result.staff);
    redirect("/no-access");
  }
  return { staff: result.staff, modules: result.modules };
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
  if (result.decision === "denied") await recordAccessDenial(request.cookies.get(SESSION_COOKIE)?.value, module, request.headers);
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

async function recordAccessDenial(handle: string | undefined, module: Module, requestHeaders: Headers, staff?: Staff) {
  try {
    if (!staff) {
      const held = await modulesFor(handle);
      if (held.decision !== "allowed") return; // Portal returns no identity for an entirely denied handle.
      staff = held.staff;
    }
    const context = auditContext(requestHeaders);
    await recordAudit(staff, { module: null, action: "ims.access_denied", outcome: "failure",
      target: { type: "module", id: module, name: module },
      description: `${staff.name} was denied access to ${module}`, context,
      version: context.request_id ?? "denied", metadata: { requested_module: module } });
  } catch (error) { console.error("Access audit could not be recorded", error); }
}
