This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

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

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

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
