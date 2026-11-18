import fs from "node:fs";
import path from "node:path";
import { defineConfig } from "@playwright/test";

function resolveLocalChromium(): string | undefined {
  const localAppData = process.env.LOCALAPPDATA;
  if (!localAppData) return undefined;
  const msPlaywright = path.join(localAppData, "ms-playwright");
  if (!fs.existsSync(msPlaywright)) return undefined;
  const dirs = fs
    .readdirSync(msPlaywright)
    .filter((d) => d.startsWith("chromium-"))
    .sort()
    .reverse();
  for (const dir of dirs) {
    for (const sub of ["chrome-win64", "chrome-win"]) {
      const candidate = path.join(msPlaywright, dir, sub, "chrome.exe");
      if (fs.existsSync(candidate)) return candidate;
    }
  }
  return undefined;
}

const executablePath = resolveLocalChromium();

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.spec.ts",
  timeout: 90_000,
  expect: {
    timeout: 15_000,
    toHaveScreenshot: {
      animations: "disabled",
      caret: "hide",
      maxDiffPixels: 0,
    },
  },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: "https://localhost:3003",
    ignoreHTTPSErrors: true,
    timezoneId: "Asia/Manila",
    locale: "en-US",
    deviceScaleFactor: 1,
    launchOptions: executablePath ? { executablePath } : undefined,
  },
  webServer: {
    command: "node e2e/start-test-server.mjs",
    url: "https://localhost:3003/no-access",
    ignoreHTTPSErrors: true,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
