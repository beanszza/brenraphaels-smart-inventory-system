"use server";

import { requireModule } from "@/lib/portal/staff";
import { read } from "@/lib/orders/mutate";
import { queryOrders } from "@/lib/orders/queries";

/** A supplier's or supply's recent orders. Staff here may not hold Orders & Procurement. */
export async function listOrdersForResources(query = "") {
  await requireModule("Resources & Suppliers");
  return read(() => queryOrders(query));
}
