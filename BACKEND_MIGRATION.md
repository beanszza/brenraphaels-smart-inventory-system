# Next.js backend migration

The application currently runs in hybrid mode. Migrated endpoints are implemented as Next.js App Router handlers under `app/api`; requests for API paths that do not have a local handler fall back to the existing SCMS service through `next.config.ts`.

## Migrated modules

Resources & Suppliers now uses guarded server actions under `app/actions/resources` for
items, suppliers, supplier-item links, recipes, categories, units and locations. Its page
loads initial data on the server; its HTTP handlers have been removed. Audit logs are
read on the server through the gateway. See the README for the action and audit contract.

Orders & Procurement now uses guarded server actions under `app/actions/orders` for
purchase requisitions, purchase orders (with receipts uploaded straight to file storage),
deliveries, MRP planning and reports, and its pages check the Module on the server. Its HTTP
handlers have been removed. Goods Receiving and Resources & Suppliers read the orders and
deliveries they show through their own guarded actions (`app/actions/receiving/procurement-reads.ts`,
`app/actions/resources/orders.ts`), so they need not hold Orders & Procurement.

The following modules still use App Router handlers:

- Finished products, including image upload
- Goods receipts and GRN status transitions

The Prisma schema in `prisma/schema.prisma` maps the existing PostgreSQL database. Generate the client after changing it:

```bash
npm run prisma:generate
```

## Verification

```bash
npx prisma validate --schema prisma/schema.prisma
npx tsc --noEmit
npm run build
```

Read-only smoke tests have been run successfully against the configured database for collection and detail routes across items, suppliers, purchase requisitions, purchase orders, deliveries, goods receipts, categories, units, finished products, and recipes.

## Remaining .NET-backed modules

The most visible remaining endpoints are production batches, inventory and lots, stock transfers, cycle counts, quality inspections, stock-in and put-away, traceability, valuation, and authentication.

When adding a local dynamic route, keep the generic legacy proxy in the `fallback` rewrite phase. Moving it to `beforeFiles` or a flat rewrite array causes the proxy to intercept local `[id]` handlers.
