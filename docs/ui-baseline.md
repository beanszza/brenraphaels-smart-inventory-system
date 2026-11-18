# Stage 0 — Baseline Verification & Visual Regression Record (`api-sims`)

Recorded prior to any token, CSS, or component modifications.

## 1. Automated Command Baseline

| Command | Script | Exit Code | Baseline Summary |
| :--- | :--- | :---: | :--- |
| `npm run typecheck` | `tsc --noEmit` | `0` | Passed with **0 TypeScript errors**. |
| `npm run lint` | `eslint` | `1` | **561 problems (405 errors, 156 warnings)** across existing files (primarily `@typescript-eslint/no-explicit-any` and `@typescript-eslint/no-unused-vars`, plus `.agents`/`.claude`/`.cursor`/`.devin` skill files). |
| `npm test` | `vitest run` | `1` | **50 passed, 3 failed (53 test files)**; **1,610 passed, 24 skipped (1,634 tests)**; **1 unhandled error**:<br>• `tests/shop-stock.test.ts`, `tests/stock-http-verifier.test.ts`, `tests/storefront-catalog-reconcile.test.ts` fail with `Error: spawnSync pg_config ENOENT` (local disposable PostgreSQL binary check in `tests/shop-database.ts`).<br>• `tests/brand-lockup.test.tsx` worker error: `Cannot find package 'jsdom'`. |
| `npm run build` | `prisma generate --schema prisma/schema.prisma && next build` | `0` | Prisma Client (`v5.22.0`) generated cleanly; Next.js `16.2.6` (Turbopack) compiled in `15.1s`, finished TypeScript in `29.3s`, and generated all **29 static/dynamic routes** with **0 build errors**. |

### Built Routes Inventory (`next build`)
- `/` (Dashboard)
- `/resources-suppliers` & `/resources-suppliers/logs`
- `/orders-procurement`, `/orders-procurement/create-pr`, `/orders-procurement/edit-pr/[id]`, `/orders-procurement/logs`
- `/goods-receiving` & `/goods-receiving/logs`
- `/inventory` & `/inventory/logs`
- `/production-quality` & `/production-quality/logs`
- `/stock-transfer` & `/stock-transfer/logs`
- `/distribution`, `/distribution-analytics`
- `/mrp`, `/cycle-counts`, `/traceability`, `/valuation`
- `/signing-in`, `/sign-in-error`, `/no-access`, `/unavailable`

---

## 2. Playwright Visual Regression Baseline (`toHaveScreenshot`)

- **Config:** `playwright.config.ts` (`maxDiffPixels: 0`, `animations: "disabled"`, `caret: "hide"`)
- **Test Server Wrapper:** `e2e/start-test-server.mjs` (starts a deterministic local mock Portal & Gateway on `http://localhost:3999` and launches `npm run dev` on `https://localhost:3003`)
- **Test Suite:** `e2e/visual-baseline.spec.ts`
- **Snapshots Directory:** `e2e/visual-baseline.spec.ts-snapshots/` (**84 PNG snapshots** = 14 routes × 3 viewports × 2 themes)
- **Routes Covered (14):**
  - Protected (11): `/` (`dashboard`), `/resources-suppliers`, `/orders-procurement`, `/orders-procurement/create-pr` (`orders-create-pr`), `/goods-receiving`, `/inventory`, `/production-quality`, `/stock-transfer`, `/distribution-analytics`, `/mrp`, `/inventory/logs` (`inventory-logs`)
  - Public / Auth (3): `/no-access`, `/sign-in-error`, `/unavailable`
- **Viewports Tested:** `1440 × 900` (desktop), `768 × 900` (tablet), `375 × 844` (mobile)
- **Themes Tested:** `light` and `dark` (`document.documentElement.classList.toggle("dark")`)
- **Authentication:** Automated login via local mock Portal (`/api/portal/login` → `/api/portal/callback` with Admin staff session `2026-ADMIN-001` granting all 7 IMS modules and admin views)
- **Determinism / Frozen Dynamic Content:**
  - Browser `Date` and `performance.now` frozen to `2026-10-16T06:15:00.000Z` (`16 Oct 2026, 2:15 PM` PHT) via `addInitScript`
  - Deterministic `Math.random` LCG seeded in page context and `window.WebSocket` stubbed
  - CSS/SVG animations and transitions disabled, `nextjs-portal` dev indicator hidden, and fonts/chart containers awaited before capture
- **Consistency Check:**
  - Snapshot Generation (`npx playwright test --update-snapshots`): `14 passed (1.9m)` — 84 snapshots written
  - Verification Run 1 (`npx playwright test`): `14 passed (1.5m)` — `0` pixel diffs across all 84 screenshots
  - Verification Run 2 (`npx playwright test`): `14 passed (1.5m)` — `0` pixel diffs across all 84 screenshots
