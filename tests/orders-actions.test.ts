/// <reference types="vite/client" />
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import type { AuditEventInput } from "@/lib/gateway/audit";
import type { NotificationInput } from "@/lib/gateway/notifications";
import * as requisitions from "@/app/actions/orders/requisitions";
import * as orders from "@/app/actions/orders/orders";
import * as deliveries from "@/app/actions/orders/deliveries";
import * as receipts from "@/app/actions/orders/receipts";

const fake = vi.hoisted(() => ({
  dataAccess: vi.fn(),
  written: [] as AuditEventInput[],
  sent: [] as { userIds: string[]; input: NotificationInput }[],
  committed: [] as string[],
  created: {} as Record<string, Record<string, unknown>>,
  signed: true,
  decision: "allowed",
  requested: [] as string[],
  status: "Draft",
  auditFails: false,
  notifyFails: false,
  commitFails: false,
  transactionOpen: false,
}));

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-return-to": "/orders-procurement" }),
  cookies: async () => ({ get: () => fake.signed ? { value: "opaque" } : undefined }),
}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => { throw new Error(`Redirect: ${url}`); },
}));
vi.mock("@/lib/gateway/audit", () => ({
  WRITE_TIMEOUT_MS: 3000,
  gatewayPort: {
    writeAudit: async (event: AuditEventInput) => {
      // The mutation must have persisted before the event can be sent.
      expect(fake.committed.length).toBeGreaterThan(0);
      expect(fake.transactionOpen).toBe(false);
      if (fake.auditFails) throw new Error("Gateway unavailable");
      fake.written.push(event);
    },
    listAudit: async () => [],
  },
}));
vi.mock("@/lib/gateway/notifications", () => ({
  SEND_TIMEOUT_MS: 3000,
  notificationGateway: {
    send: async (userIds: string[], input: NotificationInput) => {
      expect(fake.transactionOpen).toBe(false);
      if (fake.notifyFails) throw new Error("Notification service unavailable");
      fake.sent.push({ userIds, input });
    },
  },
}));
vi.mock("@/lib/gateway/files", () => ({
  filesGateway: {
    requestUpload: async () => ({ id: "3f2b8c1e-5a4d-4c6e-9b7a-1d2e3f4a5b6c", uploadUrl: "https://storage.test/put", uploadUrlExpiresInSeconds: 600 }),
    confirm: async (id: string) => ({ id, status: "active", filename: "r.pdf", contentType: "application/pdf", size: 5, visibility: "private", retentionType: "permanent" }),
    view: async () => null,
    addLink: async () => {},
  },
}));

vi.mock("@/lib/prisma", () => {
  const row = () => ({
    PrId: 5, PrNumber: "PR-2026-0001", PoId: 6, PoNumber: "PO-2026-0001", DeliveryId: 7, DeliveryNumber: "DLV-2026-0001",
    Status: fake.status, RequestedBy: "2026-AB-002", Department: "Inventory", RequestType: "Stock Replenishment",
    Priority: "Normal", Purpose: "", Notes: "", AdminNotes: null, EstimatedTotalAmount: 10, TotalAmount: 50,
    RequestDate: new Date("2030-01-01"), RequiredDate: new Date("2030-01-01"), ExpectedArrivalDate: new Date("2030-01-01"),
    OrderDate: new Date("2030-01-01"), UpdatedAt: new Date("2030-01-01"), PaymentType: "Cash",
    SupplierId: 3, ItemId: 1, ItemName: "Flour", StockUomId: 1, UnitPrice: 5, PurchaseUomId: 1, LastNumber: 1,
    PurchaseRequisitionItems: [{
      PrItemId: 1, ItemId: 1, SuggestedSupplierId: 3, RequestedQuantity: 2, PurchaseUomId: 1, EstimatedUnitPrice: 5,
      Items: { ItemName: "Flour", Inventories: [] }, SuggestedSuppliers: { CompanyName: "Miller" }, UnitOfMeasures: { Abbreviation: "kg" },
    }],
    PurchaseOrderItems: [{
      PoItemId: 1, ItemId: 1, PoItemQuantity: 10, ReceivedQuantity: 0, TotalPrice: 50, PurchaseUomId: 1,
      Items: { ItemName: "Flour" }, UnitOfMeasures: { Abbreviation: "kg" },
    }],
    DeliveryItems: [],
    Suppliers: { CompanyName: "Miller" }, PurchaseRequisition: { PrNumber: "PR-2026-0001" },
    PurchaseOrders: { PoNumber: "PO-2026-0001", Suppliers: { CompanyName: "Miller" } },
  });
  const staffRow = (id: string, modules: string[]) => ({ StaffId: id, Name: id, Username: id, Modules: modules });
  const model = (name: string) => ({
    findUnique: async () => row(),
    findUniqueOrThrow: async () => row(),
    findFirst: async () => name === "knownStaff" ? staffRow("u-requester", ["Orders & Procurement"]) : name === "supplierItems" ? row() : null,
    findMany: async () => name === "knownStaff"
      ? [staffRow("staff-1", ["Orders & Procurement"]), staffRow("u-approver", ["Orders & Procurement"])]
      : [],
    count: async () => 1,
    aggregate: async () => ({ _sum: { DeclaredQuantity: 0 } }),
    create: async ({ data }: { data: Record<string, unknown> }) => { fake.committed.push(name); fake.created[name] = data; return row(); },
    createMany: async () => { fake.committed.push(name); return { count: 1 }; },
    update: async () => { fake.committed.push(name); return row(); },
    upsert: async () => { fake.committed.push(name); return row(); },
    deleteMany: async () => { fake.committed.push(name); return { count: 1 }; },
  });
  const prisma = new Proxy({}, {
    get: (_target, name: string) => {
      fake.dataAccess(name);
      if (name === "$transaction") return async (work: (tx: PrismaClient) => Promise<unknown>) => {
        const before = [...fake.committed];
        fake.transactionOpen = true;
        try {
          const result = await work(prisma as PrismaClient);
          if (fake.commitFails) throw new Error("Transaction failed to commit");
          return result;
        } catch (error) {
          fake.committed.splice(0, fake.committed.length, ...before);
          throw error;
        } finally {
          fake.transactionOpen = false;
        }
      };
      return model(name);
    },
  });
  return { prisma };
});

beforeEach(() => {
  fake.dataAccess.mockClear();
  fake.written.length = 0;
  fake.sent.length = 0;
  fake.committed.length = 0;
  fake.created = {};
  fake.requested.length = 0;
  fake.signed = true;
  fake.decision = "allowed";
  fake.status = "Draft";
  fake.auditFails = false;
  fake.notifyFails = false;
  fake.commitFails = false;
  fake.transactionOpen = false;
  vi.stubEnv("IMS_DEV_BYPASS", "false");
  vi.stubEnv("PORTAL_URL", "https://portal.test");
  vi.stubEnv("PORTAL_SYSTEM_SECRET", "test-secret");
  vi.stubGlobal("fetch", async (_input: unknown, init: RequestInit) => {
    const { module } = JSON.parse(String(init.body));
    fake.requested.push(module);
    if (fake.decision !== "allowed") return Response.json({ error: "invalid_handle" }, { status: Number(fake.decision) });
    return Response.json({ active: true, user_id: "staff-1", system: "IMS", module,
      staff: { name: "Ada Santos", username: "2026-AB-001", email: "ada@example.com" } });
  });
});

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

// Every exported action, including future additions, goes through the real Portal guard with no
// payload: authorization must run first, and the Module checked is the one that owns the caller.
const owners: Record<string, string> = {
  "../app/actions/orders/": "Orders & Procurement",
  "../app/actions/receiving/procurement-reads.ts": "Goods Receiving",
  "../app/actions/resources/orders.ts": "Resources & Suppliers",
};
const actionModules = {
  ...import.meta.glob("../app/actions/orders/*.ts"),
  ...import.meta.glob("../app/actions/receiving/procurement-reads.ts"),
  ...import.meta.glob("../app/actions/resources/orders.ts"),
};
for (const [path, load] of Object.entries(actionModules)) {
  const owner = Object.entries(owners).find(([prefix]) => path.startsWith(prefix))![1];
  describe(path, async () => {
    const actions = await load() as Record<string, (...args: never[]) => Promise<unknown>>;
    for (const [name, action] of Object.entries(actions)) {
      it.each([
        ["unsigned", false, "allowed", "/signing-in"],
        ["revoked session", true, "401", "/signing-in"],
        ["missing Module", true, "403", "/no-access"],
        ["Portal unavailable", true, "503", "/unavailable"],
      ])(`${name} denies %s before reading inputs or data`, async (_, signed, decision, destination) => {
        fake.signed = Boolean(signed);
        fake.decision = String(decision);
        await expect(action()).rejects.toThrow(`Redirect: ${destination}`);
        expect(fake.dataAccess).not.toHaveBeenCalled();
        expect(fake.written).toEqual([]);
        expect(fake.sent).toEqual([]);
        if (signed) expect(fake.requested).toEqual([owner]);
      });
    }
  });
}

const line = { itemId: 1, requestedQuantity: 2, purchaseUomId: 1, estimatedUnitPrice: 5 };
const prInput = { items: [line], requestedBy: "Forged" };
const poInput = { supplierId: 3, items: [{ itemId: 1, poItemQuantity: 2 }], requestedBy: "Forged" };
const deliveryInput = { poId: 6, items: [{ poItemId: 1, declaredQuantity: 1 }], createdBy: "Forged" };

// [name, status the record holds, act, audit action, target type, id, display name]
const mutations = [
  ["create requisition", "Draft", () => requisitions.createRequisition(prInput), "record.created", "purchase-requisition", "5", "PR-2026-0001"],
  ["update requisition", "Draft", () => requisitions.updateRequisition(5, prInput), "record.updated", "purchase-requisition", "5", "PR-2026-0001"],
  ["set requisition status", "Draft", () => requisitions.setRequisitionStatus(5, { status: "Cancelled" }), "record.updated", "purchase-requisition", "5", "PR-2026-0001"],
  ["convert requisition", "Approved", () => requisitions.convertRequisitionToOrders(5), "record.updated", "purchase-requisition", "5", "PR-2026-0001"],
  ["create order", "Draft", () => orders.createOrder(poInput), "record.created", "purchase-order", "6", "PO-2026-0001"],
  ["update order", "Draft", () => orders.updateOrder(6, poInput), "record.updated", "purchase-order", "6", "PO-2026-0001"],
  ["set order status", "Draft", () => orders.setOrderStatus(6, { status: "Cancelled" }), "record.updated", "purchase-order", "6", "PO-2026-0001"],
  ["create delivery", "Approved", () => deliveries.createDelivery(deliveryInput), "record.created", "delivery", "7", "DLV-2026-0001"],
  ["cancel delivery", "Scheduled", () => deliveries.cancelDelivery(7, { reason: "Late" }), "record.updated", "delivery", "7", "DLV-2026-0001"],
  ["dispatch delivery", "Scheduled", () => deliveries.dispatchDelivery(7, {}), "record.updated", "delivery", "7", "DLV-2026-0001"],
  ["arrive delivery", "InTransit", () => deliveries.arriveDelivery(7, {}), "record.updated", "delivery", "7", "DLV-2026-0001"],
  ["confirm receipt", "Draft", () => receipts.confirmReceiptUpload(6, "3f2b8c1e-5a4d-4c6e-9b7a-1d2e3f4a5b6c"), "record.updated", "purchase-order", "6", "PO-2026-0001"],
] as const;

it.each(mutations)("%s emits the persisted target and session actor through the gateway", async (_, status, act, action, type, id, display_name) => {
  fake.status = status;
  expect((await act()).success).toBe(true);
  expect(fake.written).toHaveLength(1);
  expect(fake.written[0]).toMatchObject({
    source: "IMS", module: "Orders & Procurement", action, outcome: "success",
    actor: { type: "staff", id: "2026-AB-001", display_name: "Ada Santos" },
    target: { type, id, display_name },
  });
  expect(fake.written[0].description).toContain("Ada Santos");
  expect(fake.written[0].description).toContain(display_name);
});

it.each(mutations)("%s still succeeds when the audit gateway fails", async (_, status, act) => {
  fake.status = status;
  fake.auditFails = true;
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  expect((await act()).success).toBe(true);
  expect(error).toHaveBeenCalledWith("Audit event could not be sent", expect.any(Error));
});

it.each(mutations.filter(([name]) => name !== "confirm receipt"))("%s does not publish an event for a transaction that fails to commit", async (_, status, act) => {
  fake.status = status;
  fake.commitFails = true;
  vi.spyOn(console, "error").mockImplementation(() => {});
  expect((await act()).success).toBe(false);
  expect(fake.written).toEqual([]);
  expect(fake.committed).toEqual([]);
});

it("records the session Username on a new requisition, order and delivery, whatever the client sends", async () => {
  fake.status = "Approved";
  await requisitions.createRequisition(prInput);
  await orders.createOrder(poInput);
  await deliveries.createDelivery(deliveryInput);
  expect(fake.created.purchaseRequisitions.RequestedBy).toBe("2026-AB-001");
  expect(fake.created.purchaseOrders.RequestedBy).toBe("2026-AB-001");
  expect(fake.created.deliveries.CreatedBy).toBe("2026-AB-001");
});

describe("refusals", () => {
  it("writes nothing and emits no event or notification when validation rejects", async () => {
    expect(await requisitions.createRequisition({ items: [] })).toMatchObject({ success: false, message: "Requisition must contain at least one item." });
    expect(await requisitions.createRequisition({ items: [line, line], submitForApproval: true })).toMatchObject({ success: false });
    expect(await orders.createOrder({ supplierId: 3, items: [] })).toMatchObject({ success: false });
    expect(await deliveries.createDelivery({ poId: 6, items: [] })).toMatchObject({ success: false });
    expect(fake.committed).toEqual([]);
    expect(fake.written).toEqual([]);
    expect(fake.sent).toEqual([]);
  });

  it("refuses an edit of a requisition that is no longer a draft", async () => {
    fake.status = "Approved";
    expect(await requisitions.updateRequisition(5, prInput)).toMatchObject({ success: false });
    expect(await orders.updateOrder(6, poInput)).toMatchObject({ success: false });
    expect(fake.written).toEqual([]);
  });

  it("refuses an unknown status", async () => {
    expect(await requisitions.setRequisitionStatus(5, { status: "Nonsense" })).toMatchObject({ success: false });
    expect(await orders.setOrderStatus(6, { status: "Nonsense" })).toMatchObject({ success: false });
    expect(fake.written).toEqual([]);
  });
});

describe("notifications", () => {
  it("tells the other Known Staff who hold the Module when a requisition is submitted for approval", async () => {
    fake.status = "PendingApproval";
    await requisitions.createRequisition({ ...prInput, submitForApproval: true });
    expect(fake.sent).toHaveLength(1);
    expect(fake.sent[0].userIds).toEqual(["u-approver"]); // not the sender, "staff-1"
    expect(fake.sent[0].input).toMatchObject({ type: "approval-requested", link: "https://localhost:3003/orders-procurement" });
    expect(fake.sent[0].input.body).toContain("PR-2026-0001");
  });

  it("tells them when a purchase order is submitted for approval, under either spelling of the status", async () => {
    fake.status = "Pending Approval";
    await orders.createOrder({ ...poInput, initialStatus: "Pending Approval" });
    await orders.setOrderStatus(6, { status: "PendingApproval" });
    expect(fake.sent.map((s) => s.input.type)).toEqual(["approval-requested", "approval-requested"]);
  });

  it.each([
    ["Approved", "request-approved"],
    ["Rejected", "request-rejected"],
  ])("tells the requester when their requisition is %s", async (status, type) => {
    await requisitions.setRequisitionStatus(5, { status });
    expect(fake.sent).toHaveLength(1);
    expect(fake.sent[0].userIds).toEqual(["u-requester"]);
    expect(fake.sent[0].input.type).toBe(type);
  });

  it.each([
    ["Approved", "request-approved"],
    ["Rejected", "request-rejected"],
  ])("tells the requester when their purchase order is %s", async (status, type) => {
    await orders.setOrderStatus(6, { status });
    expect(fake.sent.map((s) => [s.userIds, s.input.type])).toEqual([[["u-requester"], type]]);
  });

  it("does not tell Staff about their own approval", async () => {
    const { prisma } = await import("@/lib/prisma");
    vi.spyOn(prisma.knownStaff, "findFirst");
    fake.status = "Approved";
    const row = await requisitions.getRequisition(5);
    expect(row.success).toBe(true);
    const { notifyRequester } = await import("@/lib/orders/notify");
    await notifyRequester("2026-AB-001", "approved", "PR-1", { id: "staff-1", name: "Ada", username: "2026-AB-001", email: "a@x" });
    expect(fake.sent).toEqual([]);
  });

  it("sends nothing for other status changes", async () => {
    await requisitions.setRequisitionStatus(5, { status: "Cancelled" });
    await orders.setOrderStatus(6, { status: "Delivered" });
    expect(fake.sent).toEqual([]);
  });

  it("describes an approval as an approval in the audit event", async () => {
    await orders.setOrderStatus(6, { status: "Approved" });
    expect(fake.written[0].description).toBe("Ada Santos approved purchase order PO-2026-0001");
  });

  it("still succeeds when the notification service fails", async () => {
    fake.notifyFails = true;
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await requisitions.setRequisitionStatus(5, { status: "Approved" })).success).toBe(true);
    expect(error).toHaveBeenCalledWith("Notification could not be sent", expect.any(Error));
  });

  it("sends no notification for a transaction that fails to commit", async () => {
    fake.commitFails = true;
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await requisitions.setRequisitionStatus(5, { status: "Approved" })).success).toBe(false);
    expect(fake.sent).toEqual([]);
  });
});

describe("receipts", () => {
  it("hands out an upload address for a receipt of an order that exists", async () => {
    const result = await receipts.requestReceiptUpload(6, { filename: "r.pdf", contentType: "application/pdf", size: 5 });
    expect(result).toMatchObject({ success: true, data: { uploadUrl: "https://storage.test/put" } });
  });

  it("refuses a receipt that is not an image or PDF", async () => {
    const result = await receipts.requestReceiptUpload(6, { filename: "x.exe", contentType: "application/x-msdownload", size: 5 });
    expect(result.success).toBe(false);
    expect(fake.written).toEqual([]);
  });
});

describe("pages", () => {
  it.each([
    ["orders-procurement", "@/app/(root)/orders-procurement/page", []],
    ["create-pr", "@/app/(root)/orders-procurement/create-pr/page", []],
    ["edit-pr", "@/app/(root)/orders-procurement/edit-pr/[id]/page", [{ params: Promise.resolve({ id: "5" }) }]],
    ["reports", "@/app/(root)/reports/page", [{ searchParams: Promise.resolve({}) }]],
  ])("the %s page is denied before loading data during a Portal outage", async (_, path, args) => {
    fake.decision = "503";
    const { default: Page } = await import(/* @vite-ignore */ path) as { default: (...args: unknown[]) => Promise<unknown> };
    await expect(Page(...args)).rejects.toThrow("Redirect: /unavailable");
    expect(fake.dataAccess).not.toHaveBeenCalled();
  });
});
