# Ticket #18 verification

Implementation lives on `feature/18-resources-suppliers-frontend` in
`C:/Users/mdg4l/repo/SIMS/sims-ticket-18`, updated to `origin/main` at `401efac` (including #17, #7 and #19). The original `sims` working tree and its unrelated edits are preserved.

## Implemented

- Both Resources & Suppliers pages use guarded server reads. The main page
  includes complete lists and supplier associations, without the old 100-row cap.
- Supply, supplier and recipe forms use server actions, inline errors, pending
  controls and success announcements. Transactions save related records together.
- Aggregate saves use #17's central audit helper after commit, with the session
  Username as actor. Audit failures do not fail a committed save. Central IMS audit
  reads and removal of the module's old endpoints are inherited from #17.
- Initial server HTML contains populated tables. The latest main Staff provider
  is retained; no temporary legacy-auth bypass or loading gate remains.
- Pages and detail dialogs use skeletons, visible error states and retry controls.
- Editing a supplier preserves catalog links, prices and its complete postal
  address. The previous geography picker displayed a different province for
  addresses not matching its lookup list. The full address field preserves these
  records and follows the backend's 100-character limit.

## Figma reference

Read-only access succeeded for file `76nS6Pw2TXA6fWfUvTmzJ1`. The file contains
CRM reference screens, not an IMS Resources screen. List `6:198` and dialog
`21:1887` supplied the visual references for the existing IMS-specific content.
Status tabs now use the reference accent treatment; table spacing and dialog
typography, overlay and rounding were adjusted. The exact 18px close asset is
stored at `public/images/resources/dialog-close.svg`; browser inspection confirmed
that it loads and renders at 18 by 18 pixels. Figma was not edited.

## Verification results

- All 943 tests pass across 23 files, including backend guards, attribution,
  audit behavior and the added form/address regressions.
- TypeScript and targeted ESLint pass.
- `npm run build -- --webpack` verifies the production bundle.
- Build blockers inherited from the base were corrected: route parameters use
  Next.js 16's Promise contract, shared production DTO helpers live outside route
  files, and private stage constants are no longer exported as route handlers.
  The DTO helper moves preserve behavior and are covered by the existing route suite.
- Browser checks cover desktop lists, supplier and recipe edit dialogs, and the
  supply/recipe dialogs at a 390 by 844 phone viewport. The phone supply dialog
  measures 358px wide, fits the viewport and has no page-wide horizontal overflow.
- A local disposable PostgreSQL database on port 5439 and a fake gateway on port
  4318 were used for browser writes. Supply creation, supplier contact editing and
  recipe batch-size editing succeeded through the actual server actions.
- Independent reads confirmed saved supplier links, unchanged catalog prices and
  postal address, the new recipe quantity, preserved notes and ingredient rows.
  The fake gateway received exactly three new IMS events attributed to `dev.staff`.
  The browser audit details showed the full supply event, target and Staff name.
- A fresh audit tab had no browser warnings or errors. The fake gateway was
  corrected during verification to honor the module filter, eliminating fixture
  duplicates. No production gateway or database records were written.
- The preview servers and disposable database were stopped after verification.

Screenshots and the captured server HTML are local ignored artifacts under
`scratch/verification/`: `resources-desktop.jpg`, `phone-supply.jpg`,
`audit-details.jpg`, and `server-rendered.html`.

The existing local database credentials fail authentication. This is independent
of the implementation; browser verification used the disposable database instead.
Production deployment and live credential/service checks have not been performed.

## Merge-readiness correction

The review caught a regression in the new aggregate recipe save: nested deletion
and recreation of every ingredient broke edits when production records referenced
those ingredient IDs. Two regression cases reproduced the failure before the fix
and pass afterward. Both the existing and aggregate recipe save paths now call
`lib/resources/recipe-ingredients.ts` within their transactions. Retained rows are
updated in place, added rows are created, and only explicitly removed rows are
deleted. PostgreSQL still protects referenced removals; a failure rolls back the
whole edit before any audit event is emitted.

The branch was updated to current main (`401efac`). The three conflicts in the
Staff shell and resource detail dialogs were resolved. The current Staff provider
is preserved and details continue through guarded actions with skeletons and
visible errors. Generated Next route metadata from the old base was moved to
a temporary backup outside the worktree before the clean build.

For the real database regression check, after applying the schema to the isolated
local test database, run with Node 24+:

```powershell
$env:IMS_RECIPE_TEST_DATABASE_URL = 'postgresql://ims_preview@127.0.0.1:5439/ims_ticket18'
node scripts/verify-recipe-references.mjs
```

The script accepts only that localhost port/database, creates actual production
reservations and material issuance scans, edits a referenced ingredient while
adding/removing other ingredients, and verifies IDs, quantities, batch size and
notes. It rolls back all its fixtures and never reads application `DATABASE_URL`.

Real PostgreSQL verification passed with actual reservation and issuance-scan
foreign keys, including simultaneous ingredient additions/removals. Both focused
re-review reports found no remaining merge blocker. The full suite passes 943
tests across 23 files, and targeted lint passes after the main integration.
