"use server";

import { staffStockLiveUrl } from "@/lib/gateway/notifications";
import { requireModule } from "@/lib/portal/staff";

/** The live stock address for Staff who hold the Inventory Module; null when the channel is unavailable. */
export async function inventoryStockLiveUrl(): Promise<string | null> {
  const staff = await requireModule("Inventory");
  try { return await staffStockLiveUrl(staff.id); }
  catch (error) {
    console.error("Staff stock live connection unavailable", error);
    return null;
  }
}
