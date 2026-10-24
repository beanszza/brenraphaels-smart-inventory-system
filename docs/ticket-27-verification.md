# Ticket #27: Stock Transfer backend

Stock transfer requests, request decisions and cancellations, scheduling, FEFO lot
previews, dispatch, receipt and distribution reads now use named server actions in
`app/actions/stock-transfer`. Every action and the Stock Transfer, Distribution and
Distribution Analytics pages independently check Stock Transfer before processing
input or accessing data. Distribution Analytics now has the same owning Module in
the page shell. Product and destination lookups do not require a second Module.

Mutations use the signed-in Staff Username, run in serializable transactions, and
emit an IMS audit event through the audit gateway after commit. Failed transactions,
refusals and reads emit no state-change event. Approval requests notify Known Staff
holding Stock Transfer, excluding the actor. Approvals and rejections resolve the
stored requester Username to a Known Staff Portal id; unmatched historical names
are skipped. Gateway outages do not turn committed changes into failed saves.

Scheduling and editing check the approved request's products and remaining quantity.
Dispatch checks state within its transaction and uses unreserved, unexpired lots
from the source location in FEFO order. Insufficient stock rolls the transaction
back. Status changes cannot bypass dispatch deductions, repeat receipt, or cancel
a dispatched/received transfer. Cancelling a request also cancels its scheduled
transfers in the same transaction. Existing DTOs and the modal error contract are
preserved through the action adapter.

All 11 Stock Transfer route-handler files and their rewrite alias are removed.
Application callers use named actions; the route coverage test now asserts that
only the three Portal plumbing routes remain. Existing stored proof references
remain read-only: these flows had no file upload/write operation, and this change
does not introduce one or write local files.

## Verification

- Full Vitest suite excluding the existing nested scratch worktree: 34 files,
  1,325 tests passed. New
  coverage checks every public action and all three pages for unsigned, expired,
  denied and unavailable Portal decisions before data access, every mutation's
  audit event through a fake gateway, rollback, Username attribution, notifications,
  gateway failures, scheduling limits, reservation-aware availability and dispatch,
  state transitions and serializable read results.
- Application-source TypeScript check passes with the existing
  `scratch/ticket-25-tsconfig.json`, excluding stale generated Next route types and
  the nested scratch worktree, as documented in previous migration tickets.
- ESLint passes for the new actions, helpers and tests; `git diff --check` passes.
  Existing components retain the same 28 lint errors as their baseline; the caller migration does
  not undertake their broader UI refactor.
- Source search finds no calls to the removed Stock Transfer API endpoints.

No database migration or live database/gateway mutation was performed. Live Portal,
notification delivery and browser acceptance checks remain environment checks;
backend behavior is verified with fakes.
