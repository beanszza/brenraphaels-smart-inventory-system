# Ticket #28: Stock Transfer frontend

`/stock-transfer` and `/distribution-analytics` require Stock Transfer before reading
records, then load their initial requests/transfers, locations and dashboard counts
on the server. `/distribution` retains its guarded redirect. Initial tables and
location cards render from persisted props without a mount-time browser request.
Stock Transfer tabs use the URL, including `?tab=locations`. Refresh and successful
mutations refresh server props. Lists read every backend page instead of silently
truncating at 100 records; local search, status filters and pagination cover those
records. Analytics uses persisted transfer numbers and the actual pagination result.
Failed or malformed initial reads reach retry boundaries instead of showing zeros.

Stock Transfer and Distribution components import named server actions directly,
using only the existing action-result error adapter. No shared HTTP/request client
or Stock Transfer action facade is used in these screens. Forms retain inline errors,
disabled submission controls and success toasts. Request decisions now propagate
failure to the confirmation modal, keeping it open. Dispatch loads the persisted
scheduled transfer instead of constructing a transfer with a hardcoded source.
Distribution creation uses the same approval-first request form; its former direct
schedule payload was incompatible with the backend. Location forms map their fields
to the action input and await saves with visible failures. Request numbers are
assigned by the backend, with no guessed sequence preview. Failed prerequisites
show an error/retry and prevent request submission.

Route and table refresh loading uses accessible skeletons; product/destination and
stock checks also use skeletons. Phone spacing, wrapping header actions, scrollable
tables and tabs, and bounded dispatch modal height preserve usability on small screens.
Existing responsive layouts and shared shell components are reused.

## Design reference

Inspected Figma Orders List (`6:385`) design context and screenshot in the ticket's
CRM reference. It supplies shared header, bordered table/card, compact control and
status badge patterns, rather than a Stock Transfer screen. Reused the app's matching
components and tokens; no shell artwork or asset changes were needed.

## Verification

- Full Vitest suite excluding the pre-existing nested scratch worktree: 36 files,
  1,347 tests passed. Added 22 tests cover server initial data, both pages' guards
  before reads, URL tab selection, pagination beyond 100 records, failure on a later
  page, read/malformed-data failures, accessible skeletons and real server-rendered
  request/location/distribution tables.
- Application-source TypeScript check passes with
  `npx tsc --noEmit -p scratch/ticket-25-tsconfig.json`, the existing migration config
  excluding stale generated Next route types and the unrelated scratch worktree.
- Targeted ESLint passes for the server loader, pages, boundaries, module screen,
  locations, skeleton, tables, analytics screen, creation adapter and new tests.
  Existing modal effect-initialization lint findings remain; no global lint cleanup
  was undertaken. `git diff --check` passes.

No database migration or live gateway/database mutation was performed. Live Portal,
notification delivery, browser interactions and phone visual acceptance remain
unverified environment checks; server rendering and backend behavior use test doubles.
