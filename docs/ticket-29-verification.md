# Ticket #29: Dashboard backend

`getDashboardData` in `app/actions/dashboard.ts` resolves the Staff member's current
Modules through `requireShell("/")` before any database read. No Module redirects
to `/no-access`; invalid sessions and Portal outages retain the existing sign-in
and unavailable redirects. Calling the action directly uses the same guard.

The dashboard reads the same Prisma tables as the migrated Modules. Counts cover
active resource items and suppliers, purchase requisitions and orders, goods
receipts, inventory balances and low stock balances, production requests and
batches, and transfer requests and transfers. Each section is queried and returned
only when the Staff member holds its owning Module. Low stock uses active items
with current stock at or below the item's minimum, evaluated per location balance
as in Inventory. Counts cover all records rather than a paginated subset.

The page consumes these reads on the server. A minimal card view replaces the
legacy localhost analytics client, shared mutable browser cache, fabricated charts
and AI recommendations. Only authorized sections and links reach the rendered
page. Visual design, skeletons and shared request-layer removal remain ticket #30.
There is no cross-request dashboard cache. Database failures reach a retry boundary
instead of appearing as successful zero counts.

## Verification

- Dashboard tests exercise the real shell/Module resolution with a fake Portal and
  database: unsigned, expired, no-Module and unavailable access before reads;
  each of the six business Modules independently; all Modules; grant revocation;
  numeric serialization; server-rendered persisted values; empty data; and read
  failure. The database and Portal are test doubles, not live acceptance checks.
- Full Vitest suite, excluding the existing nested scratch worktree: 37 files,
  1,362 tests pass.
- Application TypeScript passes with the existing migration configuration:
  `npx tsc --noEmit -p scratch/ticket-25-tsconfig.json`. This excludes stale generated
  Next route types and the unrelated scratch worktree.
- Targeted ESLint and `git diff --check` pass.

No database migration, live database read/write, deployment or Portal mutation was
performed. Browser visual acceptance remains part of the frontend work.
