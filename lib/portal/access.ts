import { portalClient, type PortalPort, type Validation } from "./client";
import { MODULES, type Module } from "./config";

/** A new checker per request; no session or grant is cached between requests. */
export function accessFor(
  handle: string | undefined,
  { portal = portalClient }: { portal?: PortalPort } = {},
) {
  async function check(module: Module): Promise<Validation> {
    if (!handle) return { decision: "invalid" };
    try {
      if (module !== "Dashboard") return await portal.validate(handle, module);
      const results = await Promise.all(
        MODULES.map((name) => portal.validate(handle, name)),
      );
      // Revocation or an outage always denies, even if a concurrent answer allowed a Module.
      return (
        results.find((r) => r.decision === "invalid") ??
        results.find((r) => r.decision === "unavailable") ??
        results.find((r) => r.decision === "allowed") ?? { decision: "denied" }
      );
    } catch {
      return { decision: "unavailable" };
    }
  }
  return { check };
}
