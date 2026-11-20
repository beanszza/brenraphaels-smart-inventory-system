import { publishStockChanged } from "@/lib/gateway/notifications";
import { stockAvailability, warehouse } from "./stock";

/** What Staff see of one Size: stock, name, image, price (and whether it is still sold). */
export type SizeState = { productId: number; fingerprint: string };

export interface StockEventPorts {
  /** The current state of every Size the IMS holds. */
  current(): Promise<SizeState[]>;
  /** The last published state of each Size; empty before the first run. */
  published(): Promise<Map<number, string>>;
  remember(state: SizeState): Promise<void>;
  publish(sizeId: number): Promise<void>;
}

/**
 * Publishes one Size-ID event for each Size whose available stock, image, name, price or
 * presence changed since it was last published. The first run only records a baseline.
 * A failed publish leaves that Size unrecorded so the next run tries again, and never throws.
 */
export async function publishStockChanges(ports: StockEventPorts = databasePorts): Promise<number> {
  try {
    const [states, known] = await Promise.all([ports.current(), ports.published()]);
    const baseline = known.size === 0;
    let sent = 0;
    for (const state of states) {
      if (known.get(state.productId) === state.fingerprint) continue;
      try {
        if (!baseline) { await ports.publish(state.productId); sent++; }
        await ports.remember(state);
      } catch (error) {
        console.error("Stock event could not be published", error);
      }
    }
    return sent;
  } catch (error) {
    console.error("Stock events could not be checked", error);
    return 0;
  }
}

/** Loaded lazily: lib/prisma installs the write watcher from this module. */
const db = async () => (await import("@/lib/prisma")).prisma;

const databasePorts: StockEventPorts = {
  async current() {
    const prisma = await db();
    const products = await prisma.finishedProducts.findMany({
      include: { Items: { select: { ItemName: true, IsActive: true } } }, orderBy: { ProductId: "asc" },
    });
    let available: (id: number) => Promise<number | null> = async () => null;
    try {
      const warehouseId = await prisma.$transaction(tx => warehouse(tx));
      available = id => prisma.$transaction(async tx => {
        try { return (await stockAvailability(tx, id, warehouseId)).available.toNumber(); } catch { return null; }
      }, { isolationLevel: "RepeatableRead" });
    } catch { /* No configured Warehouse: stock is unknown, names, images and prices still count. */ }
    const states: SizeState[] = [];
    for (const product of products) {
      states.push({
        productId: product.ProductId,
        fingerprint: JSON.stringify([
          await available(product.ProductId), product.Items.ItemName, product.ImageUrl?.trim() || null,
          Number(product.SellingPrice), product.Items.IsActive,
        ]),
      });
    }
    return states;
  },
  async published() {
    return new Map((await (await db()).shopStockSnapshots.findMany()).map(row => [row.ProductId, row.Fingerprint]));
  },
  async remember({ productId, fingerprint }) {
    await (await db()).shopStockSnapshots.upsert({
      where: { ProductId: productId }, create: { ProductId: productId, Fingerprint: fingerprint }, update: { Fingerprint: fingerprint },
    });
  },
  publish: sizeId => publishStockChanged(sizeId),
};

const WATCHED = new Set(["InventoryLots", "Inventories", "FinishedProducts", "Items"]);
const WRITES = new Set(["create", "createMany", "update", "updateMany", "upsert", "delete", "deleteMany"]);
const SETTLE_MS = 1_000;

let timer: ReturnType<typeof setTimeout> | undefined;
let running = false;
let again = false;

/**
 * Called after any write that could change what Staff see. It waits for the writer to finish
 * and commit (a timer, never a poll), then publishes what changed. Failures are logged only.
 */
export function stockMayHaveChanged(run: () => Promise<unknown> = () => publishStockChanges()): void {
  if (!process.env.IMS_GATEWAY_URL || !process.env.IMS_GATEWAY_CALLER_KEY) return;
  clearTimeout(timer);
  timer = setTimeout(async () => {
    if (running) { again = true; return; }
    running = true;
    try { await run(); } finally {
      running = false;
      if (again) { again = false; stockMayHaveChanged(run); }
    }
  }, SETTLE_MS);
  timer.unref?.();
}

/** Watches every IMS stock, product, image and price write, wherever in IMS it happens. */
export function watchStockWrites(client: { $use?: (middleware: (params: { model?: string; action: string }, next: (params: never) => Promise<unknown>) => Promise<unknown>) => void }) {
  client.$use?.(async (params, next) => {
    const result = await next(params as never);
    if (params.model && WATCHED.has(params.model) && WRITES.has(params.action)) stockMayHaveChanged();
    return result;
  });
}
