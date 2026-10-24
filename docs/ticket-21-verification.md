# Ticket #21: Goods Receiving backend

Implemented on `feature/21-goods-receiving`, based on `origin/main` (`60d8b20`).

## Change

- Goods receipts, receiving inspections, discrepancies, stock-ins, supplier returns and loss acknowledgements use server actions. The existing delivery actions and shared order queries from #19 remain the delivery implementation; receiving reads check Goods Receiving independently.
- The page checks Goods Receiving and loads badge counts on the server. Every receiving action checks the same Module before inspecting inputs or accessing data. Lookup actions do not require a second Module.
- Mutations run in a serializable transaction. A refusal or failed commit sends no event. Once committed, each action sends an IMS audit event with the Staff Username, record, Module and readable description. Approvals and rejections use `record.updated`.
- Approval submissions notify Known Staff holding Goods Receiving, excluding the sender. Stock-in and supplier-return decisions notify the stored requester through their Known Staff Portal id; historical names with no known identity are skipped. GRN rejections notify their creator. Audit and notification outages are logged and do not undo committed work.
- Creator, receiver, submitter, approver, rejecter, inspector, resolver, acknowledger and committer attribution comes from the validated Staff session. Client identity fields are ignored. Stock-in starting stock is read from the database.
- Removed all 23 receiving route files and their rewrite aliases. Converted all callers of those endpoints to actions. Route coverage and the older route attribution suite now cover the remaining handlers; receiving attribution is tested through actions.
- Added the Stock-In creation action used by the existing form, which previously posted to a route exposing only GET. Added draft supplier-return approval submission. Neither operation accepts client attribution.
- No receiving file upload handler existed; no filesystem upload path or new storage contract was introduced. This migration preserves the existing stock-in commit and discrepancy resolution domain operations; it does not add stock-ledger posting or the downstream records that their previous handlers left unimplemented. The unused PutAway components and their pre-existing absent endpoints are outside the migrated handler set.

## Verification

Run from the main workspace directory; these commands reuse its installed dependencies:

```powershell
node node_modules/vitest/vitest.mjs run --config vitest.config.mts --root scratch/ticket-21 --testTimeout 15000
node node_modules/typescript/bin/tsc -p scratch/ticket-21/tsconfig.json --noEmit --incremental false
node node_modules/next/dist/bin/next build scratch/ticket-21 --webpack
```

- Full suite: **25 files, 1,047 tests passed**. The longer timeout accommodates the existing dynamic page import tests.
- Receiving tests cover every action and the page denying unsigned, expired, denied and unavailable Portal decisions before data access; every mutation emitting one event after commit; failed commits and missing records producing no events; session attribution; requester and Module notifications; gateway outages; malformed quantities and foreign inspection lines; allowed reads and action serialization.
- TypeScript: passed.
- ESLint for receiving actions, helpers, tests, page and page view: passed.
- Production webpack build: passed. The first restricted run could not fetch the existing Google fonts; the network-enabled retry succeeded. Next.js warned about the nested worktree's additional lockfile.
- Executable-source search under `app`, `components` and `lib`: no remaining HTTP references to goods-receipts/GoodsReceipts, QualityInspections, StockIns, Discrepancies, ReturnToVendors, LossReports or deliveries.
- No live Portal, gateway or database was used for tests. No schema migration was required.
