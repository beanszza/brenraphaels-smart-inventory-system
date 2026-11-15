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
`SHOP-SIZE-<storefront id>` codes. It leaves existing product history and all
stock quantities intact. Replaying the same catalog returns the same mapping.
The public catalog snapshot and mapping are in `367-storefront-catalog.json` and
`367-size-mapping.json`. New Sizes initially have zero stock.

```sh
node --env-file=.env scripts/verification/reconcile-storefront-catalog.mjs \
  docs/verification/367-storefront-catalog.json /tmp/storefront-ims-mapping.json
```

This is an operator command, not an unauthenticated application endpoint. A
changed existing SKU/Size identity or duplicate code is refused for review.
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
- The audit service catalog currently needs the companion stock Action addition
  (`order.stock_reserved`, `order.stock_released`). Its HTTP acceptance/replay
  tests failed with 400 before the addition and passed afterward on an isolated
  Neon clone. Hosted acceptance requires rollout of that companion change.
- Successful movement and checkout checks require stock for the new Sizes. Demo
  stock is an owner decision, not inferred from unrelated old product inventory.
- Keep Ecommerce PR #299 unmerged and ticket #367 open until the hosted checks,
  stock movements, expiry and email/audit delivery are genuinely verified.
