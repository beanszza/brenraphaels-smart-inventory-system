# Ticket #24: Inventory frontend

- `/inventory` remains a server page requiring Inventory before reading data. Initial balances and summary lots now load every page, so filters and summary counts include records beyond the previous 1,000/500 limits. Read failures reach a dedicated retry boundary.
- Existing filters, pagination, finished product variants and restock forms remain interactive. Lot expansion calls the guarded `listItemLots` action directly; failures show an alert with a close/retry path rather than an empty list. Expansion has a keyboard accessible button.
- Route and lot loading use accessible skeletons. The page uses phone sized padding, horizontally scrollable category navigation and tables, and wrapping controls.
- The restock requisition form calls named procurement server actions, announces submission errors and shows a success toast before refreshing Inventory. Procurement retains its own Module authorization.
- Inventory screens and their restock form contain no shared HTTP request client imports. The existing action-result adapter in the shared requisition form only unwraps server-action results.
- Expiring Soon excludes already expired lots.
- Cycle counts, traceability and valuation remain retired guarded pages, as on the base branch.

## Design reference

Inspected the ticket's CRM Orders List reference (`6:385`) through Figma design context. It supplies CRM layout patterns rather than an Inventory screen. Retained the app's existing header, bordered cards, compact filters, badges and table components. No design assets or application shell changes were needed for these focused Inventory changes.

## Verification

- `npx vitest run --exclude 'scratch/**'`: 30 files, 1,145 tests passed. Added tests cover authorization before reads, server data rendering, pagination, failed/incomplete reads and accessible skeletons.
- Targeted Inventory ESLint passed.
- Standard `npm run typecheck` is blocked by existing generated `.next` route types referring to removed routes and the nested `scratch/ticket-21` worktree. Used the existing application-source configuration for a separate check.
- No live Portal/database mutations or browser workflow acceptance tests were performed. Phone interaction and final service behavior require live acceptance testing.
- No schema migration or external record changes.
