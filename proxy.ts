import { NextResponse, type NextRequest } from "next/server";
import { devBypassEnabled } from "@/lib/portal/dev-bypass";
import { appOrigin, SESSION_COOKIE } from "@/lib/portal/config";

const PUBLIC_PATHS = new Set([
  "/api/portal/login",
  "/api/portal/callback",
  "/api/portal/logout",
  "/signing-in",
  "/sign-in-error",
  "/no-access",
  "/unavailable",
]);

/** Presence is only an early check. Each protected operation must also use its Module guard. */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (PUBLIC_PATHS.has(pathname)) return NextResponse.next();
  const bypass = devBypassEnabled(request.url);
  if (request.nextUrl.origin !== appOrigin()) {
    return NextResponse.json({ error: "untrusted_origin" }, { status: 400 });
  }
  const returnTo = `${pathname}${search}`;
  if (!bypass && !request.cookies.get(SESSION_COOKIE)?.value) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "session_ended" },
        { status: 401, headers: { "Cache-Control": "no-store" } },
      );
    }
    const login = new URL("/signing-in", appOrigin());
    login.searchParams.set("returnTo", returnTo);
    return NextResponse.redirect(login);
  }
  const headers = new Headers(request.headers);
  headers.set("x-return-to", returnTo);
  headers.set("x-ims-request-url", request.url);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: [
    "/((?!_next/static/|_next/image|favicon.ico|images/|uploads/|fonts/).*)",
  ],
};
