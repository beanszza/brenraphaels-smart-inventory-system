import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { gatewayPort, WRITE_TIMEOUT_MS, type AuditEventInput } from "@/lib/gateway/audit";
import { productId, StockRefusal, warehouse, stockAvailability } from "./stock";

const operations = ["reserve", "release", "deduct", "add_back"] as const;
type Operation = typeof operations[number];
type Input = { operation: Operation; orderId: string; lineId: string; productId: number; quantity: number };
type Allocation = { lotId: number; quantity: string };

export function movementInput(body: unknown): Input {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new StockRefusal(400, "invalid_request", "Enter Order line details.");
  const input = body as Record<string, unknown>;
  if (!operations.includes(input.operation as Operation)) throw new StockRefusal(400, "invalid_operation", "Choose reserve, release, deduct or add_back.");
  for (const field of ["orderId", "lineId"]) {
    if (typeof input[field] !== "string" || !/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(input[field])) {
      throw new StockRefusal(400, "invalid_reference", "Enter a valid Order and line reference.");
    }
  }
  if (typeof input.quantity !== "number" || !Number.isSafeInteger(input.quantity) || input.quantity <= 0 || input.quantity > 2147483647) {
    throw new StockRefusal(400, "invalid_quantity", "Enter a positive whole quantity.");
  }
  return { operation: input.operation as Operation, orderId: input.orderId as string, lineId: input.lineId as string, productId: productId(input.productId), quantity: input.quantity };
}

function auditKey(input: Input) {
  return createHash("sha256").update(JSON.stringify([input.orderId, input.lineId, input.operation])).digest("hex");
}

async function queueAudit(tx: Prisma.TransactionClient, input: Input) {
  const key = auditKey(input);
  const event: AuditEventInput = {
    source: "IMS", module: "Inventory", action: "record.updated", outcome: "success",
    actor: { type: "service", id: "shop", display_name: "Shop" },
    target: { type: "order-line", id: `${input.orderId}/${input.lineId}`, display_name: `${input.orderId} · ${input.lineId}` },
    description: `Shop stock ${input.operation}: ${input.quantity} of product Size ${input.productId} for Order ${input.orderId}, line ${input.lineId}.`,
    occurred_at: new Date().toISOString(), idempotency_key: key,
  };
  await tx.shopStockAuditOutbox.create({ data: { Key: key, Event: event as unknown as Prisma.InputJsonValue } });
}

/** Retry delivery on a request, without polling or turning a committed movement into a failure. */
async function deliverAudit(input: Input) {
  try {
    const pending = await prisma.shopStockAuditOutbox.findMany({
      where: { Key: { in: operations.map(operation => auditKey({ ...input, operation })) } },
    });
    for (const row of pending) {
      await gatewayPort.writeAudit(row.Event as unknown as AuditEventInput, AbortSignal.timeout(WRITE_TIMEOUT_MS));
      await prisma.shopStockAuditOutbox.deleteMany({ where: { Key: row.Key } });
    }
  } catch { console.error("Shop stock audit delivery pending"); }
}

export async function moveStock(input: Input) {
  // Serializable protects against other IMS stock writers too. Retry rolled-back conflicts only.
  for (let attempt = 0; ; attempt++) {
    try {
      const result = await prisma.$transaction(async tx => {
        const where = { OrderId_LineId: { OrderId: input.orderId, LineId: input.lineId } };
        const existing = await tx.shopStockLines.findUnique({ where });
        if (existing) {
          if (existing.ProductId !== input.productId || !existing.Quantity.equals(input.quantity)) {
            throw new StockRefusal(409, "line_conflict", "This Order line already has different stock details.");
          }
          if (input.operation === "reserve"
            || (input.operation === "release" && existing.State === "released")
            || (input.operation === "deduct" && ["deducted", "added_back"].includes(existing.State))
            || (input.operation === "add_back" && existing.State === "added_back")) return existing;
          const nextState = input.operation === "release" && existing.State === "reserved" ? "released"
            : input.operation === "deduct" && existing.State === "reserved" ? "deducted"
            : input.operation === "add_back" && existing.State === "deducted" ? "added_back" : null;
          if (!nextState) throw new StockRefusal(409, "invalid_transition", "This stock movement is not available.");
          const product = await tx.finishedProducts.findUniqueOrThrow({ where: { ProductId: existing.ProductId } });
          for (const allocation of existing.Allocations as Allocation[]) {
            const lot = await tx.inventoryLots.findUniqueOrThrow({ where: { LotId: allocation.lotId } });
            const quantity = new Prisma.Decimal(allocation.quantity);
            const deduct = input.operation === "deduct", addBack = input.operation === "add_back";
            const updated = await tx.inventoryLots.updateMany({
              where: { LotId: lot.LotId,
                ...(!addBack ? { ReservedQuantity: { gte: quantity } } : {}),
                ...(deduct ? { QuantityRemaining: { gte: quantity }, Status: { in: ["Active", "Available"] },
                  OR: [{ ExpiryDate: null }, { ExpiryDate: { gt: new Date() } }] } : {}),
              },
              data: addBack
                ? { QuantityRemaining: { increment: quantity }, ...(lot.Status === "Depleted" ? { Status: "Active" } : {}) }
                : { ReservedQuantity: { decrement: quantity }, ...(deduct ? {
                  QuantityRemaining: { decrement: quantity }, ...(lot.QuantityRemaining.equals(quantity) ? { Status: "Depleted" } : {}),
                } : {}) },
            });
            if (updated.count !== 1) throw new StockRefusal(409, "stock_changed", "The reserved stock has changed or is no longer sellable. Ask IMS Staff to check it.");
            if (deduct || addBack) {
              await tx.stockLedgers.create({ data: {
                LotId: lot.LotId, ItemId: product.ItemId, LocationId: existing.WarehouseId,
                MovementType: deduct ? "OUT" : "IN", Quantity: quantity, UomId: lot.UomId, UnitCost: lot.UnitCost,
                ReferenceType: "ShopOrderLine", ReferenceId: JSON.stringify([input.orderId, input.lineId]),
                UserId: "shop", UserName: "Shop", PostedAt: new Date(), Notes: `Shop stock ${input.operation}`,
              } });
            }
          }
          if (input.operation !== "release") {
            const updated = await tx.inventories.updateMany({
              where: { ItemId: product.ItemId, LocationId: existing.WarehouseId,
                ...(input.operation === "deduct" ? { CurrentStock: { gte: input.quantity } } : {}),
              },
              data: { CurrentStock: input.operation === "deduct" ? { decrement: input.quantity } : { increment: input.quantity } },
            });
            if (updated.count !== 1) throw new StockRefusal(409, "stock_changed", "Warehouse stock has changed. Ask IMS Staff to check it.");
          }
          const line = await tx.shopStockLines.update({ where, data: { State: nextState } });
          await queueAudit(tx, input);
          return line;
        }
        if (input.operation !== "reserve") throw new StockRefusal(404, "line_not_found", "Reserve this Order line first.");
        const warehouseId = await warehouse(tx);
        const { lots, available } = await stockAvailability(tx, input.productId, warehouseId);
        if (available.lessThan(input.quantity)) throw new StockRefusal(409, "insufficient_stock", "There is not enough available stock for this Order line.");
        let remaining = new Prisma.Decimal(input.quantity);
        const allocations: Allocation[] = [];
        for (const lot of lots) {
          if (remaining.isZero()) break;
          const amount = Prisma.Decimal.min(remaining, Prisma.Decimal.max(0, lot.QuantityRemaining.minus(lot.ReservedQuantity)));
          if (amount.isZero()) continue;
          await tx.inventoryLots.update({ where: { LotId: lot.LotId }, data: { ReservedQuantity: { increment: amount } } });
          allocations.push({ lotId: lot.LotId, quantity: amount.toString() });
          remaining = remaining.minus(amount);
        }
        if (!remaining.isZero()) throw new StockRefusal(409, "insufficient_stock", "There is not enough available stock for this Order line.");
        const line = await tx.shopStockLines.create({ data: {
          OrderId: input.orderId, LineId: input.lineId, ProductId: input.productId,
          WarehouseId: warehouseId, Quantity: input.quantity, State: "reserved", Allocations: allocations,
        } });
        await queueAudit(tx, input);
        return line;
      }, { isolationLevel: "Serializable", timeout: 15_000 });
      await deliverAudit(input);
      return { orderId: result.OrderId, lineId: result.LineId, productId: result.ProductId, warehouseId: result.WarehouseId, quantity: result.Quantity.toNumber(), state: result.State };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && ["P2034", "P2002"].includes(error.code) && attempt < 4) continue;
      throw error;
    }
  }
}
