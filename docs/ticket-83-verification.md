# Ticket #83 verification

Implemented Portal user identity, workflow action vocabulary, subjects resolved through Known Staff, request context, deterministic SHA-256 versions and idempotency keys, sanitized metadata, sign-in and access-denied events, validation failure events, and restored compatibility labels on the logs page.

Legacy wire mode is the default. Native mode is explicitly enabled with `IMS_AUDIT_LEGACY_ACTIONS=false` after deploying [the existing upstream catalog PR #62](https://github.com/fjdvm/brenraphaels-audit-logs/pull/62).

## Validation

- Updated against current main: 1,554 tests passed across 49 test files.
- ESLint reported no errors in the changed files (one existing unused-variable warning in stock-transfer dispatch); `git diff --check` passed.
- Both legacy and native writes tested against strict fake gateways; no events were written to the live audit store.
- Tests cover retry keys, success versus failure keys, changed revisions, request context, Portal subjects, unknown requester omission, recursive sensitive-key removal, UTF-8 metadata size, invalid Unicode, audit failures, and gateway timeout.
- `npm run typecheck` passed after generating Prisma Client from the current main schema.

Tests were run with `npx vitest run --exclude tests/shop-stock.test.ts --exclude tests/stock-http-verifier.test.ts --exclude tests/storefront-catalog-reconcile.test.ts`. These three existing database suites cannot start here because PostgreSQL's `pg_config` executable is unavailable. No live audit gateway or Portal rollout was exercised.

## Operational behavior

Audit errors are logged and never fail a saved mutation. Unknown historical usernames never become actor or subject IDs. A module denial is attributed only after independent Portal identity validation. Compatibility mode does not require the upstream PR to deploy first. Historical `record.*` events remain readable. No durable outbox or audit export is added.
