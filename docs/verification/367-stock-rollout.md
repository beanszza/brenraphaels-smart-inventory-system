# Ticket #367: stock rollout verification

Source ticket: https://github.com/fjdvm/epic-crms/issues/367.
Storefront dependency: https://github.com/fjdvm/brenraphaels-ecommerce/pull/299.

The owner confirmed Factory (`LocationId=1000`) as the online Warehouse and the
storefront catalog as authoritative. Read-only IMS inspection found Factory
active, type Warehouse, with 10 lots. Commissary 999 is a Branch and is excluded.
The existing database contains ShopStockLines and ShopStockAuditOutbox; a newly
generated Prisma client exposes both models.

The catalogs initially represented different products. The operator reconciler
created one new Item and FinishedProduct per storefront Size using explicit
`SHOP-SIZE-<storefront id>` Item import codes. IMS may normalize its display SKU;
reconciliation anchors to the Item code and exclusive product identity. It leaves existing product history and all
stock quantities intact. Replaying the same catalog returns the same mapping.
Existing Items must retain their Piece count units, category and lot/expiry
tracking; sharing an Item with another FinishedProduct is refused. The public catalog snapshot and mapping are in `367-storefront-catalog.json` and
`367-size-mapping.json`. New Sizes initially had zero stock. The owner then explicitly approved labelled
demo stock for verification: 20 units per on-sale Size at Factory 1000 and a
separate 20-unit POS Branch fixture for Size 1. Eight opening lots were created.
Their stable DemoVerification opening ledger references prevent top-ups or
duplicate ledger entries on replay, even when IMS normalizes display LotCodes.
SupplierLotNo/reference and ledger Notes identify them as school-demo data.

```sh
node --env-file=.env scripts/verification/reconcile-storefront-catalog.mjs \
  docs/verification/367-storefront-catalog.json /tmp/storefront-ims-mapping.json
```

This is an operator command, not an unauthenticated application endpoint. A
changed existing Item/Size identity or shared Item is refused for review.
The source catalog is explicit; existing similarly named products are never
inferred to be interchangeable. Catalog prices are copied exactly in pesos
from integer centavos. Each Size has its own count-based Item, so a stock lot
cannot silently supply a different Size.

## Configuration saved locally

The primary IMS `.env` contains DATABASE_URL plus IMS_SHOP_API_KEY,
IMS_SHOP_WAREHOUSE_ID=1000, IMS_APP_URL and the three IMS_GATEWAY settings.
The primary Ecommerce `.env` contains IMS_URL=https://br-sims.vercel.app,
the same IMS_SHOP_API_KEY, and IMS_SIZE_PRODUCT_IDS for all 12 Sizes. The key
was generated securely; its value stays in ignored env files and is not recorded
here. Existing .env.local files remain in place.

Hosted configuration still requires access to the Vercel team that owns IMS.
The currently connected team's project API returned 403. The owner asked to
prepare the .env files instead. Copying local env files does not update a hosted
deployment and is not evidence that a hosted test passed.

## Evidence and remaining work

- Hosted unauthenticated GET https://br-sims.vercel.app/api/shop/stock?productId=1
  returned HTTP 401.
- Locally running the current IMS source against the configured database rejects
  missing/wrong credentials and the actual Portal system credential with 401.
  The dedicated shop key returns 200, Warehouse 1000 and no-store stock reads.
- Reconciliation mapped 12 Sizes and its repeat run produced the same mapping.
- IMS central audit reads through the configured gateway succeed with HTTP 200.
- The audit service initially rejected `order.stock_reserved` and
  `order.stock_released` with 400. Its acceptance/replay tests failed before the
  addition and passed afterward on an isolated Neon clone. Hosted acceptance
  was subsequently verified after the companion Azure rollout.
- Actual HTTP movement checks passed: concurrent oversell refusal, idempotent
  reservation/release, packing deduction/add-back, POS Branch exclusion and Size
  isolation. Exactly seven matching IMS events reached the central service.
- With only the local caller's gateway connection disabled, reserve/release still
  succeeded and two audit events persisted. Restoring the connection and replaying
  the original request delivered exactly two central events and emptied the outbox.
- Storefront integration ran the actual Order store against an isolated Neon clone
  and the real IMS HTTP interface. It covered all-line refusal/compensation, a
  lost successful IMS response, checkout replay, cancellation, and the authenticated
  Next HTTP cron. GCash/Maya/bank-transfer test Orders expired; COD/paid did not.
  Demo IMS quantities returned to their original 20 units after cleanup.
- The three expiry emails reached the actual notifications service. Each has status
  sent, template app-email, one attempt and one message id, with one row per stable
  expiry key. Copied production outboxes were suppressed in the isolated clone;
  only a synthetic Customer using the configured sender address received tests.
- Audit companion PR https://github.com/fjdvm/brenraphaels-audit-logs/pull/64 is
  merged and deployed on Azure. Hosted valid-values now includes both stock Actions;
  all 13 pending Ecommerce stock audits from the integration run were accepted once.
  No routing change was needed after rollout completed.
- Machine-readable evidence is in 367-http-evidence.json, 367-outage-evidence.json
  and 367-storefront-evidence.json. They contain synthetic identifiers, no keys or
  Customer email addresses.
- Keep Ecommerce PR #299 unmerged and ticket #367 open while the hosted IMS
  configuration gate below remains incomplete.


## Remaining hosted-IMS gate

The remote Vercel origin has not received the new shop key/Warehouse settings.
The connected Vercel team denies access, and the owner does not know the owning
team. The requested settings are prepared in the primary ignored .env files.
Do not claim the remote origin accepts the new key until those values are
uploaded and a real authenticated remote stock request succeeds. PR #299 stays
on hold until this remaining configuration gate is complete.

## Repeatable verification commands

```sh
node --env-file=.env scripts/verification/seed-demo-stock.mjs \
  docs/verification/367-storefront-catalog.json docs/verification/367-size-mapping.json \
  20 --confirm-demo 1
node --env-file=.env scripts/verification/verify-stock-http.mjs \
  http://127.0.0.1:3013 docs/verification/367-size-mapping.json /tmp/stock-evidence.json
```

The HTTP verifier uses only owner-approved demo Sizes 1 and 2, checks the known
20-unit baseline, and reconciles each test line before restoring reservations/deductions on failure.
Recovery continues across line failures and records any incomplete recovery as
a failed result with the immutable references needed for replay.
It uses finite user-triggered requests, never a repeating timer. The test branch
for audit validation expires automatically; the storefront clone was the isolated
branch created by #336. Neither test environment replaces production databases.

Final validation: 1,506 IMS tests across 48 files pass, with route type generation,
TypeScript and script lint. Audit service validation passed 81 tests. Standards
and Spec review have zero unresolved findings. The verifier's deliberately lost
successful deduction reply is covered against a real PostgreSQL/HTTP instance:
it failed with 19 units before the fix and restores 20 with zero reservations
afterward. The original real-service HTTP flow was rerun successfully after the
fix. One transient database read returned 503 before any mutation; the verifier
failed closed, and an explicit reread confirmed the unchanged 20-unit balance.

The authenticated remote gate's 401 response is saved in 367-hosted-gate.json.
It remains the one unchecked ticket requirement; the other checked flow items
have the explicit preview/live-service evidence described above.
