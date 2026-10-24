# Ticket #26: Production & Quality frontend

`/production-quality` loads the selected tab's complete initial dataset on the server,
after requiring Production & Quality. Requests, Material Issuance, Tracking, QA,
Stock-In, Configuration and Loss use URL tabs, including batch and issuance links.
Only the selected tab is loaded. Failed or malformed reads reach a retry boundary.
Interactive tables render their initial rows and empty states without a browser read.

Forms, detail reads and refresh controls import named Production server actions directly.
The existing action-result adapter preserves their success/error contracts; no Production
component imports the Production facade, Inventory facade, Axios or shared HTTP client.
Signed image uploads continue sending bytes directly to storage through the existing helper.
Form success/error toasts and disabled submission controls remain in place. Issuance
navigation now reports action refusal and failure instead of silently switching tabs.

Route, tab navigation, table, batch-detail and camera initialization loading states use
accessible skeletons. The page uses phone padding, scrollable tab navigation and tables,
wrapping issuance filters, and scrollable QA subtabs. Existing responsive modal layouts remain.

Requests filter the complete list locally, preserving High/Priority and Medium/Normal
aliases and searches by number, product, recipe and requester. Issuance filters and QA
subtabs also work locally. Mutations retain backend path revalidation and table refreshes.

Stock-In uses the Production-guarded item lookup for stock levels, avoiding an unrelated
Inventory permission requirement and fabricated stock defaults. Loss uses persisted batch
material costs and consumption lots, replacing invented sample ingredients and localStorage.

## Design reference

Inspected the ticket's CRM Orders List (`6:385`) through Figma design context and its
screenshot. The reference provides CRM layout patterns, not a Production screen. Reused
the app's existing page header, bordered cards, compact controls, badges and tables.
No reference artwork or application shell changes were needed.

## Verification

- Full Vitest suite excluding the pre-existing nested scratch worktree: 33 files,
  1,259 tests passed. Added 33 tests cover all seven tabs' authorization before reads,
  server-loaded data, read failures, stock lookup failure, local filter compatibility,
  persisted loss figures, accessible skeletons and actual table server rendering.
- Application-source TypeScript check passes using `scratch/ticket-25-tsconfig.json`.
  Standard `npm run typecheck` still includes stale `.next` route validators and the
  unrelated nested `scratch/ticket-21` worktree and fails there.
- Targeted ESLint passes for the page, route boundaries, screen loader, filter/loss
  helpers, navigation component, skeleton and new tests. Existing Production components
  still have legacy lint findings, including explicit `any` and effect/camera rules.
- `git diff --check` passes. Source search finds no Production facade, Inventory facade,
  shared HTTP client or spinner usage in the Production components.

No schema migration or live database/gateway mutation was performed. Browser interaction,
phone visual acceptance, and live Portal/storage workflows remain environment checks;
the rendering and backend behavior above were verified with test doubles.
