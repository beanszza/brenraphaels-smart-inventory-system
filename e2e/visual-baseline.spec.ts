import { test, expect, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const FIXED_TIME = new Date("2026-10-16T06:15:00.000Z"); // 16 Oct 2026, 2:15 PM PHT
const AUTH_STATE_PATH = path.join(process.cwd(), "e2e", ".auth-state.json");

const VIEWPORTS = [
  { name: "1440", width: 1440, height: 900 },
  { name: "768", width: 768, height: 900 },
  { name: "375", width: 375, height: 844 },
] as const;

const THEMES = ["light", "dark"] as const;

const PROTECTED_ROUTES = [
  { slug: "dashboard", path: "/" },
  { slug: "resources-suppliers", path: "/resources-suppliers" },
  { slug: "orders-procurement", path: "/orders-procurement" },
  { slug: "orders-create-pr", path: "/orders-procurement/create-pr" },
  { slug: "goods-receiving", path: "/goods-receiving" },
  { slug: "inventory", path: "/inventory" },
  { slug: "production-quality", path: "/production-quality" },
  { slug: "stock-transfer", path: "/stock-transfer" },
  { slug: "distribution-analytics", path: "/distribution-analytics" },
  { slug: "mrp", path: "/mrp" },
  { slug: "inventory-logs", path: "/inventory/logs" },
] as const;

const PUBLIC_ROUTES = [
  { slug: "no-access", path: "/no-access" },
  { slug: "sign-in-error", path: "/sign-in-error" },
  { slug: "unavailable", path: "/unavailable" },
] as const;

async function freezePageEnvironment(page: Page, theme: "light" | "dark") {
  await page.clock.setFixedTime(FIXED_TIME);

  await page.addInitScript((targetTheme: "light" | "dark") => {
    // 1. Deterministic Math.random
    let seed = 42;
    Math.random = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };

    // 2. Stub WebSocket so live notification pushes never mutate UI mid-screenshot
    class NoopWebSocket extends EventTarget {
      static CONNECTING = 0;
      static OPEN = 1;
      static CLOSING = 2;
      static CLOSED = 3;
      readyState = 1;
      url: string;
      constructor(url: string) {
        super();
        this.url = url;
      }
      send() {}
      close() {
        this.readyState = 3;
      }
    }
    // @ts-expect-error override WebSocket in browser context
    window.WebSocket = NoopWebSocket;

    // 3. Apply light/dark theme before hydration
    try {
      window.localStorage.setItem("theme", targetTheme);
      document.documentElement.classList.toggle("dark", targetTheme === "dark");
    } catch {
      // ignore storage errors
    }
  }, theme);
}

async function stabilizeAndPrepareForScreenshot(page: Page, theme: "light" | "dark") {
  // Ensure theme class is applied after useSharedTheme effect runs
  await page.evaluate((targetTheme: "light" | "dark") => {
    window.localStorage.setItem("theme", targetTheme);
    document.documentElement.classList.toggle("dark", targetTheme === "dark");
  }, theme);

  // Hide Next.js dev indicator and disable all CSS/SVG animations & transitions
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        transition-duration: 0s !important;
        transition-delay: 0s !important;
        caret-color: transparent !important;
      }
      nextjs-portal, [data-nextjs-toast], [data-nextjs-dialog-overlay] {
        display: none !important;
      }
    `,
  });

  // Wait for web fonts to finish loading
  await page.evaluate(() => document.fonts.ready);

  // Allow Recharts ResponsiveContainer ResizeObserver and layout to settle
  await page.waitForTimeout(350);
}

test.describe.serial("IMS Visual Baseline", () => {
  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({ ignoreHTTPSErrors: true });
    const page = await context.newPage();
    await freezePageEnvironment(page, "light");

    // Log in via Portal handoff (/api/portal/login -> mock Portal authorize -> /api/portal/callback)
    await page.goto("/api/portal/login?returnTo=%2Finventory", {
      waitUntil: "networkidle",
    });
    await expect(page).toHaveURL(/\/inventory$/);

    // Warm up Dashboard as well so all initial compilation/DB reads are hot
    await page.goto("/", { waitUntil: "networkidle" });

    await context.storageState({ path: AUTH_STATE_PATH });
    await context.close();
  });

  for (const route of PROTECTED_ROUTES) {
    test(`protected route: ${route.slug} (all viewports & themes)`, async ({ browser }) => {
      const context = await browser.newContext({
        ignoreHTTPSErrors: true,
        storageState: fs.existsSync(AUTH_STATE_PATH) ? AUTH_STATE_PATH : undefined,
      });
      const page = await context.newPage();
      await freezePageEnvironment(page, "light");

      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto(route.path, { waitUntil: "networkidle" });

      for (const theme of THEMES) {
        for (const vp of VIEWPORTS) {
          await page.setViewportSize({ width: vp.width, height: vp.height });
          await stabilizeAndPrepareForScreenshot(page, theme);
          await expect(page).toHaveScreenshot(
            `${route.slug}-${vp.name}-${theme}.png`,
          );
        }
      }

      await context.close();
    });
  }

  for (const route of PUBLIC_ROUTES) {
    test(`public route: ${route.slug} (all viewports & themes)`, async ({ browser }) => {
      const context = await browser.newContext({ ignoreHTTPSErrors: true });
      const page = await context.newPage();
      await freezePageEnvironment(page, "light");

      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto(route.path, { waitUntil: "networkidle" });

      for (const theme of THEMES) {
        for (const vp of VIEWPORTS) {
          await page.setViewportSize({ width: vp.width, height: vp.height });
          await stabilizeAndPrepareForScreenshot(page, theme);
          await expect(page).toHaveScreenshot(
            `${route.slug}-${vp.name}-${theme}.png`,
          );
        }
      }

      await context.close();
    });
  }
});
