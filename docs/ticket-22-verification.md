# Ticket #22 verification

Implemented on `feature/22-goods-receiving-frontend`, based on the completed
`feature/21-goods-receiving` backend, in the `sims-ticket-22` worktree.

## Behavior

- `/goods-receiving` requires the Goods Receiving Module before any data reads.
- The page and navigation shell are server components. URL tabs select receipts,
  discrepancies, stock-ins, supplier returns or loss/disposal reports. Only the
  active tab's list is loaded; counts and list reads run concurrently.
- Interactive tables receive server data and render their rows in the initial HTML.
  Filters, pagination and existing action dialogs remain interactive. Refresh and
  successful form submissions refresh the server-rendered data and badge counts.
- Arrived deliveries are loaded across all pages, including in the receipt form;
  deliveries already linked to a non-draft receipt are excluded from the pending table.
- Existing guarded server actions handle the forms. Successful mutations announce
  their result through the module's mounted Toaster; failed results remain available
  to the forms' error displays. Inline errors announce themselves to assistive tools.
- Route, table and modal read states use the shared receiving skeleton. Failed server
  reads reach the retry boundary instead of appearing as empty successful lists.
- Navigation scrolls horizontally; stock-in, return and loss tables scroll inside their
  own containers. Superseded, unreachable put-away components were removed, eliminating
  the module's remaining shared API-client imports.

## Design reference

The ticket's Figma page contains CRM screens rather than a Goods Receiving design.
Inspected Orders List (`6:385`) through design context and its screenshot. Reused the
existing CREOMS header, controls, dialogs, status badges, tokens and table patterns,
with compact navigation and bordered table cards.

## Checks

- `npm test`: 27 files, 1,063 tests passed.
- `npm run typecheck`: passed.
- `npm run build -- --webpack`: passed.
- New frontend tests cover all five server-rendered tab lists, Module denial and Portal
  outages before data access, safe tab defaults, failed reads, delivery pagination,
  initial HTML rows, accessible skeletons, successful form calls and refusal feedback.
- Existing receiving backend tests still cover guarded actions, fake-gateway audit
  events, notifications, transaction behavior and approval transitions.
- Compared receiving ESLint errors with the #21 worktree, normalizing source locations:
  66 existing errors before, 50 after, zero added errors. The existing forms still
  have explicit-any and effect-related lint failures; module-wide lint is not clean.
- Browser inspection of server-rendered fixture HTML with compiled production CSS at
  390px confirmed wrapping controls and horizontally scrollable navigation/tables for
  receipts, stock-in and returns. These are static layout fixtures, not a live workflow test.

Live Portal/database sign-in and real receiving mutations were not exercised. Phone
modal interaction and final production-service behavior still need live acceptance testing.
No database migrations or external records were changed.
