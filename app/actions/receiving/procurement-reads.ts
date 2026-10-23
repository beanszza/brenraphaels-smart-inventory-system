"use server";

import { requireModule } from "@/lib/portal/staff";
import { read } from "@/lib/orders/mutate";
import { queryDeliveries, queryDelivery, queryOrder } from "@/lib/orders/queries";

// Goods Receiving shows the deliveries and orders it receives against. Staff here may not hold
// Orders & Procurement, so these check this Module and read through the shared queries.

export async function listDeliveriesForReceiving(query = "") {
  await requireModule("Goods Receiving");
  return read(() => queryDeliveries(query));
}

export async function getDeliveryForReceiving(idInput: string | number) {
  await requireModule("Goods Receiving");
  return read(() => queryDelivery(parseInt(String(idInput), 10)));
}

export async function getOrderForReceiving(idInput: string | number) {
  await requireModule("Goods Receiving");
  return read(() => queryOrder(parseInt(String(idInput), 10)));
}
