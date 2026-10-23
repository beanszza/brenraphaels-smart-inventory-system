export const SESSION_COOKIE = "ims_session";
export const HANDOFF_COOKIE = "ims_handoff";
export const CALLBACK_PATH = "/api/portal/callback";
export const LOGIN_PATH = "/api/portal/login";
export const LOGOUT_PATH = "/api/portal/logout";
export const SIGNING_IN_PATH = "/signing-in";
export const MODULES = [
  "Dashboard",
  "Resources & Suppliers",
  "Orders & Procurement",
  "Goods Receiving",
  "Inventory",
  "Production & Quality",
  "Stock Transfer",
] as const;
export type Module = (typeof MODULES)[number];
export const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set; see .env.example`);
  return value;
}

/** Only the registered production origin and local HTTPS development may receive codes. */
export function appOrigin() {
  const url = new URL(process.env.IMS_APP_URL ?? "https://localhost:3003");
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/" ||
    (!LOCAL_HOSTS.has(url.hostname) &&
      url.origin !== "https://br-sims.vercel.app")
  ) {
    throw new Error(
      "IMS_APP_URL must be the production origin or a localhost HTTPS origin",
    );
  }
  return url.origin;
}

export function portalConfig() {
  const portal = new URL(required("PORTAL_URL"));
  if (
    portal.username ||
    portal.password ||
    portal.search ||
    portal.hash ||
    portal.pathname !== "/" ||
    (portal.protocol !== "https:" &&
      !(portal.protocol === "http:" && LOCAL_HOSTS.has(portal.hostname)))
  ) {
    throw new Error(
      "PORTAL_URL must be an HTTPS origin (HTTP allowed only on localhost)",
    );
  }
  if (
    process.env.PORTAL_SYSTEM_NAME &&
    process.env.PORTAL_SYSTEM_NAME !== "IMS"
  ) {
    throw new Error("PORTAL_SYSTEM_NAME must be IMS");
  }
  return {
    portalUrl: portal.origin,
    systemName: "IMS",
    systemSecret: required("PORTAL_SYSTEM_SECRET"),
    callbackUrl: `${appOrigin()}${CALLBACK_PATH}`,
    logoutUrl: `${portal.origin}/logout`,
  };
}
