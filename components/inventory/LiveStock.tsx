"use client";

import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { inventoryStockLiveUrl } from "@/app/actions/inventory/stock-live";
import { createLiveStock } from "@/lib/inventory/stock-live";

/**
 * Keeps the inventory figures current: a stock change anywhere (an Order in CREOMS, a transfer or a count in the IMS)
 * refreshes the page's data from the server at once. No polling; the socket opens while the page is shown.
 */
export default function LiveStock() {
  const router = useRouter();
  const [store] = useState(() => createLiveStock({ getUrl: inventoryStockLiveUrl, refresh: () => router.refresh() }));
  useSyncExternalStore(store.subscribe, store.getSnapshot, () => "connecting" as const);
  return null;
}
