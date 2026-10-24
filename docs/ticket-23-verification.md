# Ticket #23: Inventory backend

Inventory balances, lots, cycle counts, forward/backward traceability, recall simulation,
recall holds and valuation now use server actions in `app/actions/inventory`.
All actions and Inventory page entry points independently require the Inventory Module
before accessing data. `/inventory` loads its initial records and summary inputs on the
server; its existing filters and dialogs remain interactive.

Stock-in actions are also exposed under Inventory. They share their implementation with
the Goods Receiving actions introduced in #21. The existing Goods Receiving screen keeps
its own Module checks and notification destination; Inventory actions check Inventory and
send approval requests to Known Staff holding Inventory. Results go to the stored
requester's Portal id. Known Staff never authorizes an action.

State changes emit an IMS audit event after the transaction commits. The actor comes
from the Portal session, approval/rejection events use `record.updated`, and failures of
the audit or notification gateway do not fail committed work. Cycle-count creation and
reconciliation now run atomically with their inventory work. Recall simulation changes
no records and emits no state-change event. The stock-in commit behavior is preserved.

The eleven remaining Inventory route-handler files are deleted, their callers use named
actions, and route coverage now covers only the remaining Modules. No Inventory workflow
handles file uploads, so no file-storage changes are required. Historical attribution
and stock-ledger behavior are preserved. Cycle counts, traceability and valuation pages
were already retired (`notFound`) on the base branch; they retain that behavior, with an
explicit Inventory guard. Their backend operations remain available as guarded actions.

## Verification

- `npx vitest run --exclude 'scratch/**'`: 29 test files / 1,138 passing tests, including fake-Portal
  denial cases for every new action/page, fake-gateway events for every state-changing
  action, rollback and outage behavior, requester/Module notifications and read DTOs.
- `npx next typegen`: regenerates types after removing the routes.
- Application-source TypeScript check using `scratch/ticket-23-tsconfig.json`: passed.
  The temporary configuration extends the repository configuration while excluding the
  unrelated nested `scratch/ticket-21` worktree and stale `.next/dev` route types. The
  standard `npm run typecheck` includes those pre-existing local artifacts.
- ESLint on the Inventory actions/helpers, shared stock-in implementation, page entry
  points and new tests; `git diff --check`.
- Search of `app`, `components`, `lib` and `tests` finds no remaining calls to deleted
  Inventory API paths. Existing Goods Receiving tests also exercise the shared stock-in
  implementation through the original Goods Receiving actions.

No live database or gateway requests are needed for these tests. No schema migration is
required for this ticket.
