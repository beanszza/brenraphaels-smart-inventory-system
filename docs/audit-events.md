# IMS audit events (ticket #71)

## Deployment prerequisite

Deploy the companion catalog update to `fjdvm/brenraphaels-audit-logs` **before deploying this producer**. Unknown actions are rejected. The complete typed catalog is `lib/audit-actions.ts`; retain all four legacy `record.*` actions. No SIMS database migration or gateway scope change is needed.

The referenced Audit Logs repository returned HTTP 404 from this environment. Its catalog deployment and companion issue could not be verified or created here. The following is the companion issue scope, ready for that repository's maintainer:

> Add the workflow actions from `IMS_ACTIONS` to `actionCatalog.IMS`, retain `record.created`, `record.updated`, `record.deleted`, and `record.viewed`, document them in `docs/api.md`, and expose them from `GET /events/valid-values`. Align the IMS module list with the exact producer names below. Deploy this change before api-sims #71.

| Module | Workflow actions |
| --- | --- |
| Orders & Procurement | `purchase_requisition.submitted/approved/rejected`, `purchase_order.created/approved/rejected` |
| Goods Receiving | `delivery.received/discrepancy_logged`, `goods_receipt.inspected`, `return_to_vendor.submitted/approved/rejected`; stock-in actions when operated here |
| Inventory | `stock_in.approved/rejected/put_away`, `cycle_count.reconciled`, `lot.recalled` |
| Production & Quality | `production_request.submitted/approved/rejected`, `material.issued`, `production_batch.stage_changed/qa_approved/qa_rejected` |
| Stock Transfer | `stock_transfer.requested/approved/rejected/dispatched/received` |
| Resources & Suppliers | Legacy `record.*` actions for master data |
| null | `ims.signed_in`, `ims.access_denied` |

Slash-separated suffixes above represent separate actions. The ticket's proposed `loss_report.submitted/approved/rejected` actions are reserved in the typed catalog. Current loss-report actions acknowledge existing records or resolve discrepancies; they do not implement those three transitions, so they retain `record.updated`. Draft CRUD, file links, cancellation and other transitions without a catalog action also retain legacy actions. The module names are the literal `MODULES` values, rather than the ticket's older Inventory Module / Distribution names.

## Identity and request context

Actors are `{ type: "user", id: staff.id }`. The Portal adapter takes `staff.id` exclusively from validated `user_id`. Username remains the business-record attribution field; it is never an audit actor or subject id. Review subjects resolve stored requester usernames through Known Staff. Unknown historical names have no subject rather than an invented Portal id.

Successful handoffs emit a sign-in event. Denied module access emits a failure event when a current Portal identity can be established from another granted module or the page shell. The Portal's entirely-denied responses contain no identity: those requests remain denied without attributing them to a guessed user. Supporting attributed denials for users with no remaining grants requires a Portal identity endpoint or a trustworthy identity on denial responses.

Request ids come from `x-request-id`, falling back to a UUID. `x-real-ip` and `user-agent` are included when available. Handoff credentials, handles and codes are never included. Metadata keys containing password, token, secret, authorization, card or cvv are recursively removed, including inside arrays.

## Idempotency and delivery

The key format is `<action>:<target.type>:<target.id>:<outcome>:<version>`. Version is a persisted transition value, linked file id, stage transition, or SHA-256 fingerprint of the committed result. Fingerprints sort object keys. They exclude audit emission time and request ids, so gateway retries retain the same identity. Direct one-shot events default to `once`; sign-ins use a hash of the handoff state. Repeated access denials use the request id. Failure keys are distinct from success keys and fingerprint the attempted transition and refusal. Repeated approval/rejection through the order status endpoints is refused before another save.

Successful audit writes happen after commit. Validation refusals at review endpoints emit failure events after the transaction ends; commit failures never claim success. The write deadline remains three seconds, and failures are logged without failing saved business actions. Delivery remains best effort, with no durable outbox or replay of events lost during service outages.

## Verification after rollout

1. Check `GET /events/valid-values` includes the IMS catalog and exact module names.
2. Exercise approval and rejection, a sign-in, and a denied module request for a user holding another module.
3. Read `GET /events?source=IMS&limit=20` with the audit admin key; verify specific actions, Portal ids, subjects where known, and idempotency keys.
4. Verify Portal My logs and `GET /events/stats?group_by=action&source=IMS`.

Historical events are append-only. Their old username actors remain unchanged; the IMS logs page displays both legacy and new action labels.
