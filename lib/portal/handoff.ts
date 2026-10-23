import { NextResponse, type NextRequest } from "next/server";
import {
  CALLBACK_PATH,
  HANDOFF_COOKIE,
  SESSION_COOKIE,
  appOrigin,
  portalConfig,
} from "./config";
import { challengeFor, newState, newVerifier } from "./pkce";
import { portalClient, type PortalPort } from "./client";
import { safeReturnTo } from "./return-to";
import { devBypassEnabled } from "./dev-bypass";

function originAllowed(request: NextRequest) {
  return request.nextUrl.origin === appOrigin();
}
function noStore(response: NextResponse) {
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}

export function login(request: NextRequest) {
  if (!originAllowed(request))
    return noStore(
      NextResponse.json({ error: "untrusted_origin" }, { status: 400 }),
    );
  const { portalUrl, callbackUrl, systemName } = portalConfig();
  const state = newState();
  const verifier = newVerifier();
  const authorize = new URL("/api/integrations/authorize", portalUrl);
  authorize.search = new URLSearchParams({
    system: systemName,
    redirect_uri: callbackUrl,
    state,
    code_challenge: challengeFor(verifier),
    code_challenge_method: "S256",
  }).toString();
  const response = NextResponse.redirect(authorize);
  response.cookies.set(
    HANDOFF_COOKIE,
    JSON.stringify({
      state,
      verifier,
      returnTo: safeReturnTo(request.nextUrl.searchParams.get("returnTo")),
      createdAt: Date.now(),
    }),
    {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: CALLBACK_PATH,
      maxAge: 600,
    },
  );
  return noStore(response);
}

export async function callback(
  request: NextRequest,
  portal: PortalPort = portalClient,
) {
  if (!originAllowed(request))
    return noStore(
      NextResponse.json({ error: "untrusted_origin" }, { status: 400 }),
    );
  const finish = (response: NextResponse) => {
    response.cookies.delete({ name: HANDOFF_COOKIE, path: CALLBACK_PATH });
    return noStore(response);
  };
  const failed = (reason: string) => {
    const response = NextResponse.redirect(
      new URL(`/sign-in-error?reason=${reason}`, appOrigin()),
    );
    response.cookies.delete(SESSION_COOKIE);
    return finish(response);
  };
  let handoff;
  try {
    handoff = JSON.parse(request.cookies.get(HANDOFF_COOKIE)?.value ?? "");
  } catch {
    return failed("failed");
  }
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  if (
    !code ||
    !state ||
    typeof handoff?.state !== "string" ||
    state !== handoff.state ||
    typeof handoff.verifier !== "string" ||
    !/^[A-Za-z0-9_-]{43}$/.test(handoff.verifier) ||
    !Number.isFinite(handoff.createdAt) ||
    handoff.createdAt > Date.now() ||
    Date.now() - handoff.createdAt > 600000
  ) {
    return failed("failed");
  }
  try {
    const result = await portal.exchange({
      code,
      state,
      codeVerifier: handoff.verifier,
    });
    if (!result.ok)
      return failed(result.reason === "rejected" ? "failed" : result.reason);
    const response = NextResponse.redirect(
      new URL(safeReturnTo(handoff.returnTo), appOrigin()),
    );
    response.cookies.set(SESSION_COOKIE, result.sessionHandle, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      expires: result.expiresAt,
    });
    return finish(response);
  } catch {
    return failed("unavailable");
  }
}

/** Portal logout revokes all Systems' handles issued from this browser's central session. */
export function logout(request: NextRequest) {
  if (
    !originAllowed(request) ||
    request.headers.get("origin") !== appOrigin()
  ) {
    return noStore(
      NextResponse.json({ error: "untrusted_origin" }, { status: 403 }),
    );
  }
  const destination = devBypassEnabled(request.url)
    ? appOrigin()
    : portalConfig().logoutUrl;
  const response = NextResponse.redirect(destination, 303);
  response.cookies.delete(SESSION_COOKIE);
  response.cookies.delete({ name: HANDOFF_COOKIE, path: CALLBACK_PATH });
  return noStore(response);
}
