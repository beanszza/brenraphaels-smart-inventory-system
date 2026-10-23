/* eslint-disable @next/next/no-img-element */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/image", () => ({
  default: ({ alt }: { alt: string }) => <img alt={alt} />,
}));

const render = async (page: () => Promise<React.ReactElement> | React.ReactElement) =>
  renderToStaticMarkup(await page());

describe("sign-in screens", () => {
  it("hands the sign-in on to the Portal, keeping where the Staff member was going", async () => {
    const { default: Page } = await import("@/app/signing-in/page");
    const html = await render(() => Page({ searchParams: Promise.resolve({ returnTo: "/inventory?lot=42" }) }));
    expect(html).toContain("Signing you in");
    expect(html).toContain('href="/api/portal/login?returnTo=%2Finventory%3Flot%3D42"');
  });

  it("does not hand on to an unsafe return address", async () => {
    const { default: Page } = await import("@/app/signing-in/page");
    const html = await render(() => Page({ searchParams: Promise.resolve({ returnTo: "https://evil.example" }) }));
    expect(html).toContain('href="/api/portal/login?returnTo=%2F"');
  });

  it("tells Staff with no Module to ask an administrator, and offers sign-out", async () => {
    const { default: Page } = await import("@/app/no-access/page");
    const html = await render(() => Page());
    expect(html).toContain("You don&#x27;t have access to this page");
    expect(html).toContain('action="/api/portal/logout"');
  });

  it("tells Staff the Portal is unavailable and lets them retry or sign out", async () => {
    const { default: Page } = await import("@/app/unavailable/page");
    const html = await render(() => Page({ searchParams: Promise.resolve({ returnTo: "/orders-procurement" }) }));
    expect(html).toContain("temporarily unavailable");
    expect(html).toContain('href="/orders-procurement"');
    expect(html).toContain('action="/api/portal/logout"');
  });

  it.each([
    ["failed", "couldn&#x27;t sign you in"],
    ["unavailable", "Portal can&#x27;t be reached"],
    ["denied", "don&#x27;t have access to IMS"],
    ["nonsense", "couldn&#x27;t sign you in"],
    [undefined, "couldn&#x27;t sign you in"],
  ])("shows the sign-in error page for reason %s", async (reason, text) => {
    const { default: Page } = await import("@/app/sign-in-error/page");
    const html = await render(() => Page({ searchParams: Promise.resolve({ reason }) }));
    expect(html).toContain(text);
    expect(html).toContain('href="/api/portal/login"');
    expect(html).toContain('action="/api/portal/logout"');
  });

  it("shows the signed-in Staff name with sign-out in the sidebar footer", async () => {
    const { SidebarProfileFooter } = await import("@/components/shared/SidebarProfileFooter");
    const html = renderToStaticMarkup(
      <SidebarProfileFooter staff={{ id: "1", name: "Ana Cruz", username: "2026-AB-001", email: "ana@example.com" }} />,
    );
    expect(html).toContain("Ana Cruz");
    expect(html).toContain('action="/api/portal/logout"');
  });
});
