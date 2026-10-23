import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { login, callback, logout } from "@/lib/portal/handoff";
import {
  SESSION_COOKIE,
  HANDOFF_COOKIE,
  CALLBACK_PATH,
} from "@/lib/portal/config";
import { portalClient } from "@/lib/portal/client";
import { accessFor } from "@/lib/portal/access";
import {
  FakePortal,
  portalFetch,
  FAKE_PORTAL_URL,
  FAKE_SECRET,
} from "./fake-portal";

const origin = "https://localhost:3003";
const staff = {
  id: "staff-1",
  name: "Ada",
  username: "2026-AB-001",
  email: "ada@example.com",
};
let portal: FakePortal;
beforeEach(() => {
  vi.stubEnv("IMS_APP_URL", origin);
  vi.stubEnv("PORTAL_URL", FAKE_PORTAL_URL);
  vi.stubEnv("PORTAL_SYSTEM_SECRET", FAKE_SECRET);
  vi.stubEnv("IMS_DEV_BYPASS", "false");
  portal = new FakePortal();
  portal.addStaff(staff.id, staff, ["Inventory"]);
  portal.signIn(staff.id);
  vi.stubGlobal("fetch", portalFetch(portal));
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

async function start(returnTo = "/inventory?lot=42") {
  const response = login(
    new NextRequest(
      `${origin}/api/portal/login?returnTo=${encodeURIComponent(returnTo)}`,
    ),
  );
  const handoff = response.cookies.get(HANDOFF_COOKIE)!;
  const authorized = await portal.handle(
    new Request(response.headers.get("location")!),
  );
  const request = new NextRequest(authorized.headers.get("location")!);
  request.cookies.set(HANDOFF_COOKIE, handoff.value);
  return { request, response, handoff };
}

it("completes PKCE with the real Portal adapter and stores only an opaque secure session", async () => {
  const { request, response: started } = await start();
  const response = await callback(request);
  expect(response.headers.get("location")).toBe(`${origin}/inventory?lot=42`);
  expect(response.cookies.get(SESSION_COOKIE)).toMatchObject({
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
  });
  expect(started.cookies.get(HANDOFF_COOKIE)).toMatchObject({
    httpOnly: true,
    secure: true,
    path: CALLBACK_PATH,
    maxAge: 600,
  });
  const handle = response.cookies.get(SESSION_COOKIE)!.value;
  expect(await accessFor(handle).check("Inventory")).toEqual({
    decision: "allowed",
    staff,
  });
  expect(response.cookies.get(HANDOFF_COOKIE)?.value).toBe("");
  expect(response.headers.get("cache-control")).toBe("no-store");
});

it("rejects replayed codes, mismatched state, expired and malformed handoffs", async () => {
  const { request } = await start();
  expect(
    (await callback(request)).cookies.get(SESSION_COOKIE)?.value,
  ).toBeTruthy();
  expect((await callback(request)).headers.get("location")).toContain(
    "reason=failed",
  );
  for (const value of [
    "{}",
    "broken",
    JSON.stringify({
      state: "wrong",
      verifier: "a".repeat(43),
      createdAt: Date.now(),
    }),
    JSON.stringify({
      state: request.nextUrl.searchParams.get("state"),
      verifier: "a".repeat(43),
      createdAt: 0,
    }),
  ]) {
    request.cookies.set(HANDOFF_COOKIE, value);
    expect((await callback(request)).cookies.get(SESSION_COOKIE)?.value).toBe(
      "",
    );
  }
});

it("refuses tampered PKCE and never issues a session during a Portal outage", async () => {
  const { request, handoff } = await start();
  request.cookies.set(
    HANDOFF_COOKIE,
    JSON.stringify({ ...JSON.parse(handoff.value), verifier: "a".repeat(43) }),
  );
  expect((await callback(request)).headers.get("location")).toContain(
    "reason=failed",
  );
  const { request: fresh } = await start();
  vi.stubGlobal("fetch", async () => {
    throw new Error("offline");
  });
  expect((await callback(fresh)).headers.get("location")).toContain(
    "reason=unavailable",
  );
});

it("safe return-to cannot leave IMS or return to sign-in plumbing", async () => {
  for (const path of [
    "https://evil.example",
    "//evil.example",
    "/\\evil.example",
    "/%2f%2fevil.example",
    "/inventory/../api/portal/logout",
    "/api/portal/login",
    "/signin",
  ]) {
    const { request } = await start(path);
    expect((await callback(request)).headers.get("location")).toBe(
      `${origin}/`,
    );
  }
});

it("sign-out sends the browser to central logout, invalidating every handle in that session", async () => {
  const { request } = await start();
  const first = (await callback(request)).cookies.get(SESSION_COOKIE)!.value;
  const { request: other } = await start();
  const second = (await callback(other)).cookies.get(SESSION_COOKIE)!.value;
  const response = logout(
    new NextRequest(`${origin}/api/portal/logout`, {
      method: "POST",
      headers: { origin },
    }),
  );
  expect(response.status).toBe(303);
  expect(response.headers.get("location")).toBe(`${FAKE_PORTAL_URL}/logout`);
  expect(response.cookies.get(SESSION_COOKIE)?.value).toBe("");
  await portal.handle(new Request(response.headers.get("location")!));
  for (const handle of [first, second])
    expect(await portalClient.validate(handle, "Inventory")).toEqual({
      decision: "invalid",
    });
});

it("refuses foreign origins for callback, login and logout", async () => {
  expect(
    login(new NextRequest("https://evil.example/api/portal/login")).status,
  ).toBe(400);
  expect(
    (
      await callback(
        new NextRequest("https://evil.example/api/portal/callback"),
      )
    ).status,
  ).toBe(400);
  expect(
    logout(
      new NextRequest(`${origin}/api/portal/logout`, {
        method: "POST",
        headers: { origin: "https://evil.example" },
      }),
    ).status,
  ).toBe(403);
});
