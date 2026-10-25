/// <reference types="vite/client" />
import { existsSync } from "node:fs";
import { expect, it } from "vitest";
import manifest from "../package.json";

const sources = import.meta.glob<string>([
  "../{app,components,context,dashboard,hooks,lib,providers,src}/**/*.{ts,tsx,js,jsx}",
  "!../src/prisma/**",
], { query: "?raw", import: "default", eager: true });

it("has removed the shared request layer and its dependency", () => {
  expect(sources).toHaveProperty("../dashboard/page.tsx");
  expect(existsSync(new URL("../lib/api.ts", import.meta.url))).toBe(false);
  expect(manifest.dependencies).not.toHaveProperty("axios");
  expect(manifest.devDependencies).not.toHaveProperty("axios");
  const obsoleteImports = Object.entries(sources).filter(([, source]) =>
    /(?:from\s*|import\s*\(|require\s*\(|import\s*)["'](?:axios(?:\/[^"']*)?|(?:@\/|(?:\.\.\/)+)lib\/api(?:\.[jt]s)?)["']/.test(source),
  ).map(([path]) => path);
  expect(obsoleteImports).toEqual([]);
});
