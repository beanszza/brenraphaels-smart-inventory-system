import {
  portalClient,
  type PortalPort,
  type Staff,
  type Validation,
} from "./client";
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

export type HeldModules =
  | { decision: "allowed"; staff: Staff; modules: Module[] }
  | { decision: "invalid" | "denied" | "unavailable" };

/**
 * Every Module the Staff member holds right now, with Dashboard first when any is held.
 * Asked of the Portal on each call, so a revoked Module drops out on the next load.
 */
export async function modulesFor(
  handle: string | undefined,
  { portal = portalClient }: { portal?: PortalPort } = {},
): Promise<HeldModules> {
  if (!handle) return { decision: "invalid" };
  const owned = MODULES.filter((name) => name !== "Dashboard");
  let results: Validation[];
  try {
    results = await Promise.all(owned.map((name) => portal.validate(handle, name)));
  } catch {
    return { decision: "unavailable" };
  }
  // Revocation or an outage always denies, even if a concurrent answer allowed a Module.
  if (results.some((r) => r.decision === "invalid")) return { decision: "invalid" };
  if (results.some((r) => r.decision === "unavailable")) return { decision: "unavailable" };
  const held = owned.filter((_, i) => results[i].decision === "allowed");
  const first = results.find((r) => r.decision === "allowed");
  if (!first || first.decision !== "allowed") return { decision: "denied" };
  return { decision: "allowed", staff: first.staff, modules: ["Dashboard", ...held] };
}
