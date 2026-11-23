import { pushStockToCreoms, type CreomsStockPush } from "@/lib/gateway/creoms";
import { publishStockChanged } from "@/lib/gateway/notifications";
import { readInventory, readTabFigures } from "./inventory";
import { readProducts } from "./products";

/** What Staff see of one Size: stock, name, image, price (and whether it is still sold), and what CREOMS keeps of it. */
export type SizeState = { productId: number; fingerprint: string; push?: CreomsStockPush };

export interface StockEventPorts {
  /** The current state of every Size the IMS holds. */
  current(): Promise<SizeState[]>;
  /** The last published state of each Size; empty before the first run. */
  published(): Promise<Map<number, string>>;
  remember(state: SizeState): Promise<void>;
  /** Sends the figures to CREOMS's stock count, then tells every open screen the Size changed. */
  publish(state: SizeState): Promise<void>;
}

/**
 * Pushes to CREOMS and publishes one Size-ID event for each Size whose shop stock (shop Warehouse or Finished Goods tab), image, name, price or
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
        if (!baseline) { await ports.publish(state); sent++; }
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

/** The shop figures for many Sizes in one pass; null for a Size when the IMS cannot count it (no shop Warehouse set). */
async function shopFigures(ids: number[]) {
  const figures = new Map<number, { quantity: number; reserved: number; available: number }>();
  try {
    for (let start = 0; start < ids.length; start += 200) {
      for (const entry of (await readInventory(ids.slice(start, start + 200))).products) figures.set(entry.productId, entry);
    }
  } catch (error) {
    console.error("Shop stock could not be counted for the stock events", error);
  }
  return figures;
}

const databasePorts: StockEventPorts = {
  async current() {
    const prisma = await db();
    // Taken before anything is read, from the database clock every IMS instance shares, so newer figures always carry a larger version.
    const [{ version }] = await prisma.$queryRaw<{ version: bigint }[]>`select (extract(epoch from clock_timestamp()) * 1000000)::bigint as version`;
    const { products } = await readProducts();
    const ids = products.map(product => product.productId);
    const shop = await shopFigures(ids);
    // What the Finished Goods tab shows, so a change there publishes even when the shop Warehouse figure is unchanged.
    const tab = new Map((await readTabFigures(ids)).map(figures => [figures.productId, [figures.quantity, figures.reserved]]));
    return products.map(product => {
      const figures = shop.get(product.productId);
      const push: CreomsStockPush = {
        ...product, quantity: figures?.quantity ?? null, reserved: figures?.reserved ?? null, available: figures?.available ?? null, version: String(version),
      };
      return {
        productId: product.productId,
        fingerprint: JSON.stringify([
          push.quantity, push.reserved, push.available, tab.get(product.productId) ?? null, product.name, product.variant, product.image, product.price, product.active,
        ]),
        push,
      };
    });
  },
  async published() {
    return new Map((await (await db()).shopStockSnapshots.findMany()).map(row => [row.ProductId, row.Fingerprint]));
  },
  async remember({ productId, fingerprint }) {
    await (await db()).shopStockSnapshots.upsert({
      where: { ProductId: productId }, create: { ProductId: productId, Fingerprint: fingerprint }, update: { Fingerprint: fingerprint },
    });
  },
  // CREOMS's count first, so a screen that refetches on the event already reads the new figures there.
  async publish(state) {
    if (state.push) await pushStockToCreoms(state.push);
    await publishStockChanged(state.productId);
  },
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
