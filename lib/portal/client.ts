import { portalConfig } from "./config";

export type Staff = {
  id: string;
  name: string;
  username: string;
  email: string;
};
export type ExchangeResult =
  | { ok: true; sessionHandle: string; expiresAt: Date }
  | { ok: false; reason: "rejected" | "denied" | "unavailable" };
export type Validation =
  | { decision: "allowed"; staff: Staff }
  | { decision: "invalid" | "denied" | "unavailable" };
export interface PortalPort {
  exchange(input: {
    code: string;
    state: string;
    codeVerifier: string;
  }): Promise<ExchangeResult>;
  validate(handle: string, module: string): Promise<Validation>;
}

/** The only positive answer is a current, well-formed Portal decision. */
export const portalClient: PortalPort = {
  async exchange(input) {
    const response = await postJson("/api/integrations/exchange", {
      code: input.code,
      state: input.state,
      code_verifier: input.codeVerifier,
      redirect_uri: portalConfig().callbackUrl,
    });
    if (!response || response.status >= 500)
      return { ok: false, reason: "unavailable" };
    if (response.status === 403) return { ok: false, reason: "denied" };
    const body = response.ok ? await response.json().catch(() => null) : null;
    if (
      typeof body?.handle !== "string" ||
      !body.handle ||
      !Number.isFinite(body.expires_in) ||
      body.expires_in <= 0 ||
      body.expires_in > 28800
    ) {
      return { ok: false, reason: "rejected" };
    }
    return {
      ok: true,
      sessionHandle: body.handle,
      expiresAt: new Date(Date.now() + body.expires_in * 1000),
    };
  },
  async validate(handle, module) {
    const response = await postJson("/api/integrations/validate", {
      handle,
      module,
    });
    if (!response) return { decision: "unavailable" };
    const body = await response.json().catch(() => null);
    if (response.status === 401 && body?.error === "invalid_handle")
      return { decision: "invalid" };
    if (response.status === 403) return { decision: "denied" };
    if (
      response.status !== 200 ||
      body?.active !== true ||
      body.system !== "IMS" ||
      body.module !== module ||
      typeof body.user_id !== "string" ||
      !body.user_id ||
      typeof body.staff?.name !== "string" ||
      typeof body.staff?.username !== "string" ||
      !body.staff.username ||
      typeof body.staff?.email !== "string"
    )
      return { decision: "unavailable" };
    return {
      decision: "allowed",
      staff: {
        id: body.user_id,
        name: body.staff.name,
        username: body.staff.username,
        email: body.staff.email,
      },
    };
  },
};

async function postJson(path: string, body: unknown): Promise<Response | null> {
  try {
    const { portalUrl, systemSecret } = portalConfig();
    return await fetch(`${portalUrl}${path}`, {
      method: "POST",
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(5000),
      headers: {
        authorization: `Basic ${Buffer.from(`IMS:${systemSecret}`).toString("base64")}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch {
    return null;
  }
}
