import { createHash, randomBytes } from "node:crypto";
import type { Staff } from "@/lib/portal/client";

/**
 * A small stand-in for the Portal that follows the System handoff contract
 * (authorize, exchange, validate), including the current Staff profile on a positive validate.
 * Shared by the route tests; it knows nothing about IMS internals.
 */
export const FAKE_PORTAL_URL = "https://portal.test";
export const FAKE_SYSTEM = "IMS";
export const FAKE_SECRET = "fake-system-secret-fake-system-secret";
export const FAKE_CALLBACK = "https://localhost:3003/api/portal/callback";

type Code = {
  callback: string;
  state: string;
  challenge: string;
  staffId: string;
};

export class FakePortal {
  private staffById = new Map<string, Staff>();
  private centralSession: string | null = null;
  private nextSessionId = 1;
  private codes = new Map<string, Code>();
  private handles = new Map<string, { staffId: string; sessionId: number }>();
  private liveSessions = new Set<number>();
  private currentSessionId: number | null = null;
  private modulesById = new Map<string, Set<string>>();

  addStaff(id: string, staff: Staff, modules: string[] = ["Inventory"]) {
    this.staffById.set(id, staff);
    this.modulesById.set(id, new Set(modules));
  }

  grant(staffId: string, module: string) {
    this.modulesById.get(staffId)?.add(module);
  }

  /** An administrator removes a Module; the Staff member's open session is untouched. */
  revoke(staffId: string, module: string) {
    this.modulesById.get(staffId)?.delete(module);
  }

  /** The browser signs in at the Portal. */
  signIn(staffId: string) {
    this.centralSession = staffId;
    this.currentSessionId = this.nextSessionId++;
    this.liveSessions.add(this.currentSessionId);
  }

  /** Central logout: the one session ends, and with it every handle issued from it. */
  signOut() {
    this.centralSession = null;

    if (this.currentSessionId !== null) {
      this.liveSessions.delete(this.currentSessionId);
    }

    this.currentSessionId = null;
  }

  /** An administrator deletes the Staff member. */
  remove(staffId: string) {
    this.staffById.delete(staffId);
  }

  /** The Portal cannot decide: it answers 503 until restored. */
  unavailable = false;

  /** Every issued code is past its 60 second life. */
  expireCodes() {
    this.codes.clear();
  }

  handle = async (request: Request): Promise<Response> => {
    const url = new URL(request.url);

    if (url.pathname === "/logout") return this.logout();
    if (url.pathname === "/api/integrations/authorize")
      return this.authorize(url);
    if (url.pathname === "/api/integrations/exchange")
      return this.token(request);
    if (url.pathname === "/api/integrations/validate")
      return this.validate(request);

    return new Response("not found", { status: 404 });
  };

  private logout(): Response {
    this.signOut();

    return Response.redirect(`${FAKE_PORTAL_URL}/login`, 302);
  }

  private authorize(url: URL): Response {
    const p = url.searchParams;
    const callback = p.get("redirect_uri");
    const state = p.get("state");
    const challenge = p.get("code_challenge");

    if (
      p.get("system") !== FAKE_SYSTEM ||
      callback !== FAKE_CALLBACK ||
      !state ||
      !challenge ||
      p.get("code_challenge_method") !== "S256"
    ) {
      return Response.json({ error: "invalid_request" }, { status: 400 });
    }

    if (!this.centralSession) {
      const returnTo = encodeURIComponent(`${url.pathname}${url.search}`);

      return Response.redirect(
        `${FAKE_PORTAL_URL}/login?returnTo=${returnTo}`,
        302,
      );
    }

    const code = randomBytes(24).toString("base64url");
    this.codes.set(code, {
      callback,
      state,
      challenge,
      staffId: this.centralSession,
    });

    const granted = new URL(callback);
    granted.searchParams.set("code", code);
    granted.searchParams.set("state", state);

    return Response.redirect(granted, 302);
  }

  private async token(request: Request): Promise<Response> {
    const expected = `Basic ${Buffer.from(`${FAKE_SYSTEM}:${FAKE_SECRET}`).toString("base64")}`;

    if (request.headers.get("authorization") !== expected) {
      return Response.json({ error: "invalid_client" }, { status: 401 });
    }

    const body = await request.json();
    const stored = this.codes.get(body.code);
    this.codes.delete(body.code); // single use, spent even when the proof is wrong

    const verified =
      stored &&
      stored.callback === body.redirect_uri &&
      stored.state === body.state &&
      stored.challenge ===
        createHash("sha256")
          .update(String(body.code_verifier))
          .digest("base64url");

    if (!stored || !verified) {
      return Response.json({ error: "invalid_grant" }, { status: 400 });
    }

    const handle = randomBytes(32).toString("base64url");
    this.handles.set(handle, {
      staffId: stored.staffId,
      sessionId: this.currentSessionId!,
    });

    return Response.json({ handle, token_type: "opaque", expires_in: 28800 });
  }

  private async validate(request: Request): Promise<Response> {
    const body = await request.json();
    if (this.unavailable) {
      return Response.json(
        { error: "temporarily_unavailable" },
        { status: 503 },
      );
    }

    const issued = this.handles.get(body.handle);
    const staffId = issued?.staffId;
    const staff = staffId ? this.staffById.get(staffId) : undefined;

    if (!issued || !this.liveSessions.has(issued.sessionId)) {
      return Response.json({ error: "invalid_handle" }, { status: 401 });
    }

    if (!staffId || !staff) {
      return Response.json({ error: "access_denied" }, { status: 403 });
    }

    if (!this.modulesById.get(staffId)?.has(body.module)) {
      return Response.json({ error: "module_not_granted" }, { status: 403 });
    }

    return Response.json({
      active: true,
      user_id: staffId,
      system: FAKE_SYSTEM,
      module: body.module,
      staff,
    });
  }
}

/** Routes fetches aimed at the fake Portal to it; everything else is refused. */
export function portalFetch(portal: FakePortal): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init);

    if (!request.url.startsWith(FAKE_PORTAL_URL)) {
      throw new Error(`Unexpected outbound request to ${request.url}`);
    }

    return portal.handle(request);
  }) as typeof fetch;
}
