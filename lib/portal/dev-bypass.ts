import type { Staff } from "./client";
import { LOCAL_HOSTS } from "./config";

export const DEV_STAFF: Staff = {
  id: "ims-dev",
  name: "Dev Staff",
  username: "dev.staff",
  email: "dev.staff@localhost",
};

/** Both the configured origin and this request must be local. No forwarded header is trusted. */
export function devBypassEnabled(
  requestUrl: string,
  env: Record<string, string | undefined> = process.env,
): boolean {
  if (env.IMS_DEV_BYPASS !== "true") return false;
  if (
    env.NODE_ENV === "production" ||
    env.VERCEL ||
    env.VERCEL_ENV ||
    env.VERCEL_URL
  ) {
    throw new Error("IMS_DEV_BYPASS refuses production and Vercel");
  }
  if (
    !LOCAL_HOSTS.has(
      new URL(env.IMS_APP_URL ?? "https://localhost:3003").hostname,
    ) ||
    !LOCAL_HOSTS.has(new URL(requestUrl).hostname)
  ) {
    throw new Error("IMS_DEV_BYPASS refuses non-localhost");
  }
  return true;
}
