# Ticket #20: Orders & Procurement frontend

Implemented in `sims-ticket-20`, branch `feature/20-orders-procurement-frontend`,
based on merged #19 and #18 (`4f7fc18`). The original working tree is preserved.

The module landing page reads requisitions, orders and deliveries on the server.
Interactive tabs, search, filters and pagination receive serializable server data.
Bounded reads load every page rather than silently dropping records above 100.
Create/edit PR pages preload supplies; reports read their selected tab and date
range on the server. MRP is now guarded and available, with server-loaded recipe
choices and a working action to create a draft requisition with real item lines
and the supply's unit of measure.

Forms use the existing guarded server actions. Successful writes revalidate
procurement, reports and MRP; tabs refresh and announce saved/status outcomes.
Failed approvals keep the dialog open and show an error. Selector failures are
shown separately from empty lists. The requester field displays session Staff
instead of offering hardcoded employee impersonation. Procurement catalog reads
require Orders & Procurement, allowing Staff with only that Module to work.
Backend status codes are translated for approval controls, counts and filters;
new PO approval submissions send the backend's PendingApproval value.

Route loading boundaries and asynchronous content use skeletons; error boundaries
provide retry. Phone layouts stack/wrap controls and allow horizontal table scroll.
The module no longer imports the shared HTTP request client, including its previous
inventory request. Receipt uploads retain the existing signed-storage action flow.

## Verification

- TypeScript check passes.
- Vitest: 24 files, 971 tests pass, including new server-rendering, complete-list,
  failed-list, access-refusal and stock aggregation regression checks.
- Production webpack build passes; module pages are dynamic server routes.
- New pages, server code, skeleton and frontend tests pass targeted ESLint.
- Existing component lint debt remains: the initially changed tracked files went
  from 52 errors to 40. No broad lint cleanup was attempted.
- `git diff --check` passes.

## Design and scope

Inspected Figma Orders List node `6:385` in the ticket's reference file, including
its rendered screenshot. Used the existing CREOMS tokens, purple primary actions,
rounded tables, shared shell and status badges. The CRM reference supplies styling;
IMS retains its requisition/order/delivery lifecycle and existing shared icon assets.
No shell or unrelated modules were redesigned.

Per parent #1, no browser or live-service tests were run. Phone interaction and
pixel fidelity therefore remain unverified; database records were not changed.
