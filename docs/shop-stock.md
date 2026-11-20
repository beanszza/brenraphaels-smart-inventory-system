# Shop stock interface

Implements [CREOMS #335](https://github.com/fjdvm/epic-crms/issues/335), part of #327. IMS continues to use Modules only. No Staff Role or browser-facing page is added. Storefront checkout and fulfilment integration ship in their dependent tickets.

## Configuration and migration

1. Apply `prisma/sql/shop-stock.sql` using a **direct**, non-pooled connection to the existing IMS database. The migration is additive, transactional and repeatable; it does not alter existing stock. Do not use `prisma db push` on production.
2. Run `npm run prisma:generate` when installing/building the application (the build script already does this).
3. Configure `IMS_SHOP_API_KEY` with a random secret of at least 32 characters. Share it only with the storefront server. It is separate from POS and Portal credentials. Missing/short keys refuse every request.
4. Set `IMS_SHOP_WAREHOUSE_ID` to the one active Warehouse's `Locations.LocationId`. Supported types are Warehouse, Commissary and Finished Goods (case insensitive). Branch locations are refused. The setting has no coded default; choosing the Warehouse remains an operator/Admin configuration step. It must match the location that actually holds sellable lots, not a POS branch with a similar name. The parent spec’s Admin-managed Portal selection and authenticated settings contract are explicitly tracked in [#368](https://github.com/fjdvm/epic-crms/issues/368); this ticket provides the IMS setting, not that separate Portal UI.

## Read

`GET /api/shop/stock?productId=123` with `Authorization: Bearer <IMS_SHOP_API_KEY>`.

```json
{ "warehouseId": 1000, "productId": 123, "quantity": 10, "reserved": 3, "available": 7 }
```

The product reference is `FinishedProducts.ProductId`, representing one Size. Quantities come from that Warehouse's Active/Available, unexpired lots. They are also capped by reconciled aggregate Inventory, because cycle counts can lower physical stock independently of lot balances. Available is bounded by both remaining-minus-reserved per matching lot and aggregate Item inventory minus every Warehouse reservation of that Item (including other Sizes and held/expired lots). Missing aggregate Inventory means zero available. Stock already dispatched/distributed to branches cannot contribute. For multiple Sizes sharing one Item, only lots linked through the Size's ProductionBatch contribute. Unlinked opening stock is accepted only when the Item has one Size. IMS does not guess a Size from a shared Item or a product name. If this leaves no matching lots, available is zero.

Responses carry `Cache-Control: no-store`. Call on a user action or an established reconnect/update event; do not poll.

## Move an Order line

`POST /api/shop/stock`, same Authorization header, `Content-Type: application/json`:

```json
{ "operation": "reserve", "orderId": "order-123", "lineId": "line-1", "productId": 123, "quantity": 4 }
```

Operation is `reserve`, `release`, `deduct` or `add_back`. All operations carry the original product and positive whole quantity. Order and line references are 1–128 ASCII letters/digits, `_`, `.`, `:`, or `-`, starting with a letter/digit. Product references and quantities are positive signed 32-bit integers. The authenticated storefront owns the Order lifecycle, business approvals and any Staff attribution; IMS does not accept Staff roles from this service request. The integration credential is trusted to request approved movements.

```text
reserve → reserved → release → released
                   → deduct  → deducted → add_back → added_back
```

Reserve at placement; release on cancellation/expiry before packing; deduct when packed; add back a whole line after an approved sellable return. Write-offs do not call add_back. Each line has one lifetime per unique `(orderId, lineId)`. A replacement uses its own Order reference and reservation. Partial returns, quantity changes and re-reserving a released line are outside this interface.

Successful mutations return HTTP 200:

```json
{ "orderId": "order-123", "lineId": "line-1", "productId": 123, "warehouseId": 1000, "quantity": 4, "state": "reserved" }
```

Retries return the line's **current** state without repeating the movement, including a delayed reserve/deduct after a later successful step. A changed product/quantity under the same Order line is a conflict. Out-of-order release/deduct/add-back is refused. After an ambiguous timeout, retry the same operation with exactly the same payload; never allocate a new line reference to retry.

Reservations persist their exact lot allocations and Warehouse. Release, deduction and add-back always use those original allocations even if the configured Warehouse changes. Deduction updates lot quantities, aggregate Inventory and StockLedger together; it refuses held/expired or missing stock. Add-back restores original lots and aggregate Inventory, preserving Hold status and expiry. Restored expired/held lots remain unavailable. Stock cannot move twice on retries, including concurrent retries. Serializable transactions with bounded conflict retries protect the available-stock check against competing Orders and other IMS stock writers; every refusal rolls back the whole line.

## Errors and audit

- 400: malformed JSON, operation, references or quantity.
- 401: missing/incorrect credential; Portal sessions and POS keys do not grant shop access.
- 404: unknown/inactive product or an unreserved Order line.
- 409: insufficient stock, conflicting line details, forbidden transition or stock changed before packing. No partial movement is committed.
- 503: unset/unavailable Warehouse, database outage or exhausted serialization retries. The caller should show “Stock cannot be checked. Try again in a few minutes.” and refuse checkout, rather than assume availability.

Every committed reserve/release/deduct/add-back queues an IMS `record.updated` audit event with the stock operation in its description and actor `service/shop`. These use the existing audit action catalog. A SHA-256 key of Order, line and operation deduplicates replays at the central service. A transactional outbox preserves delivery through outages; any subsequent mutation request for that line retries its pending events. A scheduled/background audit drain is not introduced. A line receiving no further requests after an outage retains its pending events for operator replay using the original request. Outbox rows are deleted after acknowledgement; the central audit service holds the audit history.

## Verification

`npx vitest run tests/shop-stock.test.ts` tests the authenticated Request/Response boundary against a fresh real PostgreSQL cluster, faking only the audit gateway. It applies the actual SQL migration twice and exercises available quantities, competing reservations, retries, state transitions, configuration, Size isolation and held/expired stock. PostgreSQL server/client tools (`pg_config`, `initdb`, `pg_ctl`, `psql`) must be installed; tests never read the configured application DATABASE_URL. The cluster is stopped and removed afterward.

Live checks belong in the separate production-verification ticket: configure the key/Warehouse, check one known Size, connect the dependent storefront, verify a complete reserve/pack/return and cancellation flow, and confirm central audit delivery. No deployment wait is required for this PR.

## Product feed (CREOMS #668)

`GET /api/shop/products` with the same `Authorization: Bearer <IMS_SHOP_API_KEY>` returns every Size the IMS holds:

```json
{ "products": [{ "productId": 123, "name": "Ube Jam", "variant": "250g", "image": "<stored reference>", "price": 120.5, "active": true }] }
```

`name` is the Item's name, `price` the Size's selling price and `active` the Item's active state (inactive Sizes are still listed so the shop can tell what was discontinued). A blank Variant is returned as `variant: null`: one unlabelled default Size. `image` is the stored reference, or null. A missing or wrong credential gets 401. Creating a product without a Variant shows a warning but succeeds. Like stock reads, call it on a user action or reconnect; do not poll.
