# Ticket #25: Production & Quality backend

Production requests, FEFO lot suggestions and reservations, material issuance and scans,
batch lifecycle operations, QA inspections and finished products now use named actions
under `app/actions/production`. The Production page and every public action independently
check Production & Quality before accessing data or file storage. Portal denial and
unavailability stop the action before input processing.

Mutations retain their existing workflow and DTO mappings, use the signed-in Staff
Username for attribution, and emit IMS audit events after the database commits. Reads,
refusals, failed transactions and loading an existing issuance emit no state-change event.
The database workflow runs in a serializable transaction, including the prerequisite
reads and sequence generation. Repeated packaging, completed-batch stock creation and
repeated inventory commits are refused to avoid duplicate lots or aggregate stock.

Production approval requests notify Known Staff holding Production & Quality. Decisions
notify the stored requester by resolving their Username to a Portal id. Historical names
without a Known Staff match are skipped. Packaging requests a QA review, and QA decisions
notify the requester. A shortfall requisition notifies Orders & Procurement approvers.
Gateway failures do not turn committed database changes into failed actions.

Recipe operations are shared with Resources & Suppliers in `lib/resources/recipes.ts`.
Both Modules retain independently guarded entry points and audit events use the owning
Module. Production recipe and item reads no longer require Resources & Suppliers access.

All 30 Production route-handler files are deleted, route coverage now covers Stock
Transfer and the Portal plumbing, and callers use named actions. Obsolete Production
rewrite aliases are removed. Existing modal result/error shapes are preserved by the
same action-result adapter used by other migrated Modules.

Product photos use public permanent files; batch photos use private permanent files.
Upload authorization, confirmation and resolution are guarded actions. The browser sends
bytes directly to signed storage URLs without IMS credentials. Upload requests and record
links emit audit events. Packaging and rejection accept a proof only when it matches the
confirmed file id stored on that batch. Local disk image writes, base64 proof bodies and
free-text proof paths have been removed from the migrated flows.

## Verification

- Full Vitest suite excluding the pre-existing nested scratch worktree: 31 files,
  1,226 tests passed. New coverage exercises every Production action's unsigned,
  expired, denied and unavailable Portal paths, audit events through the fake gateway,
  rollback and gateway outages, attribution, notifications, serializable read DTOs,
  lot previews, file visibility and confirmation, and duplicate inventory posting.
- Application-source TypeScript check using `scratch/ticket-25-tsconfig.json` passes.
  The standard root configuration still includes stale generated `.next` route types
  and the unrelated `scratch/ticket-21` worktree, as documented for tickets #23 and #24.
- Targeted ESLint on the new actions/helpers/tests, shared recipe implementation,
  Production page and new image controls; `git diff --check`.
- Source search finds no calls to the deleted Production API paths in application code.

No database migration or live database/gateway mutation was performed. Live Portal,
notification delivery and browser workflow acceptance testing remain environment checks;
the backend and file-storage behavior above are verified with fakes.
