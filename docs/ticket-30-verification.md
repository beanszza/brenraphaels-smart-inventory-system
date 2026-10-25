# Ticket #30: Dashboard frontend and shared request removal

The root page directly exports the async Dashboard server component. Persisted
figures and links are rendered only for the Staff member's currently assigned
Modules, retaining ticket #29's authorization-before-read and failure behavior.
The route loading boundary now uses a Dashboard card skeleton with an accessible
loading status. Its placeholders contain no Module names, links or data and perform
no reads. The responsive grid, wrapping figures and keyboard focus treatment reuse
the existing Card, Skeleton and theme tokens.

Inspected the ticket's Figma Dashboard (`2:2`) context and screenshot. Applied its
compact heading, spacing, lightly bordered cards and purple links to the IMS data.
CRM revenue, trends, date filters and export controls have no matching Dashboard
backend contract, so they are not presented as inventory features. The existing
shared application shell and artwork were not changed; no new static assets are
used by the Dashboard content.

Removed `lib/api.ts`, Axios and its unused dependency tree from the npm manifest
and lockfile. Application sources contain no imports of either. Existing server
action error adapters remain for form feedback. Simplified route coverage to assert
that only Portal login, callback and logout handlers remain, removing the obsolete
Module HTTP-handler test machinery. A regression check scans application sources
for reintroduced shared-client/Axios imports and checks the package manifest.

## Verification

- Full Vitest suite excluding the existing nested scratch worktree: 38 files,
  1,365 tests pass. Dashboard tests cover server-rendered persisted data, guards,
  Module filtering, route links, zero data, read failures and accessible skeletons.
- Application TypeScript passes with the existing migration configuration:
  `npx tsc --noEmit -p scratch/ticket-25-tsconfig.json` (excludes stale generated
  Next route types and the unrelated scratch worktree).
- Targeted ESLint and `git diff --check` pass.
- `npm ls axios` reports an empty dependency tree.

No database migration, live data mutation, deployment or Portal mutation was
performed. Live browser rendering, responsive visual acceptance and the Next.js
streaming boundary remain unverified; rendering and authorization checks use test
doubles.
