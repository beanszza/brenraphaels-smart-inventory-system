This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Resources & Suppliers data

The Resources & Suppliers page loads its initial data on the server. Its items, suppliers,
supplier-item links, recipes, categories, units and locations use server actions under
`app/actions/resources`. Every action validates the Resources & Suppliers Module before
reading data or processing input. Shared lookup callers in other Modules use the same actions.
The former resource HTTP handlers and their PascalCase aliases have been removed.

Mutations commit in a database transaction, then send an IMS audit event with the session
Username through the gateway. Audit failure is logged without failing the saved action.
The logs page continues to read only IMS events through the gateway. These resources have
no approval/rejection workflow or file upload; their finished-product choices are read under
Resources & Suppliers, while product mutations and uploads remain with Production & Quality.

`tests/resources-actions.test.ts` exercises every action's denial paths and every mutation's
audit event, gateway failure and failed-commit behavior with fake Portal/gateway boundaries.

## IMS operator setup

Run the repeatable wizard in a private interactive terminal with Bash and Node 24+:

```bash
bash scripts/setup-ims.sh
```

The five stages collect trusted addresses, register IMS with the Portal, guide audit-key creation,
configure the gateway Callers, and record the deployment values. You need operator access to the
Portal repository/database, audit-logs repository/owner database, gateway Worker and IMS hosting project.
The wizard uses the services' existing operator commands; it does not apply database migrations.
Portal Module/seed changes belong to ticket #2.

IMS credentials are saved only in ignored `.env.local` with mode `600`; atomic updates temporarily
copy that file into a private ignored `.ims-setup.*` directory beside it, deleted on exit.
Audit keys go directly into the gateway's `CALLERS` secret through your password manager.
Do not record the session or enable shell tracing. If forcibly terminated, remove any leftover
`.ims-setup.*` directory securely. Existing credentials can be reused on reruns; Portal registration
rotates its secret and replaces the entire callback list, so run it only when needed.

The gateway needs two Callers because each holds one scoped audit key:

| Caller | Audit scope | IMS environment variable |
| --- | --- | --- |
| `ims` | `write:IMS` | `IMS_GATEWAY_CALLER_KEY` |
| `ims-audit-read` | `read:admin` | `IMS_GATEWAY_AUDIT_READ_CALLER_KEY` |

Both use `app: IMS` and `systemCode: IMS`. Preserve every other Caller when updating `CALLERS`.
The read credential can read all Sources, so keep it server-side and restrict the logs page to IMS
events in ticket #11. Audit API keys themselves never belong in the IMS environment.

See [.env.example](.env.example) for every current IMS variable and the Portal/gateway setup contract
for tickets #5 and #11. Those features are not enabled by running this wizard alone. After #5,
verify real sign-in with both registered callbacks. For local development, set `IMS_APP_URL` to
`https://localhost:3003`; production uses the stable deployed domain. Preview sign-in is unsupported.
The credential probes refuse redirects, discard response data and do not create sessions or Audit events.
You can rerun them after changing deployment configuration:

```bash
node scripts/ims-setup.mjs portal .env.local
node scripts/ims-setup.mjs gateway .env.local
```

## Portal auth backend

Set `PORTAL_URL`, `PORTAL_SYSTEM_SECRET`, `PORTAL_SYSTEM_NAME=IMS` and `IMS_APP_URL`
from [.env.example](.env.example). IMS accepts `https://br-sims.vercel.app` and local HTTPS
origins only; register the exact `/api/portal/callback` URL with the Portal. Run locally at
`https://localhost:3003` with the existing certificate files. For development without the
Portal, explicitly set `IMS_DEV_BYPASS=true` and `IMS_APP_URL=https://localhost:3003`.
The bypass throws in production, on Vercel, or for a non-localhost origin/request.

`GET /api/portal/login?returnTo=/inventory` starts PKCE. The callback checks the short-lived
handoff cookie and state, exchanges the single-use code, and stores the opaque handle in
`ims_session` (Secure, HttpOnly, SameSite=Lax, up to eight hours as issued by the Portal).
Return paths are restricted to IMS pages. `POST /api/portal/logout` from an IMS-origin form
clears the cookies and sends the browser to the Portal logout, ending the central session
for every System in that browser.

The proxy checks cookie presence only. Use `requireModule` from `lib/portal/staff.ts` before
any page or server action data access. Route handlers use `requireRouteModule(request, module)`
and immediately return `result.response` when `result.ok` is false. The guard revalidates with
the Portal on each invocation and denies invalid, missing, unavailable or malformed answers.
Dashboard opens to Staff holding any of the seven IMS Modules. Staff identity includes the
Portal internal id, name and Username; it never comes from client-supplied attribution.

This is the backend foundation in #5: screens and sidebar integration follow in #6, legacy
auth removal in #7, and guard adoption in all existing route handlers with coverage in #8.
The page/action guard redirects to `/no-access`, `/unavailable` or the Portal login;
callback failures redirect to `/sign-in-error` (screens supplied by #6).
This PR does not yet secure handlers against a forged cookie: #8 must land before the auth
cutover is considered complete. No database migration or historical data rewrite is required.
The Portal seed/registration migration is tracked in #2.

Run `npm test` for the fake-Portal suite and `npm run typecheck` for TypeScript. Tests exercise
PKCE, handoff, live Module decisions, central logout, return paths, and bypass refusal without
browser or live-service calls.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [https://localhost:3003](https://localhost:3003) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Orders & Procurement data

Purchase requisitions, purchase orders, deliveries, MRP planning and reports use server actions
under `app/actions/orders`; each checks the Orders & Procurement Module before reading inputs
or data. Every state-changing action commits in a transaction, then sends an IMS audit event
with the session Username. Submitting a requisition or order for approval notifies the other
Known Staff who hold the Module; approving or rejecting one notifies its requester (found by
Username in Known Staff). Audit and notification failures are logged and never fail the saved
action. Receipts are uploaded straight to file storage through `requestReceiptUpload` and
`confirmReceiptUpload`.

`tests/orders-actions.test.ts` exercises every action's denial paths and every mutation's
audit event, gateway failure, failed commit and notification with fake Portal/gateway boundaries.
